"""생활인구·추정매출 DB 조회 서비스."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.entities.local_people import LocalPeople
from app.entities.mv_local_people import MvLocalPeopleMonthly
from app.entities.sales import SeoulSales


async def get_monthly_avg_sales(
    session: AsyncSession,
    dong_codes: list[str],
    sales_service_codes: tuple[str, ...],
) -> dict:
    """행정동 코드 기준 월평균 추정매출 + 시간대·주중/주말·성별·연령대 breakdown을 반환한다."""
    if not dong_codes or not sales_service_codes:
        return {}

    def _d3(col):  # 분기 합계 → 월평균
        return func.avg(col) / 3

    stmt = select(
        _d3(SeoulSales.monthly_sales_amt).label('monthly_avg_amt'),
        _d3(SeoulSales.monthly_sales_cnt).label('monthly_avg_cnt'),
        _d3(SeoulSales.hour_00_06_sales_amt).label('t_00_06'),
        _d3(SeoulSales.hour_06_11_sales_amt).label('t_06_11'),
        _d3(SeoulSales.hour_11_14_sales_amt).label('t_11_14'),
        _d3(SeoulSales.hour_14_17_sales_amt).label('t_14_17'),
        _d3(SeoulSales.hour_17_21_sales_amt).label('t_17_21'),
        _d3(SeoulSales.hour_21_24_sales_amt).label('t_21_24'),
        _d3(SeoulSales.weekday_sales_amt).label('weekday_amt'),
        _d3(SeoulSales.weekend_sales_amt).label('weekend_amt'),
        _d3(SeoulSales.male_sales_amt).label('male_amt'),
        _d3(SeoulSales.female_sales_amt).label('female_amt'),
        _d3(SeoulSales.age_10_sales_amt).label('age_10'),
        _d3(SeoulSales.age_20_sales_amt).label('age_20'),
        _d3(SeoulSales.age_30_sales_amt).label('age_30'),
        _d3(SeoulSales.age_40_sales_amt).label('age_40'),
        _d3(SeoulSales.age_50_sales_amt).label('age_50'),
        _d3(SeoulSales.age_60_plus_sales_amt).label('age_60plus'),
    ).where(
        SeoulSales.dong_code.in_(dong_codes),
        SeoulSales.service_code.in_(sales_service_codes),
    )
    row = (await session.execute(stmt)).one()

    def _int(v) -> int | None:
        return int(v) if v else None

    slots = {
        '00~06': _int(row.t_00_06),
        '06~11': _int(row.t_06_11),
        '11~14': _int(row.t_11_14),
        '14~17': _int(row.t_14_17),
        '17~21': _int(row.t_17_21),
        '21~24': _int(row.t_21_24),
    }
    peak_slot = max(slots, key=lambda k: slots[k] or 0) if any(slots.values()) else None

    ages = {
        '10대': _int(row.age_10),
        '20대': _int(row.age_20),
        '30대': _int(row.age_30),
        '40대': _int(row.age_40),
        '50대': _int(row.age_50),
        '60대이상': _int(row.age_60plus),
    }
    top_age = max(ages, key=lambda k: ages[k] or 0) if any(ages.values()) else None

    return {
        'monthly_avg_sales_amt': _int(row.monthly_avg_amt),
        'monthly_avg_sales_cnt': _int(row.monthly_avg_cnt),
        'sales_by_timeslot': slots,
        'peak_sales_slot': peak_slot,
        'weekday_avg_amt': _int(row.weekday_amt),
        'weekend_avg_amt': _int(row.weekend_amt),
        'male_avg_amt': _int(row.male_amt),
        'female_avg_amt': _int(row.female_amt),
        'sales_by_age': ages,
        'top_sales_age': top_age,
    }


async def get_population_flow(
    session: AsyncSession,
    dong_codes: list[str],
    peak_hours: tuple[str, ...],
) -> dict:
    """행정동별 핵심 시간대 인구, 시간대별 분포, 성별·연령대 인구를 반환한다."""
    if not dong_codes:
        return {}

    avg_peak: float | None = None
    if peak_hours:
        peak_stmt = select(func.avg(LocalPeople.total).label('avg_pop')).where(
            LocalPeople.dong_code.in_(dong_codes),
            LocalPeople.time_slot.in_(peak_hours),
        )
        peak_row = (await session.execute(peak_stmt)).one()
        avg_peak = round(float(peak_row.avg_pop), 1) if peak_row.avg_pop else None

    hourly_stmt = (
        select(LocalPeople.time_slot, func.avg(LocalPeople.total).label('avg_pop'))
        .where(LocalPeople.dong_code.in_(dong_codes))
        .group_by(LocalPeople.time_slot)
        .order_by(LocalPeople.time_slot)
    )
    hourly_rows = (await session.execute(hourly_stmt)).all()
    hourly = [
        {'hour': r.time_slot, 'avg_pop': round(float(r.avg_pop))}
        for r in hourly_rows
        if r.avg_pop
    ]
    peak_hour = max(hourly, key=lambda x: x['avg_pop'])['hour'] if hourly else None

    latest_month_subq = select(
        func.max(MvLocalPeopleMonthly.year_month)
    ).scalar_subquery()
    demo_stmt = select(
        func.avg(MvLocalPeopleMonthly.avg_pop_m).label('pop_m'),
        func.avg(MvLocalPeopleMonthly.avg_pop_f).label('pop_f'),
        func.avg(MvLocalPeopleMonthly.avg_age_10).label('age_10'),
        func.avg(MvLocalPeopleMonthly.avg_age_20).label('age_20'),
        func.avg(MvLocalPeopleMonthly.avg_age_30).label('age_30'),
        func.avg(MvLocalPeopleMonthly.avg_age_40).label('age_40'),
        func.avg(MvLocalPeopleMonthly.avg_age_50).label('age_50'),
        func.avg(MvLocalPeopleMonthly.avg_age_60plus).label('age_60plus'),
    ).where(
        MvLocalPeopleMonthly.year_month == latest_month_subq,
        MvLocalPeopleMonthly.dong_code.in_(dong_codes),
    )
    demo_row = (await session.execute(demo_stmt)).one()

    def _f(v) -> float | None:
        return round(float(v), 1) if v else None

    raw_m = float(demo_row.pop_m) if demo_row.pop_m else 0.0
    raw_f = float(demo_row.pop_f) if demo_row.pop_f else 0.0
    gender_total = raw_m + raw_f
    male_ratio = round(raw_m / gender_total * 100, 1) if gender_total else None
    female_ratio = round(raw_f / gender_total * 100, 1) if gender_total else None

    ages = {
        '10대': _f(demo_row.age_10),
        '20대': _f(demo_row.age_20),
        '30대': _f(demo_row.age_30),
        '40대': _f(demo_row.age_40),
        '50대': _f(demo_row.age_50),
        '60대이상': _f(demo_row.age_60plus),
    }
    age_total = sum(v for v in ages.values() if v)
    population_by_age_ratio = {
        k: round(v / age_total * 100, 1) if (v and age_total) else None
        for k, v in ages.items()
    }
    top_pop_age = max(ages, key=lambda k: ages[k] or 0) if any(ages.values()) else None

    return {
        'avg_peak_population': avg_peak,
        'hourly_population': hourly,
        'peak_population_hour': peak_hour,
        'male_pop_ratio': male_ratio,
        'female_pop_ratio': female_ratio,
        'population_by_age_ratio': population_by_age_ratio,
        'top_population_age': top_pop_age,
    }


async def get_population_hourly_by_dong(
    session: AsyncSession,
    dong_code: str,
    peak_hours: tuple[str, ...],
    sample_hours: tuple[str, ...] = ('09', '11', '14', '17', '20'),
) -> dict:
    """단일 행정동 기준 가중평균 생활인구와 시간대별 샘플 데이터를 반환한다."""
    if not peak_hours:
        return {'weighted_avg': None, 'data': []}

    weighted_stmt = select(func.avg(LocalPeople.total).label('avg_pop')).where(
        LocalPeople.dong_code == dong_code,
        LocalPeople.time_slot.in_(peak_hours),
    )
    row = (await session.execute(weighted_stmt)).one()
    weighted_avg = round(float(row.avg_pop), 1) if row.avg_pop else None

    hourly_stmt = (
        select(
            LocalPeople.time_slot,
            func.avg(LocalPeople.total).label('avg_pop'),
        )
        .where(
            LocalPeople.dong_code == dong_code,
            LocalPeople.time_slot.in_(sample_hours),
        )
        .group_by(LocalPeople.time_slot)
        .order_by(LocalPeople.time_slot)
    )
    rows = (await session.execute(hourly_stmt)).all()
    data = [
        {'hour': r.time_slot, 'count': round(float(r.avg_pop))}
        for r in rows
        if r.avg_pop
    ]

    return {'weighted_avg': weighted_avg, 'data': data}


async def get_all_dong_population_avgs(
    session: AsyncSession,
    peak_hours: tuple[str, ...],
) -> list[float]:
    """서울 전체 행정동의 평균 생활인구 목록을 반환한다 (퍼센타일 기준값용).

    mv_local_people_monthly(14,840행)를 사용해 raw_local_people(10M행) 풀스캔을 회피.
    가장 최근 연월 기준 동별 1개 값을 반환한다.
    """
    latest_month_subq = select(
        func.max(MvLocalPeopleMonthly.year_month)
    ).scalar_subquery()
    stmt = select(MvLocalPeopleMonthly.avg_total_pop).where(
        MvLocalPeopleMonthly.year_month == latest_month_subq,
        MvLocalPeopleMonthly.avg_total_pop.isnot(None),
    )
    rows = (await session.execute(stmt)).all()
    return [float(r.avg_total_pop) for r in rows]
