FROM python:3.14-slim

# pip install uv 대신 공식 바이너리 직접 복사
# → uv가 Python을 자체 다운로드하려는 시도 없이 베이스 이미지 Python 사용
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# uv가 Python을 별도로 관리하지 않도록 설정
ENV UV_PYTHON_DOWNLOADS=never
ENV UV_PYTHON=/usr/local/bin/python3

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev

COPY app/ ./app/

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
