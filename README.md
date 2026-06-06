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

```bash
docker compose up --build
```

Copy `.env.example` to `.env`, then set `NORDVPN_TOKEN` before starting the
Compose stack. The token is a NordVPN access token, not your account password.

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
