# dmaga

LAN-first Real-Debrid torrent manager with configurable indexers, FlareSolverr support, and a Next.js interface.

## Stack

- Next.js, React, TypeScript
- Tailwind CSS, shadcn/ui foundations, Kibo UI registry components
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

Copy `.env.example` to `.env` once Real-Debrid credentials and token encryption are wired in.
