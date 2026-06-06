#!/bin/sh
# Container entrypoint: apply any pending Drizzle migrations, then hand off to
# the container command (pnpm dev / pnpm start). `drizzle-kit migrate` is
# idempotent — it only runs migrations missing from the __drizzle_migrations
# journal, so this is safe to run on every start.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is not set; skipping migrations." >&2
else
  # Postgres healthcheck gates this container, but guard against a brief
  # connection blip on cold start with a short retry loop.
  attempt=1
  max_attempts=10
  until pnpm db:migrate; do
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "[entrypoint] Migrations failed after ${max_attempts} attempts." >&2
      exit 1
    fi
    echo "[entrypoint] Migration attempt ${attempt} failed; retrying in 3s..." >&2
    attempt=$((attempt + 1))
    sleep 3
  done
  echo "[entrypoint] Migrations up to date."
fi

exec "$@"
