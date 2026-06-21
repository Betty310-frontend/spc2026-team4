"""
소상공인 상가업소 데이터 시드 스크립트

사용법:
    uv run python scripts/seed_stores.py [--csv data/sosang_seoul_202603.csv]
"""

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / '.env.local', override=True)

from app.core.seeder import seed_stores_from_csv  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description='소상공인 데이터 시드')
    parser.add_argument(
        '--csv',
        type=Path,
        default=ROOT / 'data' / 'sosang_seoul_202603.csv',
        help='CSV 파일 경로',
    )
    args = parser.parse_args()

    if not args.csv.exists():
        print(f'오류: {args.csv} 파일이 없습니다.')
        sys.exit(1)

    asyncio.run(seed_stores_from_csv(args.csv))


if __name__ == '__main__':
    main()
