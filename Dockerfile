# syntax=docker/dockerfile:1
#
# Single-service build: frontend + backend in one image, one Render web
# service. This replaces the earlier two-service (nginx + FastAPI)
# setup - that split added real deployment friction (a proxy needing
# SNI/Host-header configuration to talk to a second service) for no
# benefit at this project's size. The frontend now calls the API via a
# same-origin relative path (/api/v1/...), so there's no cross-service
# proxying to configure at all.
#
# Render setting for this file: Root Directory = "" (repo root), not
# `backend` or `frontend`.

FROM node:22-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-builder /frontend/dist /app/static

RUN chmod +x start.sh

RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /app/var/storage \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# start.sh runs migrations + seed automatically on every boot before
# starting the server (see backend/start.sh) - no manual Shell access
# needed.
CMD ["./start.sh"]
