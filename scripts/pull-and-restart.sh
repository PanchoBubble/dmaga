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

# Container CLI (docker or podman) used for raw container/volume ops that
# `compose` doesn't cover (removing containers, dropping named volumes).
CONTAINER_CLI=""
if command -v docker >/dev/null 2>&1; then
  CONTAINER_CLI=docker
elif command -v podman >/dev/null 2>&1; then
  CONTAINER_CLI=podman
else
  echo "Neither docker nor podman is available on PATH." >&2
  exit 1
fi

compose() {
  "$CONTAINER_CLI" compose -f "$COMPOSE_FILE" "$@"
}

# Tear the stack down (matches `make down`) so the named node_modules/.next
# volumes are free to drop, then remove them so a rebuild repopulates them from
# the freshly built image. Without this, a new dependency (e.g. cheerio) lands
# in the image but the stale named volume shadows it → "Module not found".
refresh_dep_volumes_and_rebuild() {
  echo "Dependencies/Dockerfile changed — rebuilding image and refreshing node_modules volumes..."
  local ids
  ids=$("$CONTAINER_CLI" ps -aq --filter name='dmaga-' 2>/dev/null || true)
  if [ -n "$ids" ]; then
    # shellcheck disable=SC2086
    "$CONTAINER_CLI" rm -f -t 10 $ids || true
  fi
  "$CONTAINER_CLI" network rm dmaga_default >/dev/null 2>&1 || true
  "$CONTAINER_CLI" volume rm \
    dmaga_app-node-modules dmaga_app-next dmaga_poller-node-modules \
    >/dev/null 2>&1 || true
  compose up -d --build
}

if [ "${ALLOW_DIRTY:-0}" != "1" ] && [ -n "$(git status --porcelain)" ]; then
  echo "Refusing to pull with a dirty worktree." >&2
  echo "Commit/stash local changes first, or rerun with ALLOW_DIRTY=1." >&2
  git status --short
  exit 1
fi

PREV_HEAD=$(git rev-parse HEAD)

echo "Fetching $REMOTE/$BRANCH..."
git fetch "$REMOTE" "$BRANCH"

echo "Rebasing local commits onto $REMOTE/$BRANCH..."
git rebase "$REMOTE/$BRANCH"

# Did the pull change anything that requires reinstalling deps / rebuilding the
# image? If so, the named node_modules/.next volumes must be dropped (see
# refresh_dep_volumes_and_rebuild) or new packages stay invisible at runtime.
DEPS_CHANGED=0
if git diff --name-only "$PREV_HEAD" HEAD \
  | grep -qE '(^|/)(package\.json|pnpm-lock\.yaml|Dockerfile)$'; then
  DEPS_CHANGED=1
  echo "Detected package.json / pnpm-lock.yaml / Dockerfile changes."
fi

if [ "${REBUILD:-0}" = "1" ] || [ "$DEPS_CHANGED" = "1" ]; then
  refresh_dep_volumes_and_rebuild
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
