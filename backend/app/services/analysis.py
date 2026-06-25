"""상권 분석 공통 로직 — REST 컨트롤러와 LangChain 도구 공유."""

import json
import math

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.analysis_utils import build_h3_hexagons, calc_competition_percentile
from app.core.category_map import CATEGORY_ICONS, get_category_filter
from app.core.config import get_settings
from app.core.geo import geocode_station
from app.core.redis import encode_geohash
from app.services.market_data import (
    get_all_dong_population_avgs,
    get_monthly_avg_sales,
    get_population_flow,
    get_population_hourly_by_dong,
)
from app.services.store import (
    count_seoul_category,
    get_dong_codes_in_radius,
    get_dong_name_by_code,
    search_competitors as db_search_competitors,
)
from app.services.summarize import build_summarize

# 업종별 시간대 가중치 레이블 (FE 표시용)
_TIME_WEIGHT_LABELS: dict[str, list[str]] = {
    '카페': ['11~17시 평일', '13~18시 주말 ×2'],
    '음식점': ['11~14시, 17~21시 평일', '11~21시 주말'],
    '한식': ['11~14시, 17~21시 평일', '11~21시 주말'],
    '중식': ['11~14시, 17~21시 평일', '11~21시 주말'],
    '일식': ['11~14시, 17~21시 평일', '11~21시 주말'],
    '양식': ['11~14시, 17~21시 평일', '11~21시 주말'],
    '미용실': ['10~19시 평일', '10~18시 주말'],
    '학원': ['15~20시 평일', '10~14시 주말'],
    '치킨': ['17~22시 평일', '17~22시 주말'],
    '주점': ['18~24시 평일', '18~24시 주말'],
}

_CACHE_TTL = 60 * 60 * 24


def _format_peak_hours(peak_hours: tuple[str, ...]) -> str:
    if not peak_hours:
        return ''
    nums = sorted(int(h) for h in peak_hours)
    ranges: list[str] = []
    start = end = nums[0]
    for n in nums[1:]:
        if n == end + 1:
            end = n
        else:
            ranges.append(f'{start}~{end}시' if start != end else f'{start}시')
            start = end = n
    ranges.append(f'{start}~{end}시' if start != end else f'{start}시')
    return ', '.join(ranges)


def _build_scope(station, dong_name, radius, category, cat_filter, sales, population):
    scope: dict = {
        'station': station,
        'dong_name': dong_name,
        'radius_m': radius,
        'category': category,
        'data_periods': {'competitors': '2026년 3월'},
    }
    if sales.get('monthly_avg_sales_amt') is not None:
        scope['data_periods']['sales'] = '2023~2025년 분기'
    if population.get('avg_peak_population') is not None:
        scope['data_periods']['population'] = '2026년 5월'
    return scope


def _build_sources(sales, population):
    sources = [
        {
            'label': '경쟁업체 현황',
            'provider': '소상공인시장진흥공단',
            'reference': '2026년 3월',
            'url': 'https://www.data.go.kr/data/15083033/fileData.do',
        }
    ]
    if sales.get('monthly_avg_sales_amt') is not None:
        sources.append(
            {
                'label': '월평균 추정매출',
                'provider': '서울시 상권분석서비스',
                'reference': '2023~2025년 분기',
                'url': 'https://data.seoul.go.kr/dataList/OA-15572/S/1/datasetView.do',
            }
        )
    if population.get('avg_peak_population') is not None:
        sources.append(
            {
                'label': '생활인구',
                'provider': '서울 열린데이터 광장',
                'reference': '2026년 5월',
                'url': 'https://data.seoul.go.kr/dataList/OA-14991/S/1/datasetView.do',
            }
        )
    return sources


