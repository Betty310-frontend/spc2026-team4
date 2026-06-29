# ── EC2 연결 설정 (환경변수 또는 make 인수로 오버라이드) ──────────────────
EC2_HOST ?= $(shell echo $$EC2_HOST)
EC2_USER ?= ppp
EC2_KEY  ?= ~/.ssh/id_ed25519

# 로컬 Docker Postgres
DB_USER = spcteam4
DB_NAME = teamdb
DB_PASS ?= $(shell echo $$POSTGRES_PASSWORD)
LOCAL_CONTAINER = postgres-server

_SSH = ssh -i $(EC2_KEY) -o StrictHostKeyChecking=no $(EC2_USER)@$(EC2_HOST)

# ── static_data 생성 (Docker 이미지 포함 CSV) ────────────────────────────
.PHONY: preprocess

preprocess:
	uv run python data/preprocess.py
	@echo "✅ static_data/ CSV 생성 완료"

# ── 로컬 데이터 적재 ──────────────────────────────────────────────────────
.PHONY: load load-force load-views

load:
	@COUNT=$$(docker exec $(LOCAL_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME) -t -c "SELECT COUNT(*) FROM raw_sosang" 2>/dev/null | tr -d ' \n'); \
	if [ "$$COUNT" = "0" ] || [ -z "$$COUNT" ]; then \
		DATABASE_URL=postgresql://$(DB_USER):$(DB_PASS)@localhost:5432/$(DB_NAME) DATA_DIR=./static_data uv run python scripts/load_data.py; \
	else \
		echo "이미 적재됨 ($$COUNT 행). 강제 재적재는 make load-force"; \
	fi

load-force:
	DATABASE_URL=postgresql://$(DB_USER):$(DB_PASS)@localhost:5432/$(DB_NAME) DATA_DIR=./static_data uv run python scripts/load_data.py --force

# ── DB 이미지 빌드 (커스텀 postgres + 데이터 덤프 포함) ─────────────────
.PHONY: dump-db build-db

dump-db:
	docker exec $(LOCAL_CONTAINER) \
		pg_dump -Fc -U $(DB_USER) -d $(DB_NAME) --data-only -t public.raw_sosang \
		> docker/db/sosang_data.dump
	@echo "✅ 덤프 완료: docker/db/sosang_data.dump"

build-db: dump-db
	docker compose build team-db
	@echo "✅ DB 이미지 빌드 완료 (backend-team-db)"

# Docker Hub 푸시 (EC2=linux/amd64 대상, buildx 사용)
# API만: make push-api DOCKER_USER=tidypr
# 전체:  make push     DOCKER_USER=tidypr  (DB 컨테이너 실행 중이어야 함)
DOCKER_USER ?= $(shell echo $$DOCKER_USER)
PLATFORM    ?= linux/amd64

push-api:
	docker buildx build --platform $(PLATFORM) \
		-t $(DOCKER_USER)/spc-backend:latest --push .
	@echo "✅ API 푸시 완료: $(DOCKER_USER)/spc-backend:latest"

push: dump-db
	docker buildx build --platform $(PLATFORM) \
		-f docker/db/Dockerfile \
		-t $(DOCKER_USER)/spc-backend-db:latest --push .
	$(MAKE) push-api DOCKER_USER=$(DOCKER_USER)
	@echo "✅ 전체 푸시 완료"

# ── 로컬 덤프 ─────────────────────────────────────────────────────────────
.PHONY: dump

dump:
	docker exec $(LOCAL_CONTAINER) \
		pg_dump -Fc -U $(DB_USER) -d $(DB_NAME) > /tmp/teamdb.dump
	@echo "덤프 완료: /tmp/teamdb.dump"

# ── EC2 스트리밍 복원 (파일 없이 로컬 → EC2 직접 전송) ──────────────────
# 사용: make ec2-stream EC2_HOST=1.2.3.4 [EC2_USER=ubuntu] [EC2_KEY=~/.ssh/key.pem]
.PHONY: ec2-stream

ec2-stream:
	@test -n "$(EC2_HOST)" || (echo "❌  EC2_HOST가 필요합니다. 예: make ec2-stream EC2_HOST=1.2.3.4" && exit 1)
	@echo "▶  로컬 Postgres → EC2 Docker Postgres 스트리밍 시작..."
	docker exec $(LOCAL_CONTAINER) \
		pg_dump -Fp -U $(DB_USER) -d $(DB_NAME) \
		| $(_SSH) \
		  "docker exec -i postgres-server psql -U $(DB_USER) -d $(DB_NAME)"
	@echo "✅  스트리밍 완료"

# ── EC2 최초 DB 적재 (로컬 → EC2, 코드 배포는 GitHub Actions) ───────────
# 순서: 1) EC2에서 docker compose up team-db 먼저 실행 → 2) make ec2-stream
.PHONY: ec2-init-db

ec2-init-db:
	@test -n "$(EC2_HOST)" || (echo "❌  EC2_HOST가 필요합니다." && exit 1)
	@echo "▶  EC2 DB 컨테이너 기동..."
	$(_SSH) "cd /developers/app/backend && docker compose up -d team-db && \
		until docker exec postgres-server pg_isready -U $(DB_USER) -d $(DB_NAME); \
		do echo '  DB 대기 중...'; sleep 3; done"
	@echo "▶  DB 스트리밍..."
	$(MAKE) ec2-stream
	@echo "✅  DB 적재 완료 (앱 배포는 GitHub Actions → develop push)"
