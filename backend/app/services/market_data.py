"""생활인구·추정매출 조회 — 클라우드 DB 직접 쿼리."""

from typing import cast

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_monthly_avg_sales(
    db: AsyncSession,
    dong_codes: list[str],
    sales_service_codes: tuple[str, ...],
) -> dict:
    """행정동×업종 기준 월평균 추정매출 + 시간대·주중/주말·성별·연령대 breakdown."""
    if not dong_codes or not sales_service_codes:
        return {}

    result = await db.execute(
        text("""
            SELECT *
            FROM sales_avg_by_dong_industry
            WHERE dong_code = ANY(:dong_codes)
              AND industry_code = ANY(:codes)
        """),
        {'dong_codes': dong_codes, 'codes': list(sales_service_codes)},
    )
    rows = [dict(r._mapping) for r in result]
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


async def get_population_flow(
    db: AsyncSession,
    dong_codes: list[str],
    peak_hours: tuple[str, ...],
) -> dict:
    """행정동별 핵심 시간대 인구, 시간대별 분포, 성별·연령대 인구를 반환한다."""
    if not dong_codes:
        return {}

    hourly_result = await db.execute(
        text("""
            SELECT dong_code, time_slot, avg_total_pop
            FROM local_people_hourly
            WHERE dong_code = ANY(:dong_codes)
        """),
        {'dong_codes': dong_codes},
    )
    hourly_pop: dict[tuple[str, str], float] = {
        (r.dong_code, r.time_slot): float(r.avg_total_pop) for r in hourly_result
    }

    avg_peak: float | None = None
    if peak_hours:
        vals = [
            hourly_pop[(dong, slot)]
            for dong in dong_codes
            for slot in peak_hours
            if (dong, slot) in hourly_pop
        ]
        avg_peak = round(sum(vals) / len(vals), 1) if vals else None

    all_slots = sorted({slot for (_, slot) in hourly_pop})
    hourly = []
    for slot in all_slots:
        slot_vals = [
            hourly_pop[(dong, slot)]
            for dong in dong_codes
            if (dong, slot) in hourly_pop
        ]
        if slot_vals:
            hourly.append(
                {'hour': slot, 'avg_pop': round(sum(slot_vals) / len(slot_vals))}
            )
    peak_hour = (
        max(hourly, key=lambda x: cast(int, x['avg_pop']))['hour'] if hourly else None
    )

    demo_result = await db.execute(
        text("""
            SELECT DISTINCT ON (dong_code)
                dong_code, avg_pop_m, avg_pop_f,
                avg_age_10, avg_age_20, avg_age_30,
                avg_age_40, avg_age_50, avg_age_60plus
            FROM mv_local_people_monthly
            WHERE dong_code = ANY(:dong_codes)
            ORDER BY dong_code, year_month DESC
        """),
        {'dong_codes': dong_codes},
    )
    demo_rows = [dict(r._mapping) for r in demo_result]

    def _f(col: str) -> float | None:
        vals = [
            float(r[col]) for r in demo_rows if r.get(col) is not None and r[col] != ''
        ]
        return round(sum(vals) / len(vals), 1) if vals else None

    raw_m = _f('avg_pop_m') or 0.0
    raw_f = _f('avg_pop_f') or 0.0
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


async def get_peak_sales_slot_by_dong(
    db: AsyncSession,
    dong_code: str,
    sales_service_codes: tuple[str, ...],
) -> str | None:
    """행정동×업종 기준 매출이 가장 높은 시간대 구간을 반환한다."""
    if not sales_service_codes:
        return None

    result = await db.execute(
        text("""
            SELECT t_00_06, t_06_11, t_11_14, t_14_17, t_17_21, t_21_24
            FROM sales_avg_by_dong_industry
            WHERE dong_code = :dong_code
              AND industry_code = ANY(:codes)
        """),
        {'dong_code': dong_code, 'codes': list(sales_service_codes)},
    )
    rows = [dict(r._mapping) for r in result]
    if not rows:
        return None

    def _avg(col: str) -> float:
        vals = [float(r[col]) for r in rows if r.get(col) is not None and r[col] != '']
        return sum(vals) / len(vals) if vals else 0.0

    slots = {
        '00~06': _avg('t_00_06'),
        '06~11': _avg('t_06_11'),
        '11~14': _avg('t_11_14'),
        '14~17': _avg('t_14_17'),
        '17~21': _avg('t_17_21'),
        '21~24': _avg('t_21_24'),
    }
    return max(slots, key=lambda k: slots[k]) if any(slots.values()) else None


async def get_population_hourly_by_dong(
    db: AsyncSession,
    dong_code: str,
    peak_hours: tuple[str, ...],
    sample_hours: tuple[str, ...] = ('09', '11', '14', '17', '20'),
) -> dict:
    """단일 행정동 기준 가중평균 생활인구와 시간대별 샘플 데이터를 반환한다."""
    if not peak_hours:
        return {'weighted_avg': None, 'data': []}

    result = await db.execute(
        text("""
            SELECT time_slot, avg_total_pop
            FROM local_people_hourly
            WHERE dong_code = :dong_code
        """),
        {'dong_code': dong_code},
    )
    hourly_pop: dict[str, float] = {r.time_slot: float(r.avg_total_pop) for r in result}

    peak_vals = [hourly_pop[slot] for slot in peak_hours if slot in hourly_pop]
    weighted_avg = round(sum(peak_vals) / len(peak_vals), 1) if peak_vals else None

    data = [
        {'hour': slot, 'count': round(hourly_pop[slot])}
        for slot in sample_hours
        if slot in hourly_pop
    ]

    return {'weighted_avg': weighted_avg, 'data': data}


async def get_all_dong_population_avgs(
    db: AsyncSession,
    peak_hours: tuple[str, ...],
) -> list[float]:
    """서울 전체 행정동의 peak_hours 기준 평균 생활인구 목록을 반환한다 (퍼센타일 기준값용)."""
    if not peak_hours:
        result = await db.execute(
            text("""
                SELECT dong_code, AVG(avg_total_pop) AS avg_pop
                FROM local_people_hourly
                GROUP BY dong_code
            """)
        )
    else:
        result = await db.execute(
            text("""
                SELECT dong_code, AVG(avg_total_pop) AS avg_pop
                FROM local_people_hourly
                WHERE time_slot = ANY(:slots)
                GROUP BY dong_code
            """),
            {'slots': list(peak_hours)},
        )
    return [float(r.avg_pop) for r in result]


async def get_data_reference_month(db: AsyncSession) -> str:
    """생활인구 데이터의 기준 연월(YYYY-MM)을 반환한다."""
    result = await db.execute(
        text('SELECT MAX(year_month) AS latest FROM mv_local_people_monthly')
    )
    row = result.one_or_none()
    if row and row.latest:
        ym = str(row.latest)
        return f'{ym[:4]}-{ym[4:]}'
    return '2025-12'