def _build_summary(
    station,
    radius,
    category,
    competitor_count,
    competition_percentile,
    dong_name,
    sales,
    population,
):
    dong_str = f' (행정동: {dong_name})' if dong_name else ''
    base = (
        f'{station}{dong_str} 반경 {radius}m 내 {category}: '
        f'{competitor_count}개 영업 중, '
        f'경쟁 밀집도 서울 {competition_percentile}퍼센타일.'
    )
    amt = sales.get('monthly_avg_sales_amt')
    cnt = sales.get('monthly_avg_sales_cnt')
    if amt is not None:
        amt_man = amt // 10000
        base += f' 월평균 추정매출: {amt_man:,}만원'
        base += f' ({cnt:,}건).' if cnt else '.'
    pop = population.get('avg_peak_population')
    if pop is not None:
        base += f' 핵심 시간대 평균 생활인구: {pop:,.0f}명.'
    return base


def _calc_percentile(value: float, reference_values: list[float]) -> int:
    """기준값 목록 대비 퍼센타일(0~100)을 반환한다."""
    if not reference_values:
        return 50
    rank = sum(1 for v in reference_values if v < value)
    return round(rank / len(reference_values) * 100)


async def run_market_analysis(
    db: AsyncSession,
    redis: Redis,
    station: str,
    category: str,
    radius: int = 500,
    *,
    lat: float | None = None,
    lng: float | None = None,
) -> dict:
    """경쟁업체·매출·유동인구를 합산한 전체 상권 분석 결과를 반환한다.

    chat 도구와 REST 컨트롤러가 공유하는 핵심 함수. Redis 24h 캐시 적용.
    """
    cat_filter = get_category_filter(category)
    cache_category = cat_filter.display_name if cat_filter else category
    if lat is not None and lng is not None:
        coords = {'lat': lat, 'lng': lng}
    else:
        coords = await geocode_station(
            station, get_settings().kakao_rest_api_key, redis
        )
    geohash_str = encode_geohash(coords['lat'], coords['lng'], precision=7)
    cache_key = f'market:v2:{cache_category}:{geohash_str}:{radius}'

    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    dong_codes, primary_dong_name = await get_dong_codes_in_radius(
        db, coords['lat'], coords['lng'], radius
    )
    competitors_raw = await db_search_competitors(
        db, coords['lat'], coords['lng'], radius, cat_filter
    )
    seoul_total = await count_seoul_category(db, cat_filter)
    sales = await get_monthly_avg_sales(
        db, dong_codes, cat_filter.sales_service_codes if cat_filter else ()
    )
    population = await get_population_flow(
        db, dong_codes, ()
    )

    competitor_count = len(competitors_raw)
    competition_percentile = calc_competition_percentile(
        competitor_count, radius, seoul_total
    )

    # 행정동 전체 매출 → 업소당 추정 매출 (반경 내 경쟁업체 수로 나눔)
    total_sales_amt = sales.get('monthly_avg_sales_amt')
    total_sales_cnt = sales.get('monthly_avg_sales_cnt')
    divisor = max(competitor_count, 1)
    per_store_est_amt = int(total_sales_amt / divisor) if total_sales_amt else None
    per_store_est_cnt = int(total_sales_cnt / divisor) if total_sales_cnt else None

    result = {
        'station': station,
        'radius': radius,
        'category': category,
        'coords': coords,
        'metrics': {
            'competitor_count': competitor_count,
            'competition_percentile': competition_percentile,
            'population_flow_percentile': 0,
            'closure_rate_change': 0.0,
            'data_reference_month': '2025-12',
            # 매출 — dong 전체 합산 / 업소당 추정치
            'monthly_avg_sales_amt': total_sales_amt,  # 행정동 전체 합산
            'monthly_avg_sales_cnt': total_sales_cnt,
            'per_store_est_amt': per_store_est_amt,  # 업소당 추정 월매출
            'per_store_est_cnt': per_store_est_cnt,  # 업소당 추정 월거래건수
            'weekday_avg_amt': sales.get('weekday_avg_amt'),
            'weekend_avg_amt': sales.get('weekend_avg_amt'),
            'male_avg_amt': sales.get('male_avg_amt'),
            'female_avg_amt': sales.get('female_avg_amt'),
            'sales_by_timeslot': sales.get('sales_by_timeslot'),
            'peak_sales_slot': sales.get('peak_sales_slot'),
            'sales_by_age': sales.get('sales_by_age'),
            'top_sales_age': sales.get('top_sales_age'),
            # 생활인구
            'avg_peak_population': population.get('avg_peak_population'),
            'peak_population_hour': population.get('peak_population_hour'),
            'hourly_population': population.get('hourly_population'),
            'male_pop_ratio': population.get('male_pop_ratio'),
            'female_pop_ratio': population.get('female_pop_ratio'),
            'population_by_age_ratio': population.get('population_by_age_ratio'),
            'top_population_age': population.get('top_population_age'),
        },
        'competitors': competitors_raw,
        'h3_hexagons': build_h3_hexagons(competitors_raw),
        'summarize': build_summarize(
            station,
            radius,
            category,
            competitor_count,
            competition_percentile,
            per_store_est_amt=per_store_est_amt,
            per_store_est_cnt=per_store_est_cnt,
        ),
        'dong_name': primary_dong_name,
        'scope': _build_scope(
            station, primary_dong_name, radius, category, cat_filter, sales, population
        ),
        'sources': _build_sources(sales, population),
        'tags': [
            {'label': category, 'icon': CATEGORY_ICONS.get(category, '🏪')},
            {'label': station},
            {'label': f'반경 {radius}m'},
        ],
        'summary': _build_summary(
            station,
            radius,
            category,
            competitor_count,
            competition_percentile,
            primary_dong_name,
            sales,
            population,
        ),
    }

    await redis.setex(cache_key, _CACHE_TTL, json.dumps(result, ensure_ascii=False))
    return result


