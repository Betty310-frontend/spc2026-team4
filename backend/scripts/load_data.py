"""
raw_sosang CSV → PostgreSQL 적재

실행: make load
수동: PG_LOCAL_URL=postgresql://user:pass@host/db DATA_DIR=./static_data python scripts/load_data.py
       (또는 DATABASE_URL, PG_CLOUD_URL)
"""

import csv
import io
import os
import sys
from pathlib import Path

import psycopg2


def _get_db_url() -> str:
    for key in ('DATABASE_URL', 'PG_LOCAL_URL', 'PG_CLOUD_URL'):
        url = os.environ.get(key, '')
        if url:
            return url.replace('+asyncpg', '', 1)
    raise SystemExit(
        '❌ DATABASE_URL, PG_LOCAL_URL, PG_CLOUD_URL 중 하나를 설정하세요.'
    )


DB_URL = _get_db_url()
DATA_DIR = Path(os.environ.get('DATA_DIR', './static_data'))


COL_SOSANG = {
    '상가업소번호': 'store_id',
    '상호명': 'store_name',
    '지점명': 'branch_name',
    '상권업종대분류코드': 'major_code',
    '상권업종대분류명': 'major_name',
    '상권업종중분류코드': 'middle_code',
    '상권업종중분류명': 'middle_name',
    '상권업종소분류코드': 'minor_code',
    '상권업종소분류명': 'minor_name',
    '시군구코드': 'sigungu_code',
    '시군구명': 'sigungu_name',
    '행정동코드': 'dong_code',
    '행정동명': 'dong_name',
    '도로명': 'road_name',
    '건물명': 'building_name',
    '도로명주소': 'address',
    '신우편번호': 'postal_code',
    '경도': 'longitude',
    '위도': 'latitude',
}


def detect_encoding(path: Path) -> str:
    KNOWN_KR = ('기준일', '행정동', '생활인구', '매출', '업소', '상가')
    for enc in ('utf-8-sig', 'cp949'):
        try:
            with open(path, encoding=enc, errors='strict', newline='') as f:
                header_line = f.readline()
            if any(kw in header_line for kw in KNOWN_KR):
                return enc
        except UnicodeDecodeError:
            continue
    return 'cp949'


def copy_rows(conn, table: str, cols: list[str], rows: list[list]) -> None:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerows(rows)
    buf.seek(0)
    cols_sql = ', '.join(cols)
    with conn.cursor() as cur:
        cur.copy_expert(
            f'COPY {table} ({cols_sql}) FROM STDIN WITH (FORMAT CSV)',
            buf,
        )
    conn.commit()


def load_csv(
    conn,
    table: str,
    col_map: dict,
    path: Path,
    encoding: str,
    row_filter=None,
    chunk: int = 20_000,
) -> int:
    cols = list(col_map.values())
    total = 0
    buffer: list[list] = []

    with open(path, encoding=encoding, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row_filter and not row_filter(row):
                continue

            mapped = [(row.get(k) or '').strip() for k in col_map]

            if not mapped[0]:
                continue

            buffer.append(mapped)
            total += 1

            if len(buffer) >= chunk:
                copy_rows(conn, table, cols, buffer)
                buffer = []
                print(f'  {total:,}행 적재 중...', end='\r', flush=True)

    if buffer:
        copy_rows(conn, table, cols, buffer)

    print(f'  → {total:,}행 완료        ')
    return total


def load_sosang(conn) -> int:
    candidates = sorted((DATA_DIR / 'raw_sosang').glob('sosang_seoul_*.csv'))
    if not candidates:
        print(f'소상공인 CSV 없음: {DATA_DIR}/raw_sosang/sosang_seoul_*.csv')
        return 0

    fp = candidates[-1]
    enc = detect_encoding(fp)
    print(f'소상공인 적재 중: {fp.name} ({enc})')

    def has_coords(row: dict) -> bool:
        return bool(row.get('경도', '').strip() and row.get('위도', '').strip())

    n = load_csv(conn, 'raw_sosang', COL_SOSANG, fp, enc, row_filter=has_coords)

    print('  geom 컬럼 업데이트 중...')
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE raw_sosang
               SET geom = ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)
             WHERE longitude IS NOT NULL AND latitude IS NOT NULL AND geom IS NULL
        """)
    conn.commit()
    print(f'소상공인 합계: {n:,}행\n')
    return n


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true', help='테이블 초기화 후 재적재')
    args = parser.parse_args()

    conn = psycopg2.connect(DB_URL)

    if args.force:
        print('--force: raw_sosang 초기화 중...')
        with conn.cursor() as cur:
            cur.execute('TRUNCATE raw_sosang')
        conn.commit()
        print('초기화 완료\n')
        count = 0
    else:
        with conn.cursor() as cur:
            cur.execute('SELECT COUNT(*) FROM raw_sosang LIMIT 1')
            (count,) = cur.fetchone()

    if count > 0:
        print(f'raw_sosang에 이미 {count:,}행이 있습니다. 적재를 건너뜁니다.')
        print('재적재하려면: make load-force')
        conn.close()
        return

    try:
        load_sosang(conn)
        print('소상공인 데이터 적재 완료.')
    except Exception as e:
        conn.rollback()
        print(f'오류 발생: {e}', file=sys.stderr)
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
