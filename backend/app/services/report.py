"""상권 분석 상세 리포트 생성 — PDF 다운로드용 구조화 데이터."""

import re
from datetime import date

# ── run_market_analysis 결과 조립용 헬퍼 ──────────────────────────────────────


def build_scope(station, dong_name, radius, category, sales, population):
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


def build_sources(sales, population):
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


def build_summary_text(
    station,
    radius,
    category,
    same_count,
    similar_count,
    competition_percentile,
    dong_name,
    sales,
    population,
    per_store_est_amt=None,
    per_store_est_cnt=None,
):
    dong_str = f' (행정동: {dong_name})' if dong_name else ''
    similar_str = f', 유사업종 {similar_count}개' if similar_count > 0 else ''
    base = (
        f'{station}{dong_str} 반경 {radius}m 내 {category}: '
        f'동일업종 {same_count}개{similar_str} 영업 중, '
        f'경쟁 밀집도 서울 {competition_percentile}퍼센타일.'
    )
    if per_store_est_amt is not None:
        amt_man = per_store_est_amt // 10000
        base += f' 업소당 월 추정매출: {amt_man:,}만원'
        base += f' ({per_store_est_cnt:,}건).' if per_store_est_cnt else '.'
    pop = population.get('avg_peak_population')
    if pop is not None:
        base += f' 핵심 시간대 평균 생활인구: {pop:,.0f}명.'
    return base


_SLOT_ORDER = ['00~06', '06~11', '11~14', '14~17', '17~21', '21~24']

_FORBIDDEN = re.compile(
    r'성공\s*보장|매출\s*예측|폐업\s*확률|성공\s*가능성|수익\s*보장|'
    r'반드시\s*성공|확실히\s*성공|높은\s*성공률'
)


def _man(v: int | None) -> str | None:
    """원 단위 → 만원 문자열."""
    if v is None:
        return None
    return f'{v // 10_000:,}만원'


def _percentile_label(p: int) -> tuple[str, str]:
    """퍼센타일 → (tier, label)."""
    if p >= 70:
        return 'high', f'서울 상위 {100 - p}% 수준'
    if p >= 40:
        return 'mid', '서울 중위권 수준'
    return 'low', f'서울 상위 {100 - p}% 이내 (낮은 경쟁 밀집도)'


def _to_chart(d: dict) -> list[dict]:
    """dict → [{label, value}] 배열. value가 None인 항목 제외."""
    return [{'label': k, 'value': v} for k, v in d.items() if v is not None]


def _check_forbidden(texts: list[str]) -> bool:
    """금지어 포함 여부를 검사한다."""
    return any(_FORBIDDEN.search(t) for t in texts if t)


def _build_charts(
    *,
    percentile: int,
    percentile_label: str,
    tier: str,
    competitor_count: int,
    hourly: list,
    sales_by_slot: dict,
    sales_by_age: dict,
    pop_by_age: dict,
    male_amt: int | None,
    female_amt: int | None,
    male_ratio: float | None,
    female_ratio: float | None,
    weekday_amt: int | None,
    weekend_amt: int | None,
    per_amt: int | None,
    per_cnt: int | None,
) -> dict:
    """FE 차트 렌더링용 사전 가공 데이터. 데이터 없는 항목은 key 자체를 생략."""
    charts: dict = {}

    # ── 시간대별 생활인구 (00~23시, 라인/바 차트) ──────────────────────────
    if hourly:
        charts['population_hourly'] = [
            {'label': f'{h["hour"]}시', 'value': h['avg_pop']}
            for h in sorted(hourly, key=lambda x: x['hour'])
        ]

    # ── 시간대별 매출 (바 차트) ────────────────────────────────────────────
    if sales_by_slot and any(v is not None for v in sales_by_slot.values()):
        charts['sales_by_timeslot'] = [
            {'label': f'{s}시', 'value': sales_by_slot[s]}
            for s in _SLOT_ORDER
            if sales_by_slot.get(s) is not None
        ]

    # ── 연령대별 매출 (바 차트) ────────────────────────────────────────────
    if sales_by_age and any(v is not None for v in sales_by_age.values()):
        charts['sales_by_age'] = _to_chart(sales_by_age)

    # ── 연령대별 생활인구 비율 (바 차트, %) ───────────────────────────────
    if pop_by_age and any(v is not None for v in pop_by_age.values()):
        charts['population_by_age'] = _to_chart(pop_by_age)

    # ── 성별 매출 (도넛/바 차트) ──────────────────────────────────────────
    if male_amt is not None and female_amt is not None:
        charts['gender_sales'] = [
            {'label': '남성', 'value': male_amt},
            {'label': '여성', 'value': female_amt},
        ]
        total_g = male_amt + female_amt
        if total_g > 0:
            charts['gender_sales_ratio'] = [
                {'label': '남성', 'value': round(male_amt / total_g * 100, 1)},
                {'label': '여성', 'value': round(female_amt / total_g * 100, 1)},
            ]

    # ── 성별 생활인구 비율 (도넛 차트, %) ────────────────────────────────
    if male_ratio is not None and female_ratio is not None:
        charts['gender_population'] = [
            {'label': '남성', 'value': male_ratio},
            {'label': '여성', 'value': female_ratio},
        ]

    # ── 주중/주말 매출 비교 (바 차트) ────────────────────────────────────
    if weekday_amt is not None and weekend_amt is not None:
        charts['weekday_weekend_sales'] = [
            {'label': '주중', 'value': weekday_amt},
            {'label': '주말', 'value': weekend_amt},
        ]

    # ── 경쟁 밀집도 게이지 ─────────────────────────────────────────────────
    charts['competition_gauge'] = {
        'percentile': percentile,
        'label': percentile_label,
        'tier': tier,
        'competitor_count': competitor_count,
    }

    # ── 업소당 추정 매출 요약 카드 ────────────────────────────────────────
    if per_amt is not None:
        charts['per_store_summary'] = {
            'monthly_amt': per_amt,
            'monthly_amt_label': _man(per_amt),
            'monthly_cnt': per_cnt,
        }

    return charts