async def run_get_population(
    db: AsyncSession,
    redis: Redis,
    station: str,
    category: str,
    radius: int = 500,
    *,
    lat: float | None = None,
    lng: float | None = None,
) -> dict:
    """유동인구만 조회하는 경량 함수. 경쟁업체 DB 쿼리 없이 행정동+생활인구만 조회한다."""
    cat_filter = get_category_filter(category)
    cache_category = cat_filter.display_name if cat_filter else category
    if lat is not None and lng is not None:
        coords = {'lat': lat, 'lng': lng}
    else:
        coords = await geocode_station(
            station, get_settings().kakao_rest_api_key, redis
        )
    geohash_str = encode_geohash(coords['lat'], coords['lng'], precision=7)
    cache_key = f'pop:{cache_category}:{geohash_str}:{radius}'

    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    dong_codes, primary_dong_name = await get_dong_codes_in_radius(
        db, coords['lat'], coords['lng'], radius
    )
    population = await get_population_flow(
        db, dong_codes, cat_filter.peak_hours if cat_filter else ()
    )
    peak_hours_label = (
        _format_peak_hours(cat_filter.peak_hours)
        if cat_filter and cat_filter.peak_hours
        else None
    )

    result = {
        'station': station,
        'dong_name': primary_dong_name,
        'avg_peak_population': population.get('avg_peak_population'),
        'peak_hours_label': peak_hours_label,
        'peak_population_hour': population.get('peak_population_hour'),
        'hourly_population': population.get('hourly_population'),
        'male_pop_ratio': population.get('male_pop_ratio'),
        'female_pop_ratio': population.get('female_pop_ratio'),
        'population_by_age_ratio': population.get('population_by_age_ratio'),
        'top_population_age': population.get('top_population_age'),
        'data_source': '서울 열린데이터 광장',
        'base_date': '2026-05',
    }

    await redis.setex(cache_key, _CACHE_TTL, json.dumps(result, ensure_ascii=False))
    return result


