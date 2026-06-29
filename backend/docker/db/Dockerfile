FROM postgis/postgis:16-3.4

# curl은 postgis 이미지에 포함되어 있으나 명시적으로 보장
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 스키마 초기화 스크립트 (알파벳 순 실행)
COPY init.sql                 /docker-entrypoint-initdb.d/01_postgis.sql
COPY schema.sql               /docker-entrypoint-initdb.d/02_schema.sql
COPY docker/db/03_restore.sh  /docker-entrypoint-initdb.d/03_restore.sh

RUN chmod +x /docker-entrypoint-initdb.d/03_restore.sh
