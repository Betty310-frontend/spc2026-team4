"""
raw CSV → PostgreSQL 적재 + Materialized View 생성

실행: docker-compose up data-loader
수동: DATABASE_URL=... python scripts/load_data.py
"""

import csv
import io
import os
import sys
from pathlib import Path

import psycopg2

DB_URL = os.environ['DATABASE_URL']
DATA_DIR = Path(os.environ.get('DATA_DIR', '/data'))


# ── 컬럼 매핑 (한국어 CSV 헤더 → 영문 테이블 컬럼) ────────────────────────

COL_PEOPLE = {
    '기준일ID': 'date_id',
    '시간대구분': 'time_slot',
    '행정동코드': 'dong_code',
    '총생활인구수': 'total_pop',
    '남자0세부터9세생활인구수': 'm_age_0to9',
    '남자10세부터14세생활인구수': 'm_age_10to14',
    '남자15세부터19세생활인구수': 'm_age_15to19',
    '남자20세부터24세생활인구수': 'm_age_20to24',
    '남자25세부터29세생활인구수': 'm_age_25to29',
    '남자30세부터34세생활인구수': 'm_age_30to34',
    '남자35세부터39세생활인구수': 'm_age_35to39',
    '남자40세부터44세생활인구수': 'm_age_40to44',
    '남자45세부터49세생활인구수': 'm_age_45to49',
    '남자50세부터54세생활인구수': 'm_age_50to54',
    '남자55세부터59세생활인구수': 'm_age_55to59',
    '남자60세부터64세생활인구수': 'm_age_60to64',
    '남자65세부터69세생활인구수': 'm_age_65to69',
    '남자70세이상생활인구수': 'm_age_70plus',
    '여자0세부터9세생활인구수': 'f_age_0to9',
    '여자10세부터14세생활인구수': 'f_age_10to14',
    '여자15세부터19세생활인구수': 'f_age_15to19',
    '여자20세부터24세생활인구수': 'f_age_20to24',
    '여자25세부터29세생활인구수': 'f_age_25to29',
    '여자30세부터34세생활인구수': 'f_age_30to34',
    '여자35세부터39세생활인구수': 'f_age_35to39',
    '여자40세부터44세생활인구수': 'f_age_40to44',
    '여자45세부터49세생활인구수': 'f_age_45to49',
    '여자50세부터54세생활인구수': 'f_age_50to54',
    '여자55세부터59세생활인구수': 'f_age_55to59',
    '여자60세부터64세생활인구수': 'f_age_60to64',
    '여자65세부터69세생활인구수': 'f_age_65to69',
    '여자70세이상생활인구수': 'f_age_70plus',
}

