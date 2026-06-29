CREATE TABLE IF NOT EXISTS raw_sosang (
    store_id      VARCHAR(30)   NOT NULL,
    store_name    VARCHAR(200),
    branch_name   VARCHAR(100),
    major_code    VARCHAR(20),
    major_name    VARCHAR(100),
    middle_code   VARCHAR(20),
    middle_name   VARCHAR(100),
    minor_code    VARCHAR(20),
    minor_name    VARCHAR(100),
    sigungu_code  VARCHAR(10),
    sigungu_name  VARCHAR(100),
    dong_code     VARCHAR(10),
    dong_name     VARCHAR(100),
    road_name     VARCHAR(200),
    building_name VARCHAR(200),
    address       VARCHAR(300),
    postal_code   VARCHAR(10),
    longitude     NUMERIC(15, 10),
    latitude      NUMERIC(15, 10),
    geom          GEOMETRY(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_sosang_geom   ON raw_sosang USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_sosang_geog   ON raw_sosang USING GIST ((geom::geography));
CREATE INDEX IF NOT EXISTS idx_sosang_middle ON raw_sosang (middle_code);
CREATE INDEX IF NOT EXISTS ix_sosang_dong_code ON raw_sosang (dong_code);
