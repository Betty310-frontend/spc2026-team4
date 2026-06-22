from sqlalchemy import BigInteger, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.entities.base import Base


class SeoulSales(Base):
    __tablename__ = 'seoul_sales'

    quarter_code: Mapped[str] = mapped_column(String(10), primary_key=True)
    dong_code: Mapped[str] = mapped_column(String(15), primary_key=True)
    service_code: Mapped[str] = mapped_column(String(20), primary_key=True)

    dong_name: Mapped[str | None] = mapped_column(Text)
    service_name: Mapped[str | None] = mapped_column(Text)

    monthly_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    monthly_sales_cnt: Mapped[int | None] = mapped_column(Integer)

    weekday_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    weekend_sales_amt: Mapped[int | None] = mapped_column(BigInteger)

    mon_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    tue_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    wed_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    thu_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    fri_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    sat_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    sun_sales_amt: Mapped[int | None] = mapped_column(BigInteger)

    hour_00_06_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    hour_06_11_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    hour_11_14_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    hour_14_17_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    hour_17_21_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    hour_21_24_sales_amt: Mapped[int | None] = mapped_column(BigInteger)

    male_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    female_sales_amt: Mapped[int | None] = mapped_column(BigInteger)

    age_10_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    age_20_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    age_30_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    age_40_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    age_50_sales_amt: Mapped[int | None] = mapped_column(BigInteger)
    age_60_plus_sales_amt: Mapped[int | None] = mapped_column(BigInteger)

    weekday_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    weekend_sales_cnt: Mapped[int | None] = mapped_column(Integer)

    mon_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    tue_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    wed_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    thu_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    fri_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    sat_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    sun_sales_cnt: Mapped[int | None] = mapped_column(Integer)

    hour_00_06_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    hour_06_11_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    hour_11_14_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    hour_14_17_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    hour_17_21_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    hour_21_24_sales_cnt: Mapped[int | None] = mapped_column(Integer)

    male_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    female_sales_cnt: Mapped[int | None] = mapped_column(Integer)

    age_10_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    age_20_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    age_30_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    age_40_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    age_50_sales_cnt: Mapped[int | None] = mapped_column(Integer)
    age_60_plus_sales_cnt: Mapped[int | None] = mapped_column(Integer)

    __table_args__ = (
        Index('ix_seoul_sales_dong_code', 'dong_code'),
        Index('ix_seoul_sales_service_code', 'service_code'),
        Index('ix_seoul_sales_quarter', 'quarter_code'),
    )