def build_report(analysis: dict) -> dict:
    """run_market_analysis 결과를 받아 상세 리포트를 생성한다."""
    m = analysis.get('metrics', {})
    station = analysis.get('station', '')
    category = analysis.get('category', '')
    radius = analysis.get('radius', 500)
    dong_name = analysis.get('dong_name') or ''

    # ── 경쟁 현황 ──────────────────────────────────────────────────────────
    competitor_count: int = m.get('competitor_count', 0)
    percentile: int = m.get('competition_percentile', 0)
    tier, p_label = _percentile_label(percentile)

    # ── 추정매출 ───────────────────────────────────────────────────────────
    per_amt = m.get('per_store_est_amt')
    per_cnt = m.get('per_store_est_cnt')
    weekday_amt = m.get('weekday_avg_amt')
    weekend_amt = m.get('weekend_avg_amt')
    ww_ratio: str | None = None
    if weekday_amt is not None and weekend_amt is not None and weekend_amt > 0:
        ww_ratio = f'{weekday_amt / weekend_amt:.1f}:1 (주중:주말)'

    sales_by_age: dict = m.get('sales_by_age') or {}
    top_sales_age: str | None = m.get('top_sales_age')
    sales_by_slot: dict = m.get('sales_by_timeslot') or {}
    peak_slot: str | None = m.get('peak_sales_slot')

    male_amt = m.get('male_avg_amt')
    female_amt = m.get('female_avg_amt')
    gender_sales_ratio: str | None = None
    if male_amt is not None and female_amt is not None:
        total = male_amt + female_amt
        if total > 0:
            gender_sales_ratio = f'남성 {male_amt / total * 100:.1f}% / 여성 {female_amt / total * 100:.1f}%'

    # ── 생활인구 ───────────────────────────────────────────────────────────
    avg_peak_pop = m.get('avg_peak_population')
    peak_hour = m.get('peak_population_hour')
    male_ratio = m.get('male_pop_ratio')
    female_ratio = m.get('female_pop_ratio')
    pop_by_age: dict = m.get('population_by_age_ratio') or {}
    top_pop_age: str | None = m.get('top_population_age')
    hourly: list = m.get('hourly_population') or []

    # ── SWOT (summarize에서 재사용) ────────────────────────────────────────
    summarize = analysis.get('summarize', {})
    swot: dict = summarize.get('swot', {})

    # ── 인사이트 ───────────────────────────────────────────────────────────
    insights: list[str] = []
    if tier == 'high':
        insights.append(
            f'경쟁 밀집도가 {p_label}으로 신규 진입 시 차별화 전략이 필수입니다.'
        )
    elif tier == 'low':
        insights.append(
            '경쟁이 적은 지역이지만 수요 자체가 낮을 수 있으므로 유동인구를 함께 검토하세요.'
        )

    if ww_ratio:
        ratio_val = weekday_amt / weekend_amt
        if ratio_val >= 3:
            insights.append(
                f'주중 매출이 주말의 {ratio_val:.1f}배 수준 — 직장인 평일 수요가 핵심입니다.'
            )
        elif ratio_val >= 1:
            insights.append(
                '주중·주말 수요가 비교적 균등합니다 — 요일 무관 안정적 집객을 기대할 수 있습니다.'
            )
        else:
            insights.append('주말 수요가 주중보다 높아 주말 집객 전략이 유효합니다.')

    if top_sales_age:
        insights.append(
            f'매출 주요 연령대는 {top_sales_age}로, 타겟 마케팅 우선순위를 참고하세요.'
        )

    if peak_slot:
        insights.append(
            f'매출 최고 시간대는 {peak_slot}시 — 해당 시간대 인력·재고 집중 배치를 권장합니다.'
        )

    if gender_sales_ratio:
        dominant = '남성' if male_amt >= female_amt else '여성'
        insights.append(
            f'매출 성비: {gender_sales_ratio} — {dominant} 고객 비중이 더 높습니다.'
        )

    if male_ratio is not None and female_ratio is not None:
        dominant_pop = '남성' if male_ratio >= female_ratio else '여성'
        insights.append(
            f'유동인구 성비는 남성 {male_ratio}% / 여성 {female_ratio}% — {dominant_pop} 유동인구가 우세합니다.'
        )

    if top_pop_age:
        insights.append(
            f'유동인구 주요 연령대는 {top_pop_age} — '
            f'매출 주요 연령대({top_sales_age or "미확인"})와 비교해 타겟 매칭 여부를 확인하세요.'
        )

    mismatch_insight: str | None = m.get('peak_mismatch_insight')
    if mismatch_insight:
        insights.append(mismatch_insight)

    trend_direction: str | None = m.get('sales_trend_direction')
    trend_rate = m.get('sales_trend_rate')
    if (
        trend_direction
        and trend_direction not in ('unknown', 'stable')
        and trend_rate is not None
    ):
        pct = round(abs(trend_rate) * 100, 1)
        if trend_direction == 'up':
            insights.append(
                f'이 지역·업종의 월평균 매출이 전년 대비 {pct}% 증가 추세입니다.'
            )
        else:
            insights.append(
                f'이 지역·업종의 월평균 매출이 전년 대비 {pct}% 감소 추세입니다. 수요 변화를 면밀히 검토하세요.'
            )

    # ── 금지어 검사 ────────────────────────────────────────────────────────
    forbidden_violated = _check_forbidden(
        insights + summarize.get('전략_제안', []) + [summarize.get('요약', '')]
    )

    return {
        'meta': {
            'station': station,
            'category': category,
            'radius_m': radius,
            'dong_name': dong_name,
            'generated_at': date.today().isoformat(),
            'data_sources': analysis.get('sources', []),
        },
        'competition': {
            'competitor_count': competitor_count,
            'competition_percentile': percentile,
            'percentile_label': p_label,
            'tier': tier,
        },
        'sales': {
            'per_store_est_amt': per_amt,
            'per_store_est_amt_label': _man(per_amt),
            'per_store_est_cnt': per_cnt,
            'weekday_avg_amt': weekday_amt,
            'weekend_avg_amt': weekend_amt,
            'weekday_weekend_ratio': ww_ratio,
            # raw dict: 하위 호환용. 차트용은 charts.sales_by_timeslot 사용
            'by_timeslot': sales_by_slot,
            'peak_slot': peak_slot,
            'by_age': sales_by_age,
            'top_age': top_sales_age,
            'male_amt': male_amt,
            'female_amt': female_amt,
            'gender_ratio': gender_sales_ratio,
        },
        'population': {
            'avg_peak_population': avg_peak_pop,
            'peak_hour': peak_hour,
            'male_ratio': male_ratio,
            'female_ratio': female_ratio,
            'by_age_ratio': pop_by_age,
            'top_age': top_pop_age,
            # raw list: 하위 호환용. 차트용은 charts.population_hourly 사용
            'hourly': hourly,
        },
        'swot': swot,
        'insights': insights,
        'strategy': summarize.get('전략_제안', []),
        'checklist_questions': summarize.get('확인_질문', []),
        'risk_summary': summarize.get('요약', ''),
        'forbidden_violated': forbidden_violated,
        'charts': _build_charts(
            percentile=percentile,
            percentile_label=p_label,
            tier=tier,
            competitor_count=competitor_count,
            hourly=hourly,
            sales_by_slot=sales_by_slot,
            sales_by_age=sales_by_age,
            pop_by_age=pop_by_age,
            male_amt=male_amt,
            female_amt=female_amt,
            male_ratio=male_ratio,
            female_ratio=female_ratio,
            weekday_amt=weekday_amt,
            weekend_amt=weekend_amt,
            per_amt=per_amt,
            per_cnt=per_cnt,
        ),
    }
