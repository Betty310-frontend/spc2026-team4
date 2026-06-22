import csv
import time
from pathlib import Path
import asyncpg  # type: ignore[import-untyped]
from app.core.database import get_engine

_SALES_INSERT_SQL = """
INSERT INTO seoul_sales (
    quarter_code, dong_code, dong_name,
    service_code, service_name,
    monthly_sales_amt, monthly_sales_cnt,
    weekday_sales_amt, weekend_sales_amt,
    mon_sales_amt, tue_sales_amt, wed_sales_amt,
    thu_sales_amt, fri_sales_amt, sat_sales_amt, sun_sales_amt,
    hour_00_06_sales_amt, hour_06_11_sales_amt, hour_11_14_sales_amt,
    hour_14_17_sales_amt, hour_17_21_sales_amt, hour_21_24_sales_amt,
    male_sales_amt, female_sales_amt,
    age_10_sales_amt, age_20_sales_amt, age_30_sales_amt,
    age_40_sales_amt, age_50_sales_amt, age_60_plus_sales_amt,
    weekday_sales_cnt, weekend_sales_cnt,
    mon_sales_cnt, tue_sales_cnt, wed_sales_cnt,
    thu_sales_cnt, fri_sales_cnt, sat_sales_cnt, sun_sales_cnt,
    hour_00_06_sales_cnt, hour_06_11_sales_cnt, hour_11_14_sales_cnt,
    hour_14_17_sales_cnt, hour_17_21_sales_cnt, hour_21_24_sales_cnt,
    male_sales_cnt, female_sales_cnt,
    age_10_sales_cnt, age_20_sales_cnt, age_30_sales_cnt,
    age_40_sales_cnt, age_50_sales_cnt, age_60_plus_sales_cnt
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9,
    $10, $11, $12, $13, $14, $15, $16,
    $17, $18, $19, $20, $21, $22,
    $23, $24,
    $25, $26, $27, $28, $29, $30,
    $31, $32,
    $33, $34, $35, $36, $37, $38, $39,
    $40, $41, $42, $43, $44, $45,
    $46, $47,
    $48, $49, $50, $51, $52, $53
)
ON CONFLICT (quarter_code, dong_code, service_code) DO NOTHING
"""


def _int_or_none(val: str) -> int | None:
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _sales_row_to_tuple(row: dict) -> tuple:
    return (
        row['기준_년분기_코드'],
        row['행정동_코드'],
        row['행정동_코드_명'] or None,
        row['서비스_업종_코드'],
        row['서비스_업종_코드_명'] or None,
        _int_or_none(row['당월_매출_금액']),
        _int_or_none(row['당월_매출_건수']),
        _int_or_none(row['주중_매출_금액']),
        _int_or_none(row['주말_매출_금액']),
        _int_or_none(row['월요일_매출_금액']),
        _int_or_none(row['화요일_매출_금액']),
        _int_or_none(row['수요일_매출_금액']),
        _int_or_none(row['목요일_매출_금액']),
        _int_or_none(row['금요일_매출_금액']),
        _int_or_none(row['토요일_매출_금액']),
        _int_or_none(row['일요일_매출_금액']),
        _int_or_none(row['시간대_00~06_매출_금액']),
        _int_or_none(row['시간대_06~11_매출_금액']),
        _int_or_none(row['시간대_11~14_매출_금액']),
        _int_or_none(row['시간대_14~17_매출_금액']),
        _int_or_none(row['시간대_17~21_매출_금액']),
        _int_or_none(row['시간대_21~24_매출_금액']),
        _int_or_none(row['남성_매출_금액']),
        _int_or_none(row['여성_매출_금액']),
        _int_or_none(row['연령대_10_매출_금액']),
        _int_or_none(row['연령대_20_매출_금액']),
        _int_or_none(row['연령대_30_매출_금액']),
        _int_or_none(row['연령대_40_매출_금액']),
        _int_or_none(row['연령대_50_매출_금액']),
        _int_or_none(row['연령대_60_이상_매출_금액']),
        _int_or_none(row['주중_매출_건수']),
        _int_or_none(row['주말_매출_건수']),
        _int_or_none(row['월요일_매출_건수']),
        _int_or_none(row['화요일_매출_건수']),
        _int_or_none(row['수요일_매출_건수']),
        _int_or_none(row['목요일_매출_건수']),
        _int_or_none(row['금요일_매출_건수']),
        _int_or_none(row['토요일_매출_건수']),
        _int_or_none(row['일요일_매출_건수']),
        _int_or_none(row['시간대_건수~06_매출_건수']),
        _int_or_none(row['시간대_건수~11_매출_건수']),
        _int_or_none(row['시간대_건수~14_매출_건수']),
        _int_or_none(row['시간대_건수~17_매출_건수']),
        _int_or_none(row['시간대_건수~21_매출_건수']),
        _int_or_none(row['시간대_건수~24_매출_건수']),
        _int_or_none(row['남성_매출_건수']),
        _int_or_none(row['여성_매출_건수']),
        _int_or_none(row['연령대_10_매출_건수']),
        _int_or_none(row['연령대_20_매출_건수']),
        _int_or_none(row['연령대_30_매출_건수']),
        _int_or_none(row['연령대_40_매출_건수']),
        _int_or_none(row['연령대_50_매출_건수']),
        _int_or_none(row['연령대_60_이상_매출_건수']),
    )


