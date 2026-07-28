#!/bin/sh
# Runs on every container start. Both steps below are safe to repeat:
#   - `alembic upgrade head` does nothing if the DB is already current.
#   - `python -m app.seed` upserts plans/admin user, never duplicates.
# This removes the need for a paid Render plan's Shell access just to
# run migrations - the free tier's web service still boots this script
# on every deploy and restart automatically.
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Seeding plans and admin user (safe to repeat)..."
python -m app.seed

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WEB_CONCURRENCY:-2}"
