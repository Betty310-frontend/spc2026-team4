"""상권 분석 상세 리포트 생성 — PDF 다운로드용 구조화 데이터."""

from datetime import date


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
    return 'low', f'서울 하위 {p}% 수준'


def build_report(analysis: dict) -> dict:
    """run_market_analysis 결과를 받아 PDF용 상세 리포트를 생성한다."""
    m = analysis.get('metrics', {})
    station = analysis.get('station', '')
    category = analysis.get('category', '')
    radius = analysis.get('radius', 500)
    dong_name = analysis.get('dong_name') or ''

    # ── 경쟁 현황 ──────────────────────────────────────────────────────────
    competitor_count: int = m.get('competitor_count', 0)
    percentile: int = m.get('competition_percentile', 0)
    tier, percentile_label = _percentile_label(percentile)

    # ── 추정매출 ───────────────────────────────────────────────────────────
    per_amt = m.get('per_store_est_amt')
    per_cnt = m.get('per_store_est_cnt')
    weekday_amt = m.get('weekday_avg_amt')
    weekend_amt = m.get('weekend_avg_amt')
    ww_ratio: str | None = None
    if weekday_amt and weekend_amt and weekend_amt > 0:
        ww_ratio = f'{weekday_amt / weekend_amt:.1f}:1 (주중:주말)'

    sales_by_age: dict = m.get('sales_by_age') or {}
    top_sales_age: str | None = m.get('top_sales_age')
    sales_by_slot: dict = m.get('sales_by_timeslot') or {}
    peak_slot: str | None = m.get('peak_sales_slot')

    male_amt = m.get('male_avg_amt')
    female_amt = m.get('female_avg_amt')
    gender_sales_ratio: str | None = None
    if male_amt and female_amt:
        total = male_amt + female_amt
        gender_sales_ratio = (
            f'남성 {male_amt / total * 100:.1f}% / 여성 {female_amt / total * 100:.1f}%'
        )

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

    # 리포트 전용 추가 인사이트
    insights: list[str] = []
    if tier == 'high':
        insights.append(
            f'경쟁 밀집도가 {percentile_label}으로 신규 진입 시 차별화 전략이 필수입니다.'
        )
    elif tier == 'low':
        insights.append(
            '경쟁이 적은 지역이지만 수요 자체가 낮을 수 있으므로 유동인구를 함께 검토하세요.'
        )

    if ww_ratio:
        ratio_val = weekday_amt / (weekend_amt or 1)
        if ratio_val >= 3:
            insights.append(
                f'주중 매출이 주말의 {ratio_val:.1f}배 수준 — 직장인 평일 수요가 핵심입니다.'
            )
        else:
            insights.append('주말 수요가 상대적으로 높아 주말 집객 전략이 유효합니다.')

    if top_sales_age:
        insights.append(
            f'매출 주요 연령대는 {top_sales_age}로, 타겟 마케팅 우선순위를 참고하세요.'
        )

    if peak_slot:
        insights.append(
            f'매출 최고 시간대는 {peak_slot} — 해당 시간대 인력·재고 집중 배치를 권장합니다.'
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
            'percentile_label': percentile_label,
            'tier': tier,
        },
        'sales': {
            'per_store_est_amt': per_amt,
            'per_store_est_amt_label': _man(per_amt),
            'per_store_est_cnt': per_cnt,
            'weekday_avg_amt': weekday_amt,
            'weekend_avg_amt': weekend_amt,
            'weekday_weekend_ratio': ww_ratio,
            'by_timeslot': sales_by_slot,
            'peak_slot': peak_slot,
            'by_age': sales_by_age,
            'top_age': top_sales_age,
            'gender_ratio': gender_sales_ratio,
        },
        'population': {
            'avg_peak_population': avg_peak_pop,
            'peak_hour': peak_hour,
            'male_ratio': male_ratio,
            'female_ratio': female_ratio,
            'by_age_ratio': pop_by_age,
            'top_age': top_pop_age,
            'hourly': hourly,
        },
        'swot': swot,
        'insights': insights,
        'strategy': summarize.get('전략_제안', []),
        'checklist_questions': summarize.get('확인_질문', []),
        'risk_summary': summarize.get('요약', ''),
    }
