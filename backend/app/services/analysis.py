"""상권 분석 공통 로직 — REST 컨트롤러와 LangChain 도구 공유."""

import math

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.analysis_utils import (
    build_h3_hexagons,
    calc_competition_percentile,
    calc_percentile,
)
from app.core.cache import cache_or_compute
from app.core.cache_keys import (
    competition_key,
    h3_hexagons_key,
    population_dong_key,
    population_key,
)
from app.core.category_map import CATEGORY_ICONS, get_category_filter
from app.core.config import get_settings
from app.core.geo import geocode_station
from app.core.redis import encode_geohash
from app.services.market_data import (
    get_all_dong_population_avgs,
    get_data_reference_month,
    get_monthly_avg_sales,
    get_peak_sales_slot_by_dong,
    get_population_flow,
    get_population_hourly_by_dong,
)
from app.services.report import build_scope, build_sources, build_summary_text
from app.services.store import (
    count_seoul_category,
    get_dong_codes_in_radius,
    get_dong_name_by_code,
)
from app.services.store import (
    search_competitors as db_search_competitors,
)
from app.services.summarize import build_summarize

# 매출 시간대 구간 → 생활인구 시간 슬롯 매핑
_SLOT_TO_HOURS: dict[str, tuple[str, ...]] = {
    '00~06': ('00', '01', '02', '03', '04', '05'),
    '06~11': ('06', '07', '08', '09', '10'),
    '11~14': ('11', '12', '13'),
    '14~17': ('14', '15', '16'),
    '17~21': ('17', '18', '19', '20'),
    '21~24': ('21', '22', '23'),
}

# 업종별 핵심 시간대 폴백 (매출 데이터 없을 때)
_CATEGORY_PEAK_HOURS: dict[str, tuple[str, ...]] = {
    '카페': ('11', '12', '13', '14', '15', '16', '17'),
    '빵/도넛': ('09', '10', '11', '12', '13', '14', '15'),
    '백반/한정식': ('11', '12', '13', '17', '18', '19', '20'),
    '김밥/만두/분식': ('11', '12', '13', '17', '18', '19', '20'),
    '국/탕/찌개류': ('11', '12', '13', '17', '18', '19', '20'),
    '일식 회/초밥': ('11', '12', '13', '17', '18', '19', '20'),
    '돼지고기 구이/찜': ('17', '18', '19', '20', '21'),
    '요리 주점': ('18', '19', '20', '21', '22', '23'),
    '치킨': ('17', '18', '19', '20', '21', '22'),
    '미용실': ('10', '11', '12', '13', '14', '15', '16', '17', '18', '19'),
    '피부 관리실': ('10', '11', '12', '13', '14', '15', '16', '17', '18', '19'),
    '네일숍': ('10', '11', '12', '13', '14', '15', '16', '17', '18', '19'),
    '입시·교과학원': ('15', '16', '17', '18', '19', '20'),
    '요가/필라테스 학원': ('06', '07', '08', '18', '19', '20', '21'),
    '편의점': ('07', '08', '09', '12', '13', '17', '18', '19', '20', '21'),
}

# 업종별 시간대 가중치 레이블 (FE 표시용)


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


_SLOT_MIDPOINT: dict[str, int] = {
    '00~06': 3,
    '06~11': 9,
    '11~14': 12,
    '14~17': 15,
    '17~21': 19,
    '21~24': 22,
}


