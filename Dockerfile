# syntax=docker/dockerfile:1
# Single image: Vite production build + FastAPI (same origin — no CORS split in prod).

FROM node:22-alpine AS web-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
# `npm ci` can fail when lock optional/bundled deps differ by platform (Tailwind oxide wasm).
RUN npm install
COPY frontend/ ./
# Same-origin API in container — leave empty so `/api` hits this host.
ENV VITE_API_URL=
RUN npm run build

FROM python:3.12-slim-bookworm
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    ENGINEERING_TEAM_REPO_ROOT=/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir .

COPY --from=web-build /src/frontend/dist ./frontend/dist
RUN mkdir -p /app/output

EXPOSE 8000
CMD ["sh", "-c", "uvicorn engineering_team.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