async def seed_sales_from_csv(csv_paths: list[Path]) -> None:
    from app.core.database import get_engine

    engine = get_engine()
    db_url = engine.url.render_as_string(hide_password=False).replace(
        'postgresql+asyncpg://', 'postgresql://'
    )

    conn = await asyncpg.connect(db_url)
    try:
        for csv_path in csv_paths:
            if not csv_path.exists():
                print(f'[SEED] 오류: 파일 없음 — {csv_path}')
                continue

            print(f'[SEED] 적재 시작: {csv_path.name} → {db_url.split("@")[-1]}')
            total = 0
            skipped = 0
            batch: list[tuple] = []
            start = time.time()

            with csv_path.open(encoding='euc-kr') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        batch.append(_sales_row_to_tuple(row))
                    except Exception:
                        skipped += 1
                        continue

                    if len(batch) >= BATCH_SIZE:
                        await conn.executemany(_SALES_INSERT_SQL, batch)
                        total += len(batch)
                        elapsed = time.time() - start
                        print(
                            f'[SEED]   {total:>7,}행 삽입 완료 '
                            f'({total / elapsed:.0f}행/s)'
                        )
                        batch = []

            if batch:
                await conn.executemany(_SALES_INSERT_SQL, batch)
                total += len(batch)

            elapsed = time.time() - start
            print(
                f'[SEED] {csv_path.name} 완료: '
                f'{total:,}행 삽입, {skipped}행 스킵, {elapsed:.1f}초'
            )
    finally:
        await conn.close()


_LOCAL_PEOPLE_INSERT_SQL = """
INSERT INTO local_people (
    date_id, time_slot, dong_code, total,
    male_0_9, male_10_14, male_15_19, male_20_24, male_25_29,
    male_30_34, male_35_39, male_40_44, male_45_49, male_50_54,
    male_55_59, male_60_64, male_65_69, male_70_plus,
    female_0_9, female_10_14, female_15_19, female_20_24, female_25_29,
    female_30_34, female_35_39, female_40_44, female_45_49, female_50_54,
    female_55_59, female_60_64, female_65_69, female_70_plus
) VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
    $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
)
ON CONFLICT (date_id, time_slot, dong_code) DO NOTHING
"""

_LP_COLS = [
    '기준일ID',
    '시간대구분',
    '행정동코드',
    '총생활인구수',
    '남자0세부터9세생활인구수',
    '남자10세부터14세생활인구수',
    '남자15세부터19세생활인구수',
    '남자20세부터24세생활인구수',
    '남자25세부터29세생활인구수',
    '남자30세부터34세생활인구수',
    '남자35세부터39세생활인구수',
    '남자40세부터44세생활인구수',
    '남자45세부터49세생활인구수',
    '남자50세부터54세생활인구수',
    '남자55세부터59세생활인구수',
    '남자60세부터64세생활인구수',
    '남자65세부터69세생활인구수',
    '남자70세이상생활인구수',
    '여자0세부터9세생활인구수',
    '여자10세부터14세생활인구수',
    '여자15세부터19세생활인구수',
    '여자20세부터24세생활인구수',
    '여자25세부터29세생활인구수',
    '여자30세부터34세생활인구수',
    '여자35세부터39세생활인구수',
    '여자40세부터44세생활인구수',
    '여자45세부터49세생활인구수',
    '여자50세부터54세생활인구수',
    '여자55세부터59세생활인구수',
    '여자60세부터64세생활인구수',
    '여자65세부터69세생활인구수',
    '여자70세이상생활인구수',
]


def _float_or_none(val: str) -> float | None:
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _lp_row_to_tuple(row: dict) -> tuple:
    return tuple(
        row[c] if i < 3 else _float_or_none(row[c]) for i, c in enumerate(_LP_COLS)
    )


async def seed_local_people_from_csv(csv_paths: list[Path]) -> None:
    from app.core.database import get_engine

    engine = get_engine()
    db_url = engine.url.render_as_string(hide_password=False).replace(
        'postgresql+asyncpg://', 'postgresql://'
    )

    conn = await asyncpg.connect(db_url)
    try:
        for csv_path in csv_paths:
            if not csv_path.exists():
                print(f'[SEED] 오류: 파일 없음 — {csv_path}')
                continue

            print(f'[SEED] 적재 시작: {csv_path.name}')
            total = 0
            skipped = 0
            batch: list[tuple] = []
            start = time.time()

            with csv_path.open(encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        batch.append(_lp_row_to_tuple(row))
                    except Exception:
                        skipped += 1
                        continue

                    if len(batch) >= BATCH_SIZE:
                        await conn.executemany(_LOCAL_PEOPLE_INSERT_SQL, batch)
                        total += len(batch)
                        elapsed = time.time() - start
                        print(f'[SEED]   {total:>7,}행 ({total / elapsed:.0f}행/s)')
                        batch = []

            if batch:
                await conn.executemany(_LOCAL_PEOPLE_INSERT_SQL, batch)
                total += len(batch)

            elapsed = time.time() - start
            print(
                f'[SEED] {csv_path.name} 완료: {total:,}행, {skipped}행 스킵, {elapsed:.1f}초'
            )
    finally:
        await conn.close()


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
    db_url = engine.url.render_as_string(hide_password=False).replace(
        'postgresql+asyncpg://', 'postgresql://'
    )

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
                        f'[SEED]   {total:>7,}행 삽입 완료 ({total / elapsed:.0f}행/s)'
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