def _peak_mismatch_insight(
    peak_slot: str | None,
    peak_pop_hour: str | None,
) -> str | None:
    """매출 피크 시간대와 유동인구 최다 시간이 3시간 이상 차이 날 때 인사이트 문자열 반환."""
    if not peak_slot or not peak_pop_hour:
        return None
    sales_mid = _SLOT_MIDPOINT.get(peak_slot)
    if sales_mid is None:
        return None
    try:
        pop_h = int(peak_pop_hour)
    except (ValueError, TypeError):
        return None
    diff = abs(sales_mid - pop_h)
    if diff < 3:
        return None
    if pop_h < sales_mid:
        return (
            f'유동인구 최다 시간({pop_h}시)이 매출 피크({peak_slot})보다 {diff}시간 앞서 있어 '
            '오전 유동인구가 구매로 충분히 연결되지 않을 수 있습니다.'
        )
    return (
        f'매출 피크({peak_slot})가 유동인구 최다 시간({pop_h}시)보다 늦어 '
        '유동인구 감소 후 매출이 집중되는 구조입니다.'
    )


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
        if coords.get('geocode_failed'):
            return {
                'error': 'geocode_failed',
                'station': station,
                'message': (
                    f"'{station}' 위치를 찾을 수 없습니다. "
                    '정확한 역명(예: 압구정로데오역)이나 동네명을 입력해 주세요.'
                ),
            }
    geohash_str = encode_geohash(coords['lat'], coords['lng'], precision=7)
    cache_key = f'market:v3:{cache_category}:{geohash_str}:{radius}'

    async def _compute() -> dict:
        dong_codes, primary_dong_name = await get_dong_codes_in_radius(
            db, coords['lat'], coords['lng'], radius
        )
        competitors_raw = await db_search_competitors(
            db, coords['lat'], coords['lng'], radius, cat_filter
        )
        seoul_total = await count_seoul_category(db, cat_filter)
        sales_service_codes = cat_filter.sales_service_codes if cat_filter else ()
        sales = await get_monthly_avg_sales(db, dong_codes, sales_service_codes)
        population = await get_population_flow(db, dong_codes, ())

        same_count = sum(1 for c in competitors_raw if c.get('type') == 'same')
        similar_count = sum(1 for c in competitors_raw if c.get('type') == 'similar')
        competitor_count = len(competitors_raw)
        competition_percentile = calc_competition_percentile(
            same_count, radius, seoul_total
        )

        total_sales_amt = sales.get('monthly_avg_sales_amt')
        total_sales_cnt = sales.get('monthly_avg_sales_cnt')
        per_store_est_amt = (
            int(total_sales_amt / same_count)
            if (total_sales_amt and same_count > 0)
            else None
        )
        per_store_est_cnt = (
            int(total_sales_cnt / same_count)
            if (total_sales_cnt and same_count > 0)
            else None
        )

        return {
            'station': station,
            'radius': radius,
            'category': category,
            'coords': coords,
            'metrics': {
                'competitor_count': competitor_count,
                'same_count': same_count,
                'similar_count': similar_count,
                'competition_percentile': competition_percentile,
                'closure_rate_change': None,
                'data_reference_month': await get_data_reference_month(db),
                'monthly_avg_sales_amt': total_sales_amt,
                'monthly_avg_sales_cnt': total_sales_cnt,
                'per_store_est_amt': per_store_est_amt,
                'per_store_est_cnt': per_store_est_cnt,
                'weekday_avg_amt': sales.get('weekday_avg_amt'),
                'weekend_avg_amt': sales.get('weekend_avg_amt'),
                'male_avg_amt': sales.get('male_avg_amt'),
                'female_avg_amt': sales.get('female_avg_amt'),
                'sales_by_timeslot': sales.get('sales_by_timeslot'),
                'peak_sales_slot': sales.get('peak_sales_slot'),
                'sales_by_age': sales.get('sales_by_age'),
                'top_sales_age': sales.get('top_sales_age'),
                'avg_peak_population': population.get('avg_peak_population'),
                'peak_population_hour': population.get('peak_population_hour'),
                'hourly_population': population.get('hourly_population'),
                'male_pop_ratio': population.get('male_pop_ratio'),
                'female_pop_ratio': population.get('female_pop_ratio'),
                'population_by_age_ratio': population.get('population_by_age_ratio'),
                'top_population_age': population.get('top_population_age'),
            },
            'competitors': competitors_raw,
            'h3_hexagons': build_h3_hexagons(
                competitors_raw,
                center_lat=coords['lat'],
                center_lng=coords['lng'],
                radius_m=radius,
            ),
            'summarize': build_summarize(
                station,
                radius,
                category,
                same_count,
                similar_count,
                competition_percentile,
                per_store_est_amt=per_store_est_amt,
                per_store_est_cnt=per_store_est_cnt,
            ),
            'dong_name': primary_dong_name,
            'scope': build_scope(
                station,
                primary_dong_name,
                radius,
                category,
                sales,
                population,
            ),
            'sources': build_sources(sales, population),
            'tags': [
                {'label': category, 'icon': CATEGORY_ICONS.get(category, '🏪')},
                {'label': station},
                {'label': f'반경 {radius}m'},
            ],
            'summary': build_summary_text(
                station,
                radius,
                category,
                same_count,
                similar_count,
                competition_percentile,
                primary_dong_name,
                sales,
                population,
                per_store_est_amt=per_store_est_amt,
                per_store_est_cnt=per_store_est_cnt,
            ),
        }

    return await cache_or_compute(redis, cache_key, _compute)


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
        if coords.get('geocode_failed'):
            return {'error': 'geocode_failed', 'station': station}
    geohash_str = encode_geohash(coords['lat'], coords['lng'], precision=7)
    cache_key = population_key(cache_category, geohash_str, radius)

    async def _compute() -> dict:
        dong_codes, primary_dong_name = await get_dong_codes_in_radius(
            db, coords['lat'], coords['lng'], radius
        )
        population = await get_population_flow(db, dong_codes, ())
        return {
            'station': station,
            'dong_name': primary_dong_name,
            'avg_peak_population': population.get('avg_peak_population'),
            'peak_hours_label': None,
            'peak_population_hour': population.get('peak_population_hour'),
            'hourly_population': population.get('hourly_population'),
            'male_pop_ratio': population.get('male_pop_ratio'),
            'female_pop_ratio': population.get('female_pop_ratio'),
            'population_by_age_ratio': population.get('population_by_age_ratio'),
            'top_population_age': population.get('top_population_age'),
            'data_source': '서울 열린데이터 광장',
            'base_date': await get_data_reference_month(db),
        }

    return await cache_or_compute(redis, cache_key, _compute)


