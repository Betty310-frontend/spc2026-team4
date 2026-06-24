# 상권 AI 진단 서비스 — Backend

서울 소상공인 예비창업자를 위한 AI 에이전트 기반 상권 분석 API 서버.|

## 1. 디렉토리 구조

```bash
app/
├── api/v1/
│   └── controllers/   # HTTP 라우터 (analysis, chat, health, report)
├── core/              # 설정, DB, Redis, 지오코딩, 카테고리 매핑
├── dto/               # Pydantic 요청/응답 모델
├── entities/          # SQLAlchemy ORM (store, local_people, sales)
└── services/
    ├── analysis.py    # 상권 분석 핵심 로직 (run_market_analysis 등)
    ├── chat.py        # 에이전트 스트리밍 (stream_ui)
    ├── chat_tools.py  # LangChain 도구 팩토리 (make_analysis_tools)
    ├── store.py       # 경쟁업체 DB 조회
    ├── summarize.py   # 로컬 템플릿 기반 리포트 요약
    └── report.py      # PDF 리포트 빌더 (WIP)
data/                  # 원천 CSV 및 전처리 스크립트
tests/                 # 유닛 테스트
```

### 2. DB·Redis 실행

```bash
# PostgreSQL + PostGIS, Redis 컨테이너 기동
docker compose up -d team-db team-redis

# 데이터 최초 적재 (CSV → DB)
docker compose up data-loader

# 데이터 재적재 (기존 데이터 삭제 후)
docker compose run --rm data-loader \
  sh -c "pip install psycopg2-binary -q && python /load_data.py --force"
```

### 3. 서버 실행

```bash
uv sync

# 개발 (hot-reload)
uv run dev

# 프로덕션
uv run start
```

## 4. 테스트

```bash
# 전체 실행
uv run pytest
```
