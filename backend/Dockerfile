# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

# Build tools only needed to compile psycopg's C extension if a wheel
# isn't available for the target platform - removed from the final
# image layer via slim base + no separate builder stage kept small on
# purpose (this app has few native deps, so a full multi-stage build
# would add complexity without a real image-size win).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Never run the app as root in production.
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /app/var/storage \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Migrations run as a separate step (docker-compose entrypoint / ECS
# task) rather than baked into the image start command - running
# `alembic upgrade head` automatically on every container boot is a
# common source of race conditions when multiple instances start at
# once.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
