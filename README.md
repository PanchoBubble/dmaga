# dmaga

LAN-first Real-Debrid torrent manager with configurable indexers, FlareSolverr support, and a Next.js interface.

## Stack

- Next.js, React, TypeScript
- Tailwind CSS, shadcn/ui foundations, RetroUI registry components
- Zustand and Framer Motion
- Postgres, Redis, FlareSolverr
- Docker Compose for local-network runtime

## Local Development

```bash
pnpm install
pnpm dev
```

The dev server binds to `0.0.0.0`, so other devices on your network can access it through:

```bash
http://YOUR_MACHINE_IP:3000
```

## Docker

Copy `.env.example` to `.env`, then set `NORDVPN_TOKEN` before starting the
Compose stack. The token is a NordVPN access token, not your account password.

First time (or after dependency/Dockerfile changes), build the image:

```bash
make rebuild   # tear down, rebuild the app image, then start
```

Day to day:

```bash
make up        # start in the background (no rebuild — code hot-reloads)
make dev       # start in the foreground with combined logs
make down      # stop and remove containers (keeps data volumes)
make restart   # down + up, no rebuild
make build     # rebuild the app image only
make logs      # follow app logs (make logs S=debrid-poller for another service)
make clean     # reclaim space: prune dangling images + leftover build containers
make nuke      # down + delete data volumes (destructive)
```

Two deliberate choices keep podman's storage from ballooning:

- `make up` does **not** pass `--build`. Source changes hot-reload through the
  bind mount, so rebuilding on every start just orphans the previous image as a
  dangling `<none>` layer. Rebuild only when deps or the Dockerfile change
  (`make rebuild` / `make build`).
- `make down` force-removes containers by name rather than using `podman compose
  down`, which races the `restart: unless-stopped` policy (podman revives a
  container mid-teardown and the command hangs). Data volumes are preserved
  unless you run `make nuke`.

If a build is interrupted (e.g. the VM runs out of disk), it can leave
half-built working-containers behind that quietly consume space — `make clean`
clears those and any dangling images.

The Compose stack routes outbound traffic from these containers through the
`nordvpn` container:

- `app`, which handles indexer search, Real-Debrid API calls, and queued host downloads
- `debrid-poller`, which polls Real-Debrid
- `flaresolverr`, which fetches protected indexer pages when enabled per indexer

`nordvpn` publishes the shared-network ports for those services:

- App: `http://localhost:3000`
- FlareSolverr health/debug endpoint: `http://localhost:8191`

The VPN container starts with NordLynx and the NordVPN kill switch enabled. If
the VPN disconnects or never authenticates, the routed containers should fail
external requests rather than leaking them outside the VPN. Database and Redis
traffic stays inside the Compose network.

Optional VPN settings:

```bash
NORDVPN_CONNECT="United_Kingdom"
```

To sanity-check egress after the stack is healthy:

```bash
docker compose exec app wget -qO- https://ifconfig.me
docker compose stop nordvpn
docker compose exec app wget -qO- --timeout=10 https://ifconfig.me
```

The second command should fail while the VPN is stopped.
