"""생활인구·추정매출 조회 — static_data 메모리 룩업 (공간 쿼리 제외)."""

from typing import cast

from app.core.analysis_utils import calc_percentile
from app.services import static_data as sd


def get_monthly_avg_sales(
    dong_codes: list[str],
    sales_service_codes: tuple[str, ...],
) -> dict:
    """행정동×업종 기준 월평균 추정매출 + 시간대·주중/주말·성별·연령대 breakdown."""
    if not dong_codes or not sales_service_codes:
        return {}

    store = sd.get()
    rows = [
        store.sales_avg[(dong, ind)]
        for dong in dong_codes
        for ind in sales_service_codes
        if (dong, ind) in store.sales_avg
    ]
    if not rows:
        return {}

    def _avg(col: str) -> int | None:
        vals = [float(r[col]) for r in rows if r.get(col) is not None and r[col] != '']
        return int(sum(vals) / len(vals)) if vals else None

    slots = {
        '00~06': _avg('t_00_06'),
        '06~11': _avg('t_06_11'),
        '11~14': _avg('t_11_14'),
        '14~17': _avg('t_14_17'),
        '17~21': _avg('t_17_21'),
        '21~24': _avg('t_21_24'),
    }
    peak_slot = max(slots, key=lambda k: slots[k] or 0) if any(slots.values()) else None

    ages = {
        '10대': _avg('age_10'),
        '20대': _avg('age_20'),
        '30대': _avg('age_30'),
        '40대': _avg('age_40'),
        '50대': _avg('age_50'),
        '60대이상': _avg('age_60plus'),
    }
    top_age = max(ages, key=lambda k: ages[k] or 0) if any(ages.values()) else None

    return {
        'monthly_avg_sales_amt': _avg('monthly_avg_amt'),
        'monthly_avg_sales_cnt': _avg('monthly_avg_cnt'),
        'sales_by_timeslot': slots,
        'peak_sales_slot': peak_slot,
        'weekday_avg_amt': _avg('weekday_amt'),
        'weekend_avg_amt': _avg('weekend_amt'),
        'male_avg_amt': _avg('male_amt'),
        'female_avg_amt': _avg('female_amt'),
        'sales_by_age': ages,
        'top_sales_age': top_age,
    }


def get_population_flow(
    dong_codes: list[str],
    peak_hours: tuple[str, ...],
) -> dict:
    """행정동별 핵심 시간대 인구, 시간대별 분포, 성별·연령대 인구를 반환한다."""
    if not dong_codes:
        return {}

    store = sd.get()

    avg_peak: float | None = None
    if peak_hours:
        vals = [
            store.hourly_pop[(dong, slot)]
            for dong in dong_codes
            for slot in peak_hours
            if (dong, slot) in store.hourly_pop
        ]
        avg_peak = round(sum(vals) / len(vals), 1) if vals else None

    all_slots = sorted({slot for (_, slot) in store.hourly_pop})
    hourly = []
    for slot in all_slots:
        slot_vals = [
            store.hourly_pop[(dong, slot)]
            for dong in dong_codes
            if (dong, slot) in store.hourly_pop
        ]
        if slot_vals:
            hourly.append(
                {'hour': slot, 'avg_pop': round(sum(slot_vals) / len(slot_vals))}
            )
    peak_hour = (
        max(hourly, key=lambda x: cast(int, x['avg_pop']))['hour'] if hourly else None
    )

    demo_rows = [store.monthly_pop[d] for d in dong_codes if d in store.monthly_pop]

    def _f(col: str) -> float | None:
        vals = [
            float(r[col]) for r in demo_rows if r.get(col) is not None and r[col] != ''
        ]
        return round(sum(vals) / len(vals), 1) if vals else None

    raw_m = _f('avg_pop_M') or 0.0
    raw_f = _f('avg_pop_F') or 0.0
    gender_total = raw_m + raw_f
    male_ratio = round(raw_m / gender_total * 100, 1) if gender_total else None
    female_ratio = round(raw_f / gender_total * 100, 1) if gender_total else None

    ages = {
        '10대': _f('avg_age_10'),
        '20대': _f('avg_age_20'),
        '30대': _f('avg_age_30'),
        '40대': _f('avg_age_40'),
        '50대': _f('avg_age_50'),
        '60대이상': _f('avg_age_60plus'),
    }
    ages_filled = {k: (v or 0.0) for k, v in ages.items()}
    age_total = sum(ages_filled.values())
    pop_age_ratio = {
        k: round(v / age_total * 100, 1) if age_total else None
        for k, v in ages_filled.items()
    }
    top_pop_age = max(ages, key=lambda k: ages[k] or 0) if any(ages.values()) else None

    return {
        'avg_peak_population': avg_peak,
        'hourly_population': hourly,
        'peak_population_hour': peak_hour,
        'male_pop_ratio': male_ratio,
        'female_pop_ratio': female_ratio,
        'population_by_age_ratio': pop_age_ratio,
        'top_population_age': top_pop_age,
    }


