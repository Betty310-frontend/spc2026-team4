"""앱 기동 시 전처리 CSV를 메모리에 로드 — non-spatial 조회 전용."""

import csv
from dataclasses import dataclass, field
from pathlib import Path

import httpx

_DATA_DIR = Path(__file__).parent.parent.parent / 'static_data'
_BASE_URL = (
    'https://porbbhxkewthzmekuszv.supabase.co'
    '/storage/v1/object/public/spc2026-team4/static_data'
)
_REQUIRED_FILES = [
    'local_people_hourly.csv',
    'local_people_monthly.csv',
    'store_count_by_middle.csv',
    'store_count_by_major.csv',
    'sales_avg_by_dong_industry.csv',
    'dong_names.csv',
]


def _ensure_files(data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    for fname in _REQUIRED_FILES:
        if not (data_dir / fname).exists():
            r = httpx.get(f'{_BASE_URL}/{fname}', timeout=30)
            r.raise_for_status()
            (data_dir / fname).write_bytes(r.content)


@dataclass
class _Store:
    hourly_pop: dict[tuple[str, str], float] = field(default_factory=dict)
    monthly_pop: dict[str, dict] = field(default_factory=dict)
    dong_pop_list: list[float] = field(default_factory=list)
    store_by_mid: dict[str, int] = field(default_factory=dict)
    store_by_major: dict[str, int] = field(default_factory=dict)
    sales_avg: dict[tuple[str, str], dict] = field(default_factory=dict)
    dong_names: dict[str, str] = field(default_factory=dict)
    sales_trend: dict[tuple[str, str], dict] = field(default_factory=dict)
    data_ref_month: str = '2025-12'


_store: _Store | None = None


def load(data_dir: Path = _DATA_DIR) -> None:
    _ensure_files(data_dir)
    global _store
    s = _Store()

    with open(data_dir / 'local_people_hourly.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            s.hourly_pop[(r['dong_code'], r['time_slot'])] = float(r['avg_total_pop'])

    latest: dict[str, tuple[str, dict]] = {}
    with open(data_dir / 'local_people_monthly.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            dong, ym = r['dong_code'], r['year_month']
            if dong not in latest or ym > latest[dong][0]:
                latest[dong] = (ym, r)
    s.monthly_pop = {d: row for d, (_, row) in latest.items()}
    s.dong_pop_list = [float(row['avg_total_pop']) for row in s.monthly_pop.values()]
    if latest:
        max_ym = max(ym for ym, _ in latest.values())
        s.data_ref_month = f'{max_ym[:4]}-{max_ym[4:]}'

    with open(data_dir / 'store_count_by_middle.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            code = r['middle_code']
            s.store_by_mid[code] = s.store_by_mid.get(code, 0) + int(r['store_count'])

    with open(data_dir / 'store_count_by_major.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            code = r['major_code']
            s.store_by_major[code] = s.store_by_major.get(code, 0) + int(
                r['store_count']
            )

    with open(data_dir / 'sales_avg_by_dong_industry.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            s.sales_avg[(r['dong_code'], r['industry_code'])] = r

    with open(data_dir / 'dong_names.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            s.dong_names[r['dong_code']] = r['dong_name']

    trend_path = data_dir / 'sales_trend.csv'
    if trend_path.exists():
        with open(trend_path, encoding='utf-8') as f:
            for r in csv.DictReader(f):
                s.sales_trend[(r['dong_code'], r['industry_code'])] = r

    _store = s


def get() -> _Store:
    if _store is None:
        raise RuntimeError(
            'static_data not loaded — call static_data.load() at startup'
        )
    return _store
