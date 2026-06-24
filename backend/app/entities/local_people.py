from sqlalchemy import Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.entities.base import Base


class LocalPeople(Base):
    __tablename__ = 'raw_local_people'

    date_id: Mapped[str] = mapped_column(String(8), primary_key=True)  # YYYYMMDD
    time_slot: Mapped[str] = mapped_column(String(2), primary_key=True)  # 00~23
    dong_code: Mapped[str] = mapped_column(String(10), primary_key=True)

    total: Mapped[float | None] = mapped_column('total_pop', Numeric(12, 4))

    # 남성 연령대
    male_0_9: Mapped[float | None] = mapped_column('m_age_0to9', Numeric(10, 4))
    male_10_14: Mapped[float | None] = mapped_column('m_age_10to14', Numeric(10, 4))
    male_15_19: Mapped[float | None] = mapped_column('m_age_15to19', Numeric(10, 4))
    male_20_24: Mapped[float | None] = mapped_column('m_age_20to24', Numeric(10, 4))
    male_25_29: Mapped[float | None] = mapped_column('m_age_25to29', Numeric(10, 4))
    male_30_34: Mapped[float | None] = mapped_column('m_age_30to34', Numeric(10, 4))
    male_35_39: Mapped[float | None] = mapped_column('m_age_35to39', Numeric(10, 4))
    male_40_44: Mapped[float | None] = mapped_column('m_age_40to44', Numeric(10, 4))
    male_45_49: Mapped[float | None] = mapped_column('m_age_45to49', Numeric(10, 4))
    male_50_54: Mapped[float | None] = mapped_column('m_age_50to54', Numeric(10, 4))
    male_55_59: Mapped[float | None] = mapped_column('m_age_55to59', Numeric(10, 4))
    male_60_64: Mapped[float | None] = mapped_column('m_age_60to64', Numeric(10, 4))
    male_65_69: Mapped[float | None] = mapped_column('m_age_65to69', Numeric(10, 4))
    male_70_plus: Mapped[float | None] = mapped_column('m_age_70plus', Numeric(10, 4))

    # 여성 연령대
    female_0_9: Mapped[float | None] = mapped_column('f_age_0to9', Numeric(10, 4))
    female_10_14: Mapped[float | None] = mapped_column('f_age_10to14', Numeric(10, 4))
    female_15_19: Mapped[float | None] = mapped_column('f_age_15to19', Numeric(10, 4))
    female_20_24: Mapped[float | None] = mapped_column('f_age_20to24', Numeric(10, 4))
    female_25_29: Mapped[float | None] = mapped_column('f_age_25to29', Numeric(10, 4))
    female_30_34: Mapped[float | None] = mapped_column('f_age_30to34', Numeric(10, 4))
    female_35_39: Mapped[float | None] = mapped_column('f_age_35to39', Numeric(10, 4))
    female_40_44: Mapped[float | None] = mapped_column('f_age_40to44', Numeric(10, 4))
    female_45_49: Mapped[float | None] = mapped_column('f_age_45to49', Numeric(10, 4))
    female_50_54: Mapped[float | None] = mapped_column('f_age_50to54', Numeric(10, 4))
    female_55_59: Mapped[float | None] = mapped_column('f_age_55to59', Numeric(10, 4))
    female_60_64: Mapped[float | None] = mapped_column('f_age_60to64', Numeric(10, 4))
    female_65_69: Mapped[float | None] = mapped_column('f_age_65to69', Numeric(10, 4))
    female_70_plus: Mapped[float | None] = mapped_column('f_age_70plus', Numeric(10, 4))

    __table_args__ = (Index('idx_raw_pop_dong_slot', 'dong_code', 'time_slot'),)
