"""
서울시 추정매출(행정동) 데이터 시드 스크립트 — 2023~2025

사용법:
    uv run python scripts/seed_sales.py
    uv run python scripts/seed_sales.py --years 2024 2025
"""

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / '.env.local', override=True)

from app.core.seeder import seed_sales_from_csv  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description='서울시 추정매출 데이터 시드')
    parser.add_argument(
        '--years',
        nargs='+',
        type=int,
        default=[2023, 2024, 2025],
        help='적재할 연도 목록 (기본: 2023 2024 2025)',
    )
    args = parser.parse_args()

    csv_paths = [
        ROOT / 'data' / f'seoul_sales_{year}.csv' for year in sorted(args.years)
    ]
    missing = [p for p in csv_paths if not p.exists()]
    if missing:
        for p in missing:
            print(f'오류: 파일 없음 — {p}')
        sys.exit(1)

    asyncio.run(seed_sales_from_csv(csv_paths))


if __name__ == '__main__':
    main()
