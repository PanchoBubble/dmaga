# dmaga container stack helpers.
#
# `make down` force-removes the dmaga containers by name rather than going
# through `podman compose down`. Compose's down races the `restart:
# unless-stopped` policy — podman revives a container mid-teardown and the
# command hangs. Removing the containers outright leaves nothing for the policy
# to restart. Named data volumes are always preserved (use `make nuke` to drop
# them).

.PHONY: up dev build rebuild down restart update logs ps clean nuke

# Start the stack in the background WITHOUT rebuilding. Source changes
# hot-reload through the bind mount, so the image only needs rebuilding when
# package.json / the lockfile / the Dockerfile change — use `make rebuild` for
# that. Avoiding `--build` here is what stops a new dangling image piling up on
# every start.
up:
	docker compose up -d

# Start in the foreground with combined logs (Ctrl-C to stop), no rebuild.
dev:
	docker compose up

# Build (or rebuild) the app image explicitly.
build:
	docker compose build

# Reliable teardown: never hangs, keeps postgres-data / redis-data / downloads.
# Stop everything first (no ordering constraints), then force-remove. The netns
# siblings (proxy/flaresolverr ride gluetun via `network_mode: service:gluetun`)
# can block gluetun's removal, so we do a second pass to clear any straggler.
# Plain `stop`/`rm -f` (no `--depend`/`--ignore`/`-t`) keeps this portable across
# docker (the server) and podman (dev) — those flags are podman-only.
down:
	@ids=$$(docker ps -aq --filter name='dmaga-'); \
	if [ -z "$$ids" ]; then echo "No dmaga containers to remove."; else \
	  docker stop $$ids >/dev/null 2>&1 || true; \
	  docker rm -f $$ids >/dev/null 2>&1 || true; \
	  rest=$$(docker ps -aq --filter name='dmaga-'); \
	  if [ -n "$$rest" ]; then docker rm -f $$rest; fi; \
	fi
	-@docker network rm dmaga_default 2>/dev/null

# Restart without rebuilding (code changes hot-reload via the bind mount).
restart: down up

# Pull latest main, apply migrations, and restart the running server. If the
# pull changes package.json / pnpm-lock.yaml / the Dockerfile, it auto-rebuilds
# the image AND drops the managed node_modules/.next volumes so new deps (e.g. a
# freshly added library) actually land at runtime instead of being shadowed by a
# stale volume. Force that path anytime with `REBUILD=1 make update`.
update:
	./scripts/pull-and-restart.sh

# Full recreate: tear down, drop the managed node_modules/.next volumes so they
# repopulate from the freshly built image (a rebuild usually means deps or the
# Dockerfile changed), then rebuild and start. Removing the named volumes here
# is also what keeps them from going stale — a plain `make restart` reuses them.
rebuild: down
	-docker volume rm dmaga_app-node-modules dmaga_app-next dmaga_poller-node-modules 2>/dev/null
	docker compose up -d --build

# Follow logs for one service, e.g. `make logs S=debrid-poller` (defaults to app).
logs:
	docker compose logs -f $(or $(S),app)

ps:
	docker compose ps

# Reclaim space: drop dangling (<none>) images, orphaned anonymous volumes
# (64-hex names, e.g. old node_modules copies from anonymous-volume recreates),
# and any leftover build working-containers a failed build left behind. Safe —
# touches no tagged images, no NAMED volumes (dmaga_*), no running containers.
clean:
	-docker image prune -f
	@anon=$$(docker volume ls -q 2>/dev/null | grep -E '^[0-9a-f]{64}$$'); \
	if [ -n "$$anon" ]; then echo "$$anon" | xargs -r docker volume rm; echo "removed orphaned anonymous volumes"; else echo "no orphaned anonymous volumes"; fi
	@ext=$$(docker ps -a --external --format '{{.ID}} {{.Names}}' 2>/dev/null | grep working-container | awk '{print $$1}'); \
	if [ -n "$$ext" ]; then echo "$$ext" | xargs -r docker rm -f; echo "removed build leftovers"; else echo "no build leftovers"; fi

# DESTRUCTIVE: tear down and delete the data volumes too.
nuke: down
	-docker volume rm dmaga_postgres-data dmaga_redis-data dmaga_downloads
