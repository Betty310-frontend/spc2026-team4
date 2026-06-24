from geoalchemy2 import Geometry
from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.entities.base import Base


class Store(Base):
    __tablename__ = 'raw_sosang'

    id: Mapped[str] = mapped_column('store_id', String(30), primary_key=True)
    name: Mapped[str] = mapped_column('store_name', Text, nullable=False)
    branch: Mapped[str | None] = mapped_column('branch_name', Text)

    category_large_code: Mapped[str | None] = mapped_column('major_code', String(20))
    category_large_name: Mapped[str | None] = mapped_column('major_name', Text)
    category_mid_code: Mapped[str | None] = mapped_column('middle_code', String(20))
    category_mid_name: Mapped[str | None] = mapped_column('middle_name', Text)
    category_small_code: Mapped[str | None] = mapped_column('minor_code', String(20))
    category_small_name: Mapped[str | None] = mapped_column('minor_name', Text)

    gu_code: Mapped[str | None] = mapped_column('sigungu_code', String(10))
    gu_name: Mapped[str | None] = mapped_column('sigungu_name', Text)
    dong_code: Mapped[str | None] = mapped_column('dong_code', String(10))
    dong_name: Mapped[str | None] = mapped_column('dong_name', Text)

    address: Mapped[str | None] = mapped_column('address', Text)
    postal_code: Mapped[str | None] = mapped_column('postal_code', String(10))

    # PostGIS POINT (경도, 위도) — SRID 4326 (WGS84)
    location: Mapped[object] = mapped_column(
        'geom', Geometry('POINT', srid=4326, spatial_index=False), nullable=True
    )

    __table_args__ = (
        Index('idx_sosang_geom', 'geom', postgresql_using='gist'),
        Index('idx_sosang_middle', 'middle_code'),
        Index('ix_sosang_dong_code', 'dong_code'),
    )