async def run_get_population_by_dong(
    db: AsyncSession,
    redis: Redis,
    dong_code: str,
    category: str,
    time_slots: list[str] | None = None,
) -> dict:
    """행정동 코드 기반 생활인구 조회 — REST /population 엔드포인트 전용."""
    cat_filter = get_category_filter(category)
    peak_hours = (
        tuple(time_slots)
        if time_slots
        else (cat_filter.peak_hours if cat_filter else ())
    )
    display_name = cat_filter.display_name if cat_filter else category
    cache_key = f'pop_dong:{dong_code}:{display_name}:{",".join(peak_hours)}'

    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    dong_name = await get_dong_name_by_code(db, dong_code)

    if not peak_hours:
        result: dict[str, object] = {
            'dong_code': dong_code,
            'dong_name': dong_name,
            'base_date': '2024-12',
            'data_source': '서울 열린데이터 광장',
            'weighted_avg': None,
            'percentile': None,
            'time_weights_applied': [],
            'fallback': True,
            'fallback_reason': '업종별 시간대 가중치 미등록',
            'data': [],
        }
        await redis.setex(cache_key, _CACHE_TTL, json.dumps(result, ensure_ascii=False))
        return result

    pop_data = await get_population_hourly_by_dong(db, dong_code, peak_hours)
    weighted_avg = pop_data['weighted_avg']
    fallback = weighted_avg is None
    fallback_reason = '해당 행정동 생활인구 데이터 없음' if fallback else None

    percentile = None
    if weighted_avg is not None:
        all_avgs = await get_all_dong_population_avgs(db, peak_hours)
        percentile = _calc_percentile(weighted_avg, all_avgs)

    time_weights_applied = _TIME_WEIGHT_LABELS.get(
        display_name, [_format_peak_hours(peak_hours)]
    )

    result = {
        'dong_code': dong_code,
        'dong_name': dong_name,
        'base_date': '2024-12',
        'data_source': '서울 열린데이터 광장',
        'weighted_avg': weighted_avg,
        'percentile': percentile,
        'time_weights_applied': time_weights_applied,
        'fallback': fallback,
        'fallback_reason': fallback_reason,
        'data': pop_data['data'],
    }

    await redis.setex(cache_key, _CACHE_TTL, json.dumps(result, ensure_ascii=False))
    return result


async def run_competition_percentile(
    db: AsyncSession,
    redis: Redis,
    lat: float,
    lng: float,
    category: str,
    radius: int = 500,
) -> dict:
    """위경도 기반 경쟁 밀집도 퍼센타일 — REST /competition-percentile 엔드포인트 전용."""
    cat_filter = get_category_filter(category)
    cache_category = cat_filter.display_name if cat_filter else category
    geohash_str = encode_geohash(lat, lng, precision=7)
    cache_key = f'competile:{cache_category}:{geohash_str}:{radius}'

    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    competitors_raw = await db_search_competitors(db, lat, lng, radius, cat_filter)
    seoul_total = await count_seoul_category(db, cat_filter)
    competitor_count = len(competitors_raw)
    percentile = calc_competition_percentile(competitor_count, radius, seoul_total)

    area_km2 = math.pi * (radius / 1000) ** 2
    competitor_density = round(competitor_count / area_km2, 5) if area_km2 > 0 else 0.0

    if percentile >= 70:
        tier = 'high'
        label = f'서울 상위 {100 - percentile}%'
    elif percentile >= 40:
        tier = 'mid'
        label = '서울 중위권'
    else:
        tier = 'low'
        label = f'서울 하위 {percentile}%'

    result = {
        'percentile': percentile,
        'tier': tier,
        'label': label,
        'h3_resolution': 9,
        'competitor_density': competitor_density,
        'population_normalized': False,
        'data_source': '소상공인시장진흥공단',
        'base_date': '2026-03',
        'fallback': False,
    }

    await redis.setex(cache_key, _CACHE_TTL, json.dumps(result, ensure_ascii=False))
    return result