COL_SALES = {
    '기준_년분기_코드': 'quarter_code',
    '행정동_코드': 'dong_code',
    '행정동_코드_명': 'dong_name',
    '서비스_업종_코드': 'industry_code',
    '서비스_업종_코드_명': 'industry_name',
    '당월_매출_금액': 'sales_amount',
    '당월_매출_건수': 'sales_count',
    '주중_매출_금액': 'weekday_amount',
    '주말_매출_금액': 'weekend_amount',
    '월요일_매출_금액': 'mon_amount',
    '화요일_매출_금액': 'tue_amount',
    '수요일_매출_금액': 'wed_amount',
    '목요일_매출_금액': 'thu_amount',
    '금요일_매출_금액': 'fri_amount',
    '토요일_매출_금액': 'sat_amount',
    '일요일_매출_금액': 'sun_amount',
    '시간대_00~06_매출_금액': 'time_00_06_amount',
    '시간대_06~11_매출_금액': 'time_06_11_amount',
    '시간대_11~14_매출_금액': 'time_11_14_amount',
    '시간대_14~17_매출_금액': 'time_14_17_amount',
    '시간대_17~21_매출_금액': 'time_17_21_amount',
    '시간대_21~24_매출_금액': 'time_21_24_amount',
    '남성_매출_금액': 'male_amount',
    '여성_매출_금액': 'female_amount',
    '연령대_10_매출_금액': 'age10_amount',
    '연령대_20_매출_금액': 'age20_amount',
    '연령대_30_매출_금액': 'age30_amount',
    '연령대_40_매출_금액': 'age40_amount',
    '연령대_50_매출_금액': 'age50_amount',
    '연령대_60_이상_매출_금액': 'age60plus_amount',
    '주중_매출_건수': 'weekday_count',
    '주말_매출_건수': 'weekend_count',
    '월요일_매출_건수': 'mon_count',
    '화요일_매출_건수': 'tue_count',
    '수요일_매출_건수': 'wed_count',
    '목요일_매출_건수': 'thu_count',
    '금요일_매출_건수': 'fri_count',
    '토요일_매출_건수': 'sat_count',
    '일요일_매출_건수': 'sun_count',
    # 2023 파일의 오염된 컬럼명 → 정규화
    '시간대_건수~06_매출_건수': 'time_00_06_count',
    '시간대_건수~11_매출_건수': 'time_06_11_count',
    '시간대_건수~14_매출_건수': 'time_11_14_count',
    '시간대_건수~17_매출_건수': 'time_14_17_count',
    '시간대_건수~21_매출_건수': 'time_17_21_count',
    '시간대_건수~24_매출_건수': 'time_21_24_count',
    '남성_매출_건수': 'male_count',
    '여성_매출_건수': 'female_count',
    '연령대_10_매출_건수': 'age10_count',
    '연령대_20_매출_건수': 'age20_count',
    '연령대_30_매출_건수': 'age30_count',
    '연령대_40_매출_건수': 'age40_count',
    '연령대_50_매출_건수': 'age50_count',
    '연령대_60_이상_매출_건수': 'age60plus_count',
}

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

# ── Materialized View SQL ──────────────────────────────────────────────────

