"""
생활인구 월별 ZIP 정제 적재 스크립트

사용법:
    uv run python scripts/seed_population_flow.py --files "C:\\Users\\NT551XED\\Downloads\\LOCAL_PEOPLE_DONG_202512.zip"
    uv run python scripts/seed_population_flow.py --dir "C:\\Users\\NT551XED\\Downloads\\local_people_zips"
"""

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / '.env.local', override=True)

from app.core.seeder import seed_population_flow_from_zips  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description='생활인구 월별 ZIP 정제 적재')
    parser.add_argument('--files', nargs='+', type=Path, default=None)
    parser.add_argument('--dir', type=Path, default=None)
    args = parser.parse_args()

    if args.dir:
        files = sorted(args.dir.glob('LOCAL_PEOPLE_DONG_*.zip'))
    elif args.files:
        files = args.files
    else:
        print('오류: --dir 또는 --files를 입력하세요.')
        sys.exit(1)

    if not files:
        print('오류: 적재할 ZIP 파일이 없습니다.')
        sys.exit(1)

    missing = [p for p in files if not p.exists()]
    if missing:
        for p in missing:
            print(f'오류: 파일 없음 — {p}')
        sys.exit(1)

    print(f'[SEED] 생활인구 ZIP {len(files)}개 처리 시작')
    asyncio.run(seed_population_flow_from_zips(files))


if __name__ == '__main__':
    main()