import csv
import time
from pathlib import Path
import asyncpg
from app.core.database import get_engine

BATCH_SIZE = 5_000

INSERT_SQL = """
INSERT INTO geo_store (
    id, name, branch,
    category_large_code, category_large_name,
    category_mid_code,   category_mid_name,
    category_small_code, category_small_name,
    gu_code, gu_name,
    dong_code, dong_name,
    address, postal_code,
    location
) VALUES (
    $1, $2, $3,
    $4, $5, $6, $7, $8, $9,
    $10, $11, $12, $13,
    $14, $15,
    ST_SetSRID(ST_MakePoint($16, $17), 4326)
)
ON CONFLICT (id) DO NOTHING
"""


def _row_to_tuple(row: dict) -> tuple | None:
    try:
        lng = float(row['경도'])
        lat = float(row['위도'])
    except (ValueError, KeyError):
        return None

    return (
        row['상가업소번호'],
        row['상호명'] or '',
        row['지점명'] or None,
        row['상권업종대분류코드'] or None,
        row['상권업종대분류명'] or None,
        row['상권업종중분류코드'] or None,
        row['상권업종중분류명'] or None,
        row['상권업종소분류코드'] or None,
        row['상권업종소분류명'] or None,
        row['시군구코드'] or None,
        row['시군구명'] or None,
        row['행정동코드'] or None,
        row['행정동명'] or None,
        row['도로명주소'] or None,
        row['신우편번호'] or None,
        lng,
        lat,
    )


async def seed_stores_from_csv(csv_path: Path) -> None:
    if not csv_path.exists():
        print(f'[SEED] 오류: 시드용 CSV 파일이 존재하지 않습니다: {csv_path}')
        return

    engine = get_engine()
    db_url = str(engine.url).replace('postgresql+asyncpg://', 'postgresql://')

    print(f'[SEED] 데이터 적재 시작: {csv_path.name} -> {db_url.split("@")[-1]}')

    conn = await asyncpg.connect(db_url)
    try:
        total = 0
        skipped = 0
        batch: list[tuple] = []
        start = time.time()

        with csv_path.open(encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = _row_to_tuple(row)
                if record is None:
                    skipped += 1
                    continue

                batch.append(record)
                if len(batch) >= BATCH_SIZE:
                    await conn.executemany(INSERT_SQL, batch)
                    total += len(batch)
                    elapsed = time.time() - start
                    print(
                        f'[SEED]   {total:>7,}행 삽입 완료 '
                        f'({total / elapsed:.0f}행/s)'
                    )
                    batch = []

        if batch:
            await conn.executemany(INSERT_SQL, batch)
            total += len(batch)

        elapsed = time.time() - start
        print(f'[SEED] 적재 완료: {total:,}행 삽입, {skipped}행 스킵, {elapsed:.1f}초')
    except Exception as e:
        print(f'[SEED] 적재 실패: {e}')
    finally:
        await conn.close()