MV_SQL = """
-- 1. 월별 동별 평균 생활인구 (24시간대 × 일수 평균)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_local_people_monthly AS
SELECT
    LEFT(date_id, 6)                                                          AS year_month,
    dong_code,
    ROUND(AVG(total_pop)::NUMERIC, 2)                                         AS avg_total_pop,
    ROUND(AVG(m_age_0to9 + m_age_10to14 + m_age_15to19 + m_age_20to24 + m_age_25to29
            + m_age_30to34 + m_age_35to39 + m_age_40to44 + m_age_45to49
            + m_age_50to54 + m_age_55to59 + m_age_60to64 + m_age_65to69 + m_age_70plus)::NUMERIC, 2) AS avg_pop_m,
    ROUND(AVG(f_age_0to9 + f_age_10to14 + f_age_15to19 + f_age_20to24 + f_age_25to29
            + f_age_30to34 + f_age_35to39 + f_age_40to44 + f_age_45to49
            + f_age_50to54 + f_age_55to59 + f_age_60to64 + f_age_65to69 + f_age_70plus)::NUMERIC, 2) AS avg_pop_f,
    ROUND(AVG(m_age_0to9  + f_age_0to9)::NUMERIC,  2)                        AS avg_age_0to9,
    ROUND(AVG(m_age_10to14 + m_age_15to19 + f_age_10to14 + f_age_15to19)::NUMERIC, 2) AS avg_age_10,
    ROUND(AVG(m_age_20to24 + m_age_25to29 + f_age_20to24 + f_age_25to29)::NUMERIC, 2) AS avg_age_20,
    ROUND(AVG(m_age_30to34 + m_age_35to39 + f_age_30to34 + f_age_35to39)::NUMERIC, 2) AS avg_age_30,
    ROUND(AVG(m_age_40to44 + m_age_45to49 + f_age_40to44 + f_age_45to49)::NUMERIC, 2) AS avg_age_40,
    ROUND(AVG(m_age_50to54 + m_age_55to59 + f_age_50to54 + f_age_55to59)::NUMERIC, 2) AS avg_age_50,
    ROUND(AVG(m_age_60to64 + m_age_65to69 + m_age_70plus
            + f_age_60to64 + f_age_65to69 + f_age_70plus)::NUMERIC, 2)       AS avg_age_60plus
FROM raw_local_people
GROUP BY LEFT(date_id, 6), dong_code;

CREATE INDEX IF NOT EXISTS idx_mv_pop_monthly ON mv_local_people_monthly (year_month, dong_code);

-- 2. 분기별 동별 평균 생활인구 (월평균의 평균)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_local_people_quarterly AS
SELECT
    LEFT(year_month, 4)::SMALLINT                        AS year,
    (RIGHT(year_month, 2)::INT - 1) / 3 + 1             AS quarter,
    dong_code,
    ROUND(AVG(avg_total_pop)::NUMERIC, 2)                AS avg_total_pop,
    ROUND(AVG(avg_pop_m)::NUMERIC, 2)                    AS avg_pop_m,
    ROUND(AVG(avg_pop_f)::NUMERIC, 2)                    AS avg_pop_f,
    ROUND(AVG(avg_age_0to9)::NUMERIC, 2)                 AS avg_age_0to9,
    ROUND(AVG(avg_age_10)::NUMERIC, 2)                   AS avg_age_10,
    ROUND(AVG(avg_age_20)::NUMERIC, 2)                   AS avg_age_20,
    ROUND(AVG(avg_age_30)::NUMERIC, 2)                   AS avg_age_30,
    ROUND(AVG(avg_age_40)::NUMERIC, 2)                   AS avg_age_40,
    ROUND(AVG(avg_age_50)::NUMERIC, 2)                   AS avg_age_50,
    ROUND(AVG(avg_age_60plus)::NUMERIC, 2)               AS avg_age_60plus
FROM mv_local_people_monthly
GROUP BY LEFT(year_month, 4), (RIGHT(year_month, 2)::INT - 1) / 3 + 1, dong_code;

CREATE INDEX IF NOT EXISTS idx_mv_pop_quarterly ON mv_local_people_quarterly (year, quarter, dong_code);

-- 3. 동별 총 업소 수
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_store_per_dong AS
SELECT
    dong_code,
    COUNT(*) AS total_store_count
FROM raw_sosang
WHERE longitude IS NOT NULL AND latitude IS NOT NULL
GROUP BY dong_code;

CREATE INDEX IF NOT EXISTS idx_mv_store_dong ON mv_store_per_dong (dong_code);

-- 4. 동별 × 대분류 업소 수
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_store_by_major AS
SELECT
    dong_code,
    major_code,
    major_name,
    COUNT(*) AS store_count
FROM raw_sosang
WHERE longitude IS NOT NULL AND latitude IS NOT NULL
GROUP BY dong_code, major_code, major_name;

CREATE INDEX IF NOT EXISTS idx_mv_store_major ON mv_store_by_major (dong_code, major_code);

-- 5. 동별 × 중분류 업소 수
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_store_by_middle AS
SELECT
    dong_code,
    middle_code,
    middle_name,
    COUNT(*) AS store_count
FROM raw_sosang
WHERE longitude IS NOT NULL AND latitude IS NOT NULL
GROUP BY dong_code, middle_code, middle_name;

CREATE INDEX IF NOT EXISTS idx_mv_store_middle ON mv_store_by_middle (dong_code, middle_code);

-- 6. 회귀분석 데이터셋 (매출 × 생활인구분기 × 업소수 LEFT JOIN)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_regression_dataset AS
SELECT
    s.quarter_code,
    s.year,
    s.quarter,
    s.dong_code,
    s.dong_name,
    s.industry_code,
    s.industry_name,
    s.sales_amount,
    s.sales_count,
    s.weekday_amount,
    s.weekend_amount,
    s.male_amount,
    s.female_amount,
    s.age10_amount,
    s.age20_amount,
    s.age30_amount,
    s.age40_amount,
    s.age50_amount,
    s.age60plus_amount,
    s.time_00_06_amount,
    s.time_06_11_amount,
    s.time_11_14_amount,
    s.time_14_17_amount,
    s.time_17_21_amount,
    s.time_21_24_amount,
    s.weekday_count,
    s.weekend_count,
    s.male_count,
    s.female_count,
    s.age10_count,
    s.age20_count,
    s.age30_count,
    s.age40_count,
    s.age50_count,
    s.age60plus_count,
    s.time_00_06_count,
    s.time_06_11_count,
    s.time_11_14_count,
    s.time_14_17_count,
    s.time_17_21_count,
    s.time_21_24_count,
    p.avg_total_pop    AS pop_avg_total,
    p.avg_pop_m        AS pop_avg_m,
    p.avg_pop_f        AS pop_avg_f,
    p.avg_age_0to9     AS pop_avg_age_0to9,
    p.avg_age_10       AS pop_avg_age_10,
    p.avg_age_20       AS pop_avg_age_20,
    p.avg_age_30       AS pop_avg_age_30,
    p.avg_age_40       AS pop_avg_age_40,
    p.avg_age_50       AS pop_avg_age_50,
    p.avg_age_60plus   AS pop_avg_age_60plus,
    t.total_store_count,
    (p.dong_code IS NOT NULL)::INT AS pop_matched,
    (t.dong_code IS NOT NULL)::INT AS store_matched
FROM raw_sales s
LEFT JOIN mv_local_people_quarterly p
    ON s.year = p.year AND s.quarter = p.quarter AND s.dong_code = p.dong_code
LEFT JOIN mv_store_per_dong t
    ON s.dong_code = t.dong_code;

CREATE INDEX IF NOT EXISTS idx_mv_regression_dong  ON mv_regression_dataset (dong_code);
CREATE INDEX IF NOT EXISTS idx_mv_regression_yq    ON mv_regression_dataset (year, quarter);
CREATE INDEX IF NOT EXISTS idx_mv_regression_ind   ON mv_regression_dataset (industry_code);
"""

