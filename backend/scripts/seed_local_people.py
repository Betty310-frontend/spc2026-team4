"""
서울시 행정동 생활인구 데이터 시드 스크립트

사용법:
    uv run python scripts/seed_local_people.py
    uv run python scripts/seed_local_people.py --files data/local_people_202605.csv
"""

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / '.env.local', override=True)

from app.core.seeder import seed_local_people_from_csv  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description='생활인구 데이터 시드')
    parser.add_argument(
        '--files',
        nargs='+',
        type=Path,
        default=[ROOT / 'data' / 'local_people_202605.csv'],
    )
    args = parser.parse_args()

    missing = [p for p in args.files if not p.exists()]
    if missing:
        for p in missing:
            print(f'오류: 파일 없음 — {p}')
        sys.exit(1)

    asyncio.run(seed_local_people_from_csv(args.files))


if __name__ == '__main__':
    main()