def get_population_hourly_by_dong(
    dong_code: str,
    peak_hours: tuple[str, ...],
    sample_hours: tuple[str, ...] = ('09', '11', '14', '17', '20'),
) -> dict:
    """단일 행정동 기준 가중평균 생활인구와 시간대별 샘플 데이터를 반환한다."""
    if not peak_hours:
        return {'weighted_avg': None, 'data': []}

    store = sd.get()

    peak_vals = [
        store.hourly_pop[(dong_code, slot)]
        for slot in peak_hours
        if (dong_code, slot) in store.hourly_pop
    ]
    weighted_avg = round(sum(peak_vals) / len(peak_vals), 1) if peak_vals else None

    data = [
        {'hour': slot, 'count': round(store.hourly_pop[(dong_code, slot)])}
        for slot in sample_hours
        if (dong_code, slot) in store.hourly_pop
    ]

    return {'weighted_avg': weighted_avg, 'data': data}


def get_all_dong_population_avgs(peak_hours: tuple[str, ...]) -> list[float]:
    """서울 전체 행정동의 peak_hours 기준 평균 생활인구 목록을 반환한다 (퍼센타일 기준값용)."""
    store = sd.get()
    if not peak_hours:
        return store.dong_pop_list
    all_dongs = {dong for (dong, _) in store.hourly_pop}
    result = []
    for dong in all_dongs:
        vals = [
            store.hourly_pop[(dong, s)]
            for s in peak_hours
            if (dong, s) in store.hourly_pop
        ]
        if vals:
            result.append(sum(vals) / len(vals))
    return result


def get_population_flow_percentile(avg_peak_pop: float | None) -> int:
    """핵심 시간대 평균 생활인구의 서울 전체 퍼센타일(0~100)을 반환한다."""
    if avg_peak_pop is None:
        return 0
    return calc_percentile(avg_peak_pop, sd.get().dong_pop_list)


def get_sales_trend(
    dong_codes: list[str],
    sales_service_codes: tuple[str, ...],
) -> dict:
    """행정동×업종 YoY 매출 추세를 반환한다."""
    if not dong_codes or not sales_service_codes:
        return {'trend_rate': None, 'trend_direction': 'unknown'}
    store = sd.get()
    rows = [
        store.sales_trend[(dong, ind)]
        for dong in dong_codes
        for ind in sales_service_codes
        if (dong, ind) in store.sales_trend
    ]
    if not rows:
        return {'trend_rate': None, 'trend_direction': 'unknown'}
    rates = [float(r['trend_rate']) for r in rows if r.get('trend_rate')]
    if not rates:
        return {'trend_rate': None, 'trend_direction': 'unknown'}
    avg_rate = sum(rates) / len(rates)
    direction = 'up' if avg_rate > 0.03 else 'down' if avg_rate < -0.03 else 'stable'
    return {'trend_rate': round(avg_rate, 4), 'trend_direction': direction}


def get_data_reference_month() -> str:
    """생활인구 데이터의 기준 연월(YYYY-MM)을 반환한다."""
    return sd.get().data_ref_month
