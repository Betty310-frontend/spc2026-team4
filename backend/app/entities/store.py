from geoalchemy2 import Geometry
from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.entities.base import Base


class Store(Base):
    __tablename__ = 'geo_store_selected15'

    id: Mapped[str] = mapped_column('id', String(30), primary_key=True)
    name: Mapped[str | None] = mapped_column('name', Text)
    branch: Mapped[str | None] = mapped_column('branch', Text)

    category_large_code: Mapped[str | None] = mapped_column('category_large_code', String(10))
    category_large_name: Mapped[str | None] = mapped_column('category_large_name', Text)
    category_mid_code: Mapped[str | None] = mapped_column('category_mid_code', String(10))
    category_mid_name: Mapped[str | None] = mapped_column('category_mid_name', Text)
    category_small_code: Mapped[str | None] = mapped_column('category_small_code', String(10))
    category_small_name: Mapped[str | None] = mapped_column('category_small_name', Text)
    display_name: Mapped[str | None] = mapped_column('display_name', Text)

    gu_code: Mapped[str | None] = mapped_column('gu_code', String(10))
    gu_name: Mapped[str | None] = mapped_column('gu_name', Text)
    dong_code: Mapped[str | None] = mapped_column('dong_code', String(15))
    dong_name: Mapped[str | None] = mapped_column('dong_name', Text)

    address: Mapped[str | None] = mapped_column('address', Text)
    postal_code: Mapped[str | None] = mapped_column('postal_code', String(10))

    location: Mapped[object] = mapped_column(
        'location',
        Geometry('POINT', srid=4326, spatial_index=False),
        nullable=True,
    )

    __table_args__ = (
        Index('idx_geo_store_selected15_location', 'location', postgresql_using='gist'),
        Index('idx_geo_store_selected15_small_code', 'category_small_code'),
        Index('idx_geo_store_selected15_dong_code', 'dong_code'),
    )