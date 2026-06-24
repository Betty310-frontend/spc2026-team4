from sqlalchemy import Index, Numeric, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.entities.base import Base


class MvLocalPeopleMonthly(Base):
    """mv_local_people_monthly — 월별 동별 평균 생활인구 (14,840행)."""

    __tablename__ = 'mv_local_people_monthly'

    year_month: Mapped[str] = mapped_column(String(6), primary_key=True)  # YYYYMM
    dong_code: Mapped[str] = mapped_column(String(10), primary_key=True)

    avg_total_pop: Mapped[float | None] = mapped_column(Numeric(12, 2))
    avg_pop_m: Mapped[float | None] = mapped_column(Numeric(12, 2))
    avg_pop_f: Mapped[float | None] = mapped_column(Numeric(12, 2))

    avg_age_0to9: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_10: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_20: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_30: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_40: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_50: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_60plus: Mapped[float | None] = mapped_column(Numeric(10, 2))

    __table_args__ = (Index('idx_mv_pop_monthly', 'year_month', 'dong_code'),)


class MvLocalPeopleQuarterly(Base):
    """mv_local_people_quarterly — 분기별 동별 평균 생활인구 (5,088행)."""

    __tablename__ = 'mv_local_people_quarterly'

    year: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    quarter: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    dong_code: Mapped[str] = mapped_column(String(10), primary_key=True)

    avg_total_pop: Mapped[float | None] = mapped_column(Numeric(12, 2))
    avg_pop_m: Mapped[float | None] = mapped_column(Numeric(12, 2))
    avg_pop_f: Mapped[float | None] = mapped_column(Numeric(12, 2))

    avg_age_0to9: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_10: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_20: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_30: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_40: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_50: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avg_age_60plus: Mapped[float | None] = mapped_column(Numeric(10, 2))

    __table_args__ = (Index('idx_mv_pop_quarterly', 'year', 'quarter', 'dong_code'),)
