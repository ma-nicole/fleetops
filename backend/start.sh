#!/bin/sh

echo "Running database migrations..."
if alembic upgrade head; then
  echo "Migrations complete."
else
  echo "WARNING: alembic upgrade failed — check DATABASE_URL and MySQL service. Starting API anyway."
fi

echo "Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
