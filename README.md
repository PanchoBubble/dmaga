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

Copy `.env.example` to `.env`, then set `NORDVPN_WIREGUARD_PRIVATE_KEY` before
starting the Compose stack. The VPN runs via [gluetun](https://github.com/qdm12/gluetun)
using NordVPN's WireGuard (NordLynx) backend, so this is a **WireGuard private
key**, not your account password or an access token. Get it from the NordVPN
dashboard → Manual setup / NordLynx configuration (see gluetun's
[NordVPN wiki](https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/nordvpn.md)).

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

Only **indexer lookups** egress through the VPN, not everything. A `tinyproxy`
container and `flaresolverr` ride the `gluetun` network namespace, and the app
sends just its indexer fetches through them (`INDEXER_PROXY_URL`); database,
Redis, and Real-Debrid traffic stays direct on the Compose network.

`gluetun` publishes the shared-network port for FlareSolverr:

- App: `http://localhost:3000` (published directly by the app, not via the VPN)
- FlareSolverr health/debug endpoint: `http://localhost:8191`

gluetun is killswitch-by-default: if the VPN disconnects or never authenticates,
the netns-sharing containers fail external requests rather than leaking them
outside the tunnel.

Optional VPN settings (gluetun uses full country names with spaces):

```bash
NORDVPN_COUNTRY="Germany"
```

To sanity-check egress after the stack is healthy (the proxy is what rides the
VPN, so check through it):

```bash
make logs S=gluetun                                   # confirm the tunnel is up
podman compose exec app wget -qO- --proxy=on -e https_proxy=http://gluetun:8888 https://ifconfig.me
```

The second command should fail while the VPN is stopped.
