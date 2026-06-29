#!/bin/bash
set -e

DUMP=/tmp/sosang_data.dump

echo "[DB INIT] Supabase Storage에서 덤프 다운로드 중..."
if ! curl -fsSL \
    "https://porbbhxkewthzmekuszv.supabase.co/storage/v1/object/public/spc2026-team4/db/sosang_data.dump" \
    -o "$DUMP"; then
    echo "[DB INIT] ❌ 덤프 다운로드 실패 — DB 초기화를 중단합니다"
    exit 1
fi

if [ ! -s "$DUMP" ]; then
    echo "[DB INIT] ❌ 덤프 파일이 비어 있습니다 — DB 초기화를 중단합니다"
    exit 1
fi

echo "[DB INIT] raw_sosang 데이터 복원 시작..."
pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --data-only "$DUMP"
echo "[DB INIT] raw_sosang 데이터 복원 완료"

rm -f "$DUMP"
