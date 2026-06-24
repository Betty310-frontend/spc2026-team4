from sqlalchemy import BigInteger, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.entities.base import Base


class SeoulSales(Base):
    __tablename__ = 'raw_sales'

    quarter_code: Mapped[str] = mapped_column(String(10), primary_key=True)
    dong_code: Mapped[str] = mapped_column(String(10), primary_key=True)
    service_code: Mapped[str] = mapped_column(
        'industry_code', String(20), primary_key=True
    )

    dong_name: Mapped[str | None] = mapped_column(Text)
    service_name: Mapped[str | None] = mapped_column('industry_name', Text)

    monthly_sales_amt: Mapped[int | None] = mapped_column('sales_amount', BigInteger)
    monthly_sales_cnt: Mapped[int | None] = mapped_column('sales_count', Integer)

    weekday_sales_amt: Mapped[int | None] = mapped_column('weekday_amount', BigInteger)
    weekend_sales_amt: Mapped[int | None] = mapped_column('weekend_amount', BigInteger)

    mon_sales_amt: Mapped[int | None] = mapped_column('mon_amount', BigInteger)
    tue_sales_amt: Mapped[int | None] = mapped_column('tue_amount', BigInteger)
    wed_sales_amt: Mapped[int | None] = mapped_column('wed_amount', BigInteger)
    thu_sales_amt: Mapped[int | None] = mapped_column('thu_amount', BigInteger)
    fri_sales_amt: Mapped[int | None] = mapped_column('fri_amount', BigInteger)
    sat_sales_amt: Mapped[int | None] = mapped_column('sat_amount', BigInteger)
    sun_sales_amt: Mapped[int | None] = mapped_column('sun_amount', BigInteger)

    hour_00_06_sales_amt: Mapped[int | None] = mapped_column(
        'time_00_06_amount', BigInteger
    )
    hour_06_11_sales_amt: Mapped[int | None] = mapped_column(
        'time_06_11_amount', BigInteger
    )
    hour_11_14_sales_amt: Mapped[int | None] = mapped_column(
        'time_11_14_amount', BigInteger
    )
    hour_14_17_sales_amt: Mapped[int | None] = mapped_column(
        'time_14_17_amount', BigInteger
    )
    hour_17_21_sales_amt: Mapped[int | None] = mapped_column(
        'time_17_21_amount', BigInteger
    )
    hour_21_24_sales_amt: Mapped[int | None] = mapped_column(
        'time_21_24_amount', BigInteger
    )

    male_sales_amt: Mapped[int | None] = mapped_column('male_amount', BigInteger)
    female_sales_amt: Mapped[int | None] = mapped_column('female_amount', BigInteger)

    age_10_sales_amt: Mapped[int | None] = mapped_column('age10_amount', BigInteger)
    age_20_sales_amt: Mapped[int | None] = mapped_column('age20_amount', BigInteger)
    age_30_sales_amt: Mapped[int | None] = mapped_column('age30_amount', BigInteger)
    age_40_sales_amt: Mapped[int | None] = mapped_column('age40_amount', BigInteger)
    age_50_sales_amt: Mapped[int | None] = mapped_column('age50_amount', BigInteger)
    age_60_plus_sales_amt: Mapped[int | None] = mapped_column(
        'age60plus_amount', BigInteger
    )

    weekday_sales_cnt: Mapped[int | None] = mapped_column('weekday_count', Integer)
    weekend_sales_cnt: Mapped[int | None] = mapped_column('weekend_count', Integer)

    mon_sales_cnt: Mapped[int | None] = mapped_column('mon_count', Integer)
    tue_sales_cnt: Mapped[int | None] = mapped_column('tue_count', Integer)
    wed_sales_cnt: Mapped[int | None] = mapped_column('wed_count', Integer)
    thu_sales_cnt: Mapped[int | None] = mapped_column('thu_count', Integer)
    fri_sales_cnt: Mapped[int | None] = mapped_column('fri_count', Integer)
    sat_sales_cnt: Mapped[int | None] = mapped_column('sat_count', Integer)
    sun_sales_cnt: Mapped[int | None] = mapped_column('sun_count', Integer)

    hour_00_06_sales_cnt: Mapped[int | None] = mapped_column(
        'time_00_06_count', Integer
    )
    hour_06_11_sales_cnt: Mapped[int | None] = mapped_column(
        'time_06_11_count', Integer
    )
    hour_11_14_sales_cnt: Mapped[int | None] = mapped_column(
        'time_11_14_count', Integer
    )
    hour_14_17_sales_cnt: Mapped[int | None] = mapped_column(
        'time_14_17_count', Integer
    )
    hour_17_21_sales_cnt: Mapped[int | None] = mapped_column(
        'time_17_21_count', Integer
    )
    hour_21_24_sales_cnt: Mapped[int | None] = mapped_column(
        'time_21_24_count', Integer
    )

    male_sales_cnt: Mapped[int | None] = mapped_column('male_count', Integer)
    female_sales_cnt: Mapped[int | None] = mapped_column('female_count', Integer)

    age_10_sales_cnt: Mapped[int | None] = mapped_column('age10_count', Integer)
    age_20_sales_cnt: Mapped[int | None] = mapped_column('age20_count', Integer)
    age_30_sales_cnt: Mapped[int | None] = mapped_column('age30_count', Integer)
    age_40_sales_cnt: Mapped[int | None] = mapped_column('age40_count', Integer)
    age_50_sales_cnt: Mapped[int | None] = mapped_column('age50_count', Integer)
    age_60_plus_sales_cnt: Mapped[int | None] = mapped_column(
        'age60plus_count', Integer
    )

    year: Mapped[int | None] = mapped_column('year', Integer)
    quarter: Mapped[int | None] = mapped_column('quarter', Integer)

    __table_args__ = (
        Index('idx_raw_sales_dong_industry', 'dong_code', 'industry_code'),
        Index('idx_raw_sales_quarter', 'quarter_code'),
    )
