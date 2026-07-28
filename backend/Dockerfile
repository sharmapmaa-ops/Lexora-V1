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
RUN chmod +x start.sh

# Never run the app as root in production.
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /app/var/storage \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# start.sh runs migrations + seed automatically on every boot before
# starting the server - both steps are idempotent, so this is safe on
# a single-instance deploy and means no manual Shell/bash access is
# needed (Render's free tier doesn't include Shell access anyway).
CMD ["./start.sh"]
