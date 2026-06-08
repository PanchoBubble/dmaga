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
	podman compose up -d

# Start in the foreground with combined logs (Ctrl-C to stop), no rebuild.
dev:
	podman compose up

# Build (or rebuild) the app image explicitly.
build:
	podman compose build

# Reliable teardown: never hangs, keeps postgres-data / redis-data / downloads.
# --depend removes each container together with anything that shares its netns
# (proxy/flaresolverr ride on gluetun via `network_mode: service:gluetun`,
# so they must go before it); --ignore swallows the already-removed ones that
# cascade leaves behind.
down:
	@ids=$$(podman ps -aq --filter name='dmaga-'); \
	if [ -n "$$ids" ]; then podman rm -f --depend --ignore -t 10 $$ids; else echo "No dmaga containers to remove."; fi
	-@podman network rm dmaga_default 2>/dev/null

# Restart without rebuilding (code changes hot-reload via the bind mount).
restart: down up

# Pull latest main, apply migrations, and restart the running server.
update:
	./scripts/pull-and-restart.sh

# Full recreate: tear down, drop the managed node_modules/.next volumes so they
# repopulate from the freshly built image (a rebuild usually means deps or the
# Dockerfile changed), then rebuild and start. Removing the named volumes here
# is also what keeps them from going stale — a plain `make restart` reuses them.
rebuild: down
	-podman volume rm dmaga_app-node-modules dmaga_app-next dmaga_poller-node-modules 2>/dev/null
	podman compose up -d --build

# Follow logs for one service, e.g. `make logs S=debrid-poller` (defaults to app).
logs:
	podman compose logs -f $(or $(S),app)

ps:
	podman compose ps

# Reclaim space: drop dangling (<none>) images, orphaned anonymous volumes
# (64-hex names, e.g. old node_modules copies from anonymous-volume recreates),
# and any leftover build working-containers a failed build left behind. Safe —
# touches no tagged images, no NAMED volumes (dmaga_*), no running containers.
clean:
	-podman image prune -f
	@anon=$$(podman volume ls -q 2>/dev/null | grep -E '^[0-9a-f]{64}$$'); \
	if [ -n "$$anon" ]; then echo "$$anon" | xargs -r podman volume rm; echo "removed orphaned anonymous volumes"; else echo "no orphaned anonymous volumes"; fi
	@ext=$$(podman ps -a --external --format '{{.ID}} {{.Names}}' 2>/dev/null | grep working-container | awk '{print $$1}'); \
	if [ -n "$$ext" ]; then echo "$$ext" | xargs -r podman rm -f; echo "removed build leftovers"; else echo "no build leftovers"; fi

# DESTRUCTIVE: tear down and delete the data volumes too.
nuke: down
	-podman volume rm dmaga_postgres-data dmaga_redis-data dmaga_downloads