async def run_get_population_by_dong(
    db: AsyncSession,
    redis: Redis,
    dong_code: str,
    category: str,
    time_slots: list[str] | None = None,
) -> dict:
    """행정동 코드 기반 생활인구 조회 — REST /population 엔드포인트 전용."""
    cat_filter = get_category_filter(category)
    display_name = cat_filter.display_name if cat_filter else category
    peak_slot: str | None = None
    if time_slots:
        peak_hours = tuple(time_slots)
    else:
        sales_codes = cat_filter.sales_service_codes if cat_filter else ()
        peak_slot = await get_peak_sales_slot_by_dong(db, dong_code, sales_codes)
        if peak_slot:
            peak_hours = _SLOT_TO_HOURS.get(peak_slot, ())
        else:
            peak_hours = _CATEGORY_PEAK_HOURS.get(display_name, ())
    cache_key = population_dong_key(dong_code, display_name, peak_hours)

    async def _compute() -> dict:
        dong_name = await get_dong_name_by_code(db, dong_code)

        if not peak_hours:
            return {
                'dong_code': dong_code,
                'dong_name': dong_name,
                'base_date': await get_data_reference_month(db),
                'data_source': '서울 열린데이터 광장',
                'weighted_avg': None,
                'percentile': None,
                'time_weights_applied': [],
                'fallback': True,
                'fallback_reason': '업종별 시간대 가중치 미등록',
                'data': [],
            }

        peak_src = f'매출피크({peak_slot})' if peak_slot else '폴백'
        print(
            f'[population] dong={dong_code}({dong_name}) category={display_name} peak_src={peak_src} peak_hours={list(peak_hours)}'
        )
        pop_data = await get_population_hourly_by_dong(db, dong_code, peak_hours)
        weighted_avg = pop_data['weighted_avg']
        fallback = weighted_avg is None
        fallback_reason = '해당 행정동 생활인구 데이터 없음' if fallback else None

        percentile = None
        if weighted_avg is not None:
            all_avgs = await get_all_dong_population_avgs(db, peak_hours)
            percentile = calc_percentile(weighted_avg, all_avgs)

        time_weights_applied = [_format_peak_hours(peak_hours)] if peak_hours else []

        return {
            'dong_code': dong_code,
            'dong_name': dong_name,
            'base_date': await get_data_reference_month(db),
            'data_source': '서울 열린데이터 광장',
            'weighted_avg': weighted_avg,
            'percentile': percentile,
            'time_weights_applied': time_weights_applied,
            'fallback': fallback,
            'fallback_reason': fallback_reason,
            'data': pop_data['data'],
        }

    return await cache_or_compute(redis, cache_key, _compute)


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
    cache_key = competition_key(cache_category, geohash_str, radius)

    async def _compute() -> dict:
        competitors_raw = await db_search_competitors(db, lat, lng, radius, cat_filter)
        seoul_total = await count_seoul_category(db, cat_filter)
        competitor_count = len(competitors_raw)
        percentile = calc_competition_percentile(competitor_count, radius, seoul_total)

        area_km2 = math.pi * (radius / 1000) ** 2
        competitor_density = (
            round(competitor_count / area_km2, 5) if area_km2 > 0 else 0.0
        )

        if percentile >= 70:
            tier = 'high'
            label = f'서울 상위 {100 - percentile}%'
        elif percentile >= 40:
            tier = 'mid'
            label = '서울 중위권'
        else:
            tier = 'low'
            label = f'서울 하위 {percentile}%'

        return {
            'percentile': percentile,
            'tier': tier,
            'label': label,
            'competitor_count': competitor_count,
            'h3_resolution': 9,
            'competitor_density': competitor_density,
            'population_normalized': False,
            'data_source': '소상공인시장진흥공단',
            'base_date': '2026-03',
            'fallback': False,
        }

    return await cache_or_compute(redis, cache_key, _compute)


async def run_h3_hexagons(
    db: AsyncSession,
    redis: Redis,
    station: str,
    category: str,
    radius: int = 500,
    resolution: int = 8,
) -> list[dict]:
    """H3 헥사곤 집계 — REST /h3-hexagons 엔드포인트 전용."""
    cat_filter = get_category_filter(category)
    cache_category = cat_filter.display_name if cat_filter else category
    coords = await geocode_station(station, get_settings().kakao_rest_api_key, redis)
    if coords.get('geocode_failed'):
        return []
    geohash_str = encode_geohash(coords['lat'], coords['lng'], precision=7)
    cache_key = h3_hexagons_key(cache_category, geohash_str, radius, resolution)

    async def _compute() -> list[dict]:
        competitors = await db_search_competitors(
            db, coords['lat'], coords['lng'], radius, cat_filter
        )
        return build_h3_hexagons(
            competitors,
            center_lat=coords['lat'],
            center_lng=coords['lng'],
            radius_m=radius,
            resolution=resolution,
        )

    return await cache_or_compute(redis, cache_key, _compute)
