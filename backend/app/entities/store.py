from geoalchemy2 import Geometry
from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.entities.base import Base


class Store(Base):
    __tablename__ = 'geo_store'

    id: Mapped[str] = mapped_column(String(30), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    branch: Mapped[str | None] = mapped_column(Text)

    category_large_code: Mapped[str | None] = mapped_column(String(10))
    category_large_name: Mapped[str | None] = mapped_column(Text)
    category_mid_code: Mapped[str | None] = mapped_column(String(10))
    category_mid_name: Mapped[str | None] = mapped_column(Text)
    category_small_code: Mapped[str | None] = mapped_column(String(10))
    category_small_name: Mapped[str | None] = mapped_column(Text)

    gu_code: Mapped[str | None] = mapped_column(String(10))
    gu_name: Mapped[str | None] = mapped_column(Text)
    dong_code: Mapped[str | None] = mapped_column(String(15))
    dong_name: Mapped[str | None] = mapped_column(Text)

    address: Mapped[str | None] = mapped_column(Text)
    postal_code: Mapped[str | None] = mapped_column(String(10))

    # PostGIS POINT (경도, 위도) — SRID 4326 (WGS84)
    location: Mapped[object] = mapped_column(
        Geometry('POINT', srid=4326, spatial_index=False), nullable=False
    )

    __table_args__ = (
        Index('ix_geo_store_location', 'location', postgresql_using='gist'),
        Index('ix_geo_store_category_small', 'category_small_code'),
        Index('ix_geo_store_dong_code', 'dong_code'),
    )
