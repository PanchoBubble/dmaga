#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_DIR/docker-compose.yml}"
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/api/health}"

cd "$REPO_DIR"

if [ "${EUID:-$(id -u)}" -ne 0 ] && [ ! -w "$REPO_DIR/.git" ]; then
  exec sudo env \
    ALLOW_DIRTY="${ALLOW_DIRTY:-0}" \
    BRANCH="$BRANCH" \
    COMPOSE_FILE="$COMPOSE_FILE" \
    HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-30}" \
    HEALTH_URL="$HEALTH_URL" \
    REBUILD="${REBUILD:-0}" \
    REMOTE="$REMOTE" \
    REPO_DIR="$REPO_DIR" \
    "$0" "$@"
fi

compose() {
  if command -v docker >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
    return
  fi

  if command -v podman >/dev/null 2>&1; then
    podman compose -f "$COMPOSE_FILE" "$@"
    return
  fi

  echo "Neither docker nor podman is available on PATH." >&2
  exit 1
}

if [ "${ALLOW_DIRTY:-0}" != "1" ] && [ -n "$(git status --porcelain)" ]; then
  echo "Refusing to pull with a dirty worktree." >&2
  echo "Commit/stash local changes first, or rerun with ALLOW_DIRTY=1." >&2
  git status --short
  exit 1
fi

echo "Fetching $REMOTE/$BRANCH..."
git fetch "$REMOTE" "$BRANCH"

echo "Rebasing local commits onto $REMOTE/$BRANCH..."
git rebase "$REMOTE/$BRANCH"

if [ "${REBUILD:-0}" = "1" ]; then
  echo "Rebuilding and recreating services..."
  compose up -d --build app debrid-poller
else
  echo "Applying database migrations..."
  compose exec -T app pnpm db:migrate

  echo "Restarting app and debrid poller..."
  compose restart app debrid-poller
fi

echo "Waiting for app health..."
for attempt in $(seq 1 "${HEALTH_ATTEMPTS:-30}"); do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    echo "App is healthy."
    compose ps app debrid-poller
    exit 0
  fi
  sleep 2
done

echo "App did not become healthy in time. Recent app logs:" >&2
compose logs --tail=80 app >&2
exit 1
