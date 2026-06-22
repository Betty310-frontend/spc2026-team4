"""LangChain 도구 팩토리 — make_analysis_tools(db, redis)."""

import json

from langchain_core.tools import tool
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.analysis_utils import build_h3_hexagons, calc_competition_percentile
from app.core.category_map import CATEGORY_ICONS, get_category_filter
from app.core.geo import resolve_coords
from app.core.redis import encode_geohash
from app.services.report import build_report
from app.services.store import (
    count_seoul_category,
    get_dong_codes_in_radius,
    get_monthly_avg_sales,
    get_population_flow,
)
from app.services.store import (
    search_competitors as _db_search_competitors,
)

_CACHE_TTL = 60 * 60 * 24  # 24h


def _format_peak_hours(peak_hours: tuple[str, ...]) -> str:
    """('11','12','13','17','18') → '11~13시, 17~18시'"""
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


def _build_scope(
    station: str,
    dong_name: str | None,
    radius: int,
    category: str,
    cat_filter,
    sales: dict,
    population: dict,
) -> dict:
    scope: dict = {
        'station': station,
        'dong_name': dong_name,
        'radius_m': radius,
        'category': category,
        'data_periods': {
            'competitors': '2026년 3월',
        },
    }
    if cat_filter and cat_filter.peak_hours:
        scope['peak_hours_label'] = _format_peak_hours(cat_filter.peak_hours)
    if sales.get('monthly_avg_sales_amt') is not None:
        scope['data_periods']['sales'] = '2023~2025년 분기'
    if population.get('avg_peak_population') is not None:
        scope['data_periods']['population'] = '2026년 5월'
    return scope


def _build_sources(sales: dict, population: dict) -> list[dict]:
    sources = [
        {
            'label': '경쟁업체 현황',
            'provider': '소상공인시장진흥공단',
            'reference': '2026년 3월',
            'url': 'https://www.data.go.kr/data/15083033/fileData.do',
        },
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
    station: str,
    radius: int,
    category: str,
    competitor_count: int,
    competition_percentile: int,
    dong_name: str | None,
    sales: dict,
    population: dict,
) -> str:
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
        if cnt:
            base += f' ({cnt:,}건).'
        else:
            base += '.'
    pop = population.get('avg_peak_population')
    if pop is not None:
        base += f' 핵심 시간대 평균 생활인구: {pop:,.0f}명.'
    return base


def make_analysis_tools(db: AsyncSession, redis: Redis) -> list:
    """db/redis를 클로저로 캡처한 LangChain 도구 목록을 반환한다."""

    @tool
    async def search_competitors(
        station: str, category: str, radius: int = 500
    ) -> dict:
        """반경 내 동일 업종 경쟁 업소를 조회하고 경쟁 밀집도를 계산합니다.

        Args:
            station: 지하철역 또는 동네명. 예: '연남동', '강남역', '홍대입구역', '성수역', '목동', '상계역'
            category: 업종명. 예: '카페', '음식점', '미용실', '학원', '편의점'
            radius: 분석 반경(미터). 언급 없으면 500.
        """
        coords = resolve_coords(station)
        cat_filter = get_category_filter(category)
        # 캐시 키: 정규화된 업종명(별칭·미매핑 일관성) + 지오해시7 + 반경
        cache_category = cat_filter.display_name if cat_filter else category
        geohash_str = encode_geohash(coords['lat'], coords['lng'], precision=7)
        cache_key = f'market:{cache_category}:{geohash_str}:{radius}'

        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)

        dong_codes, primary_dong_name = await get_dong_codes_in_radius(
            db, coords['lat'], coords['lng'], radius
        )
        competitors_raw = await _db_search_competitors(
            db, coords['lat'], coords['lng'], radius, cat_filter
        )
        seoul_total = await count_seoul_category(db, cat_filter)
        sales = await get_monthly_avg_sales(
            db,
            dong_codes,
            cat_filter.sales_service_codes if cat_filter else (),
        )
        population = await get_population_flow(
            db,
            dong_codes,
            cat_filter.peak_hours if cat_filter else (),
        )
        competitor_count = len(competitors_raw)
        competition_percentile = calc_competition_percentile(
            competitor_count, radius, seoul_total
        )

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
                'primary_demographic': '',
                'data_reference_month': '2025-12',
                'monthly_avg_sales_amt': sales.get('monthly_avg_sales_amt'),
                'monthly_avg_sales_cnt': sales.get('monthly_avg_sales_cnt'),
                'avg_peak_population': population.get('avg_peak_population'),
            },
            'competitors': [{**c, 'type': 'same'} for c in competitors_raw],
            'h3_hexagons': build_h3_hexagons(competitors_raw),
            'report': build_report(
                station,
                radius,
                category,
                competitor_count,
                competition_percentile,
                monthly_avg_sales_amt=sales.get('monthly_avg_sales_amt'),
                monthly_avg_sales_cnt=sales.get('monthly_avg_sales_cnt'),
            ),
            'dong_name': primary_dong_name,
            'scope': _build_scope(
                station,
                primary_dong_name,
                radius,
                category,
                cat_filter,
                sales,
                population,
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

    return [search_competitors]