# ── 유틸 ──────────────────────────────────────────────────────────────────


def detect_encoding(path: Path) -> str:
    # 헤더의 한국어 컬럼명이 정상적으로 디코딩되는지 확인
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
    row_extra=None,
    chunk: int = 20_000,
) -> int:
    """
    CSV → PostgreSQL COPY (청크 단위 스트리밍).
    row_filter(dict) → bool : False 이면 행 제외
    row_extra(dict)  → dict : 파생 컬럼 추가 (sales의 year/quarter 등)
    """
    cols = list(col_map.values())
    if row_extra:
        cols = cols + list(row_extra({'dummy': ''}).keys())

    total = 0
    buffer: list[list] = []

    with open(path, encoding=encoding, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row_filter and not row_filter(row):
                continue

            mapped = [(row.get(k) or '').strip() for k in col_map]

            if not mapped[0]:  # 첫 컬럼(ID) 비어있으면 인코딩 오류 행 → 스킵
                continue

            if row_extra:
                extra = row_extra(row)
                mapped = mapped + list(extra.values())

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


# ── 적재 함수 ─────────────────────────────────────────────────────────────


def load_local_people(conn) -> int:
    files = sorted((DATA_DIR / 'raw_local_people').glob('LOCAL_PEOPLE_DONG_*.csv'))
    print(f'생활인구 {len(files)}개 파일 적재 중...')
    total = 0
    for fp in files:
        enc = detect_encoding(fp)
        print(f'  {fp.name} ({enc})')
        n = load_csv(conn, 'raw_local_people', COL_PEOPLE, fp, enc)
        total += n
    print(f'생활인구 합계: {total:,}행\n')
    return total


def load_sales(conn) -> int:
    files = sorted((DATA_DIR / 'raw_sales').glob('seoul_sales_*.csv'))
    print(f'추정매출 {len(files)}개 파일 적재 중...')
    total = 0

    def extra(row: dict) -> dict:
        code = str(row.get('기준_년분기_코드', '') or '').strip()
        return {
            'year': code[:4] if len(code) >= 5 else '',
            'quarter': code[4:] if len(code) >= 5 else '',
        }

    for fp in files:
        enc = detect_encoding(fp)
        print(f'  {fp.name} ({enc})')
        n = load_csv(conn, 'raw_sales', COL_SALES, fp, enc, row_extra=extra)
        total += n
    print(f'추정매출 합계: {total:,}행\n')
    return total


def load_sosang(conn) -> int:
    candidates = sorted((DATA_DIR / 'raw_sosang').glob('sosang_seoul_*.csv'))
    fp = candidates[-1]  # 가장 최신 파일
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


def create_views(conn) -> None:
    print('Materialized View 생성 중...')
    statements = [s.strip() for s in MV_SQL.split(';') if s.strip()]
    with conn.cursor() as cur:
        for stmt in statements:
            cur.execute(stmt)
    conn.commit()
    print('Materialized View 생성 완료\n')


# ── main ──────────────────────────────────────────────────────────────────


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true', help='테이블 초기화 후 재적재')
    parser.add_argument(
        '--views-only', action='store_true', help='데이터 적재 없이 MV만 재생성'
    )
    args = parser.parse_args()

    conn = psycopg2.connect(DB_URL)

    if args.views_only:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    'DROP MATERIALIZED VIEW IF EXISTS mv_regression_dataset CASCADE'
                )
                cur.execute(
                    'DROP MATERIALIZED VIEW IF EXISTS mv_local_people_quarterly CASCADE'
                )
                cur.execute(
                    'DROP MATERIALIZED VIEW IF EXISTS mv_local_people_monthly CASCADE'
                )
                cur.execute(
                    'DROP MATERIALIZED VIEW IF EXISTS mv_store_per_dong CASCADE'
                )
                cur.execute(
                    'DROP MATERIALIZED VIEW IF EXISTS mv_store_by_major CASCADE'
                )
                cur.execute(
                    'DROP MATERIALIZED VIEW IF EXISTS mv_store_by_middle CASCADE'
                )
            conn.commit()
            create_views(conn)
            print('MV 재생성 완료.')
        except Exception as e:
            conn.rollback()
            print(f'오류 발생: {e}', file=sys.stderr)
            raise
        finally:
            conn.close()
        return

    if args.force:
        print('--force: 기존 데이터 초기화 중...')
        with conn.cursor() as cur:
            cur.execute(
                'DROP MATERIALIZED VIEW IF EXISTS mv_regression_dataset CASCADE'
            )
            cur.execute(
                'DROP MATERIALIZED VIEW IF EXISTS mv_local_people_quarterly CASCADE'
            )
            cur.execute(
                'DROP MATERIALIZED VIEW IF EXISTS mv_local_people_monthly CASCADE'
            )
            cur.execute('DROP MATERIALIZED VIEW IF EXISTS mv_store_per_dong CASCADE')
            cur.execute('DROP MATERIALIZED VIEW IF EXISTS mv_store_by_major CASCADE')
            cur.execute('DROP MATERIALIZED VIEW IF EXISTS mv_store_by_middle CASCADE')
            cur.execute('TRUNCATE raw_local_people, raw_sales, raw_sosang')
        conn.commit()
        print('초기화 완료\n')
        count = 0
    else:
        with conn.cursor() as cur:
            cur.execute('SELECT COUNT(*) FROM raw_local_people LIMIT 1')
            (count,) = cur.fetchone()

    if count > 0:
        print(f'raw_local_people에 이미 {count:,}행이 있습니다. 적재를 건너뜁니다.')
        print(
            "재적재하려면: docker compose run --rm data-loader sh -c 'pip install psycopg2-binary -q && python /load_data.py --force'"
        )
        conn.close()
        return

    try:
        load_local_people(conn)
        load_sales(conn)
        load_sosang(conn)
        create_views(conn)
        print('모든 데이터 적재 및 View 생성 완료.')
    except Exception as e:
        conn.rollback()
        print(f'오류 발생: {e}', file=sys.stderr)
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
