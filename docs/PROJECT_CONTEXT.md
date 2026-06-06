# dmaga Project Context

## Goal

dmaga is a LAN-first Real-Debrid torrent manager. The app lets a local user authenticate with Real-Debrid, configure torrent indexers, search for torrents, save interesting results, add torrents to Real-Debrid, poll until they are ready, and download completed Real-Debrid links from any device on the local network.

The first product shape is single-user/local-network. Hosted multi-user mode was discussed but intentionally removed from scope for now.

## Current Product Shape

- Search page shows torrent results in a grid/list-style card layout.
- Each torrent card has a preview image area, metadata, star/save action, and either Add or Download depending on Debrid state.
- Items not in Real-Debrid should not show an "Addable" badge.
- Items already available in Real-Debrid can show an "In Debrid" badge and enable Download.
- Saved torrents have a dedicated Saved section.
- Added torrents have a dedicated Added section for tracked/polled Real-Debrid items.
- App state is shown compactly in the header/nav: Real-Debrid status, active indexer count, added count, saved count.

## Frontend Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- shadcn/ui-compatible component setup
- RetroUI registry configured in `components.json`
- Zustand for client state
- Framer Motion for UI transitions
- Lucide React for icons

The visual direction is chunky RetroUI/retro-brutalist: strong borders, hard shadows, compact controls, and minimal card nesting.

## Backend Shape

The app currently uses Next.js route handlers as the API layer. The backend is planned around a few clear internal modules:

- Real-Debrid client: typed wrapper for Real-Debrid API calls.
- Indexer adapters: normalized search interface inspired by Prowlarr/Cardigann, starting with Torznab-style indexers.
- Polling worker: Redis-backed background process for Real-Debrid torrent status polling.
- Persistence layer: Postgres-backed storage for settings, tokens, indexers, saved items, added items, polling state, and generated links.

## Services

### App

The Next.js app serves both the frontend and API routes. It binds to `0.0.0.0` in dev/start scripts so it can be reached from other devices on the LAN.

### Postgres

Postgres stores durable app state:

- Real-Debrid auth/session/token records
- configured indexers
- saved torrents
- added/tracked torrents
- polling state
- Real-Debrid torrent IDs
- unrestricted/downloadable links
- host-machine download records, once implemented

### Redis

Redis is for coordination and background work:

- polling queue
- debounce/backoff state
- rate-limit coordination
- future job queues for host-machine downloads

The likely implementation is BullMQ or a small dedicated Redis-backed worker, depending on how much job orchestration we need.

### FlareSolverr

FlareSolverr is an optional per-indexer fetch path for indexers that need Cloudflare/challenge handling. It should not be forced globally. Each indexer config should choose direct HTTP or FlareSolverr.

### Real-Debrid

Real-Debrid handles torrent downloading remotely. The local app does not join the torrent swarm. The app should:

- authenticate with Real-Debrid OAuth/device flow
- add magnets/torrents
- select files
- poll torrent status
- unrestrict/download completed links
- respect Real-Debrid API rate limits with shared throttling

## Polling Plan

When a user clicks Add:

1. Persist or reuse a local added item.
2. Add the magnet/torrent to Real-Debrid.
3. Select files, usually all files at first.
4. Store the Real-Debrid torrent ID.
5. Enqueue polling in Redis.
6. Poll `torrents/info` with backoff.
7. When complete, store returned links and unrestrict them as needed.
8. Remove completed items from the active polling queue.

Polling should not happen directly from UI request handlers except for explicit refreshes. It should run in a worker path so the UI remains fast and Real-Debrid calls stay rate-limited.

## Indexer Plan

The first indexer implementation should support a generic Torznab-compatible adapter. Search results should normalize to:

- title
- size
- seeders
- leechers
- age/date
- indexer name
- magnet URL when available
- info hash when available
- source URL

The model should leave room for Prowlarr/Cardigann-style indexer definitions later, but Phase 1 should stay simple.

## Local Network Assumptions

This app is currently designed for a trusted LAN:

- app server runs on one local machine
- other devices access it through `http://MACHINE_IP:3000`
- Real-Debrid tokens stay server-side
- host-machine downloads are allowed in LAN mode
- no hosted multi-user isolation is required yet

## Current Important Files

- `docker-compose.yml`: local services
- `Dockerfile`: app container
- `app/page.tsx`: search screen
- `app/added/page.tsx`: added/tracked screen
- `app/saved/page.tsx`: saved screen
- `components/app-shell.tsx`: header/nav/service state
- `components/media-card.tsx`: torrent result card
- `lib/server/real-debrid/client.ts`: Real-Debrid API client skeleton
- `lib/server/real-debrid/oauth.ts`: Real-Debrid device/refresh token helper
- `lib/server/real-debrid/auth-service.ts`: Real-Debrid auth persistence helper
- `lib/server/crypto/encryption.ts`: token encryption helper
- `lib/server/indexers/types.ts`: indexer adapter types
- `lib/server/indexers/torznab.ts`: Torznab adapter skeleton
- `lib/db/schema.ts`: Drizzle/Postgres schema for app state
- `lib/db/client.ts`: shared Drizzle database client
- `lib/mock-media.ts`: temporary mock data for UI

## Next Likely Work

1. Add Prettier and finish formatting scripts.
2. Generate and run the initial database migration.
3. Implement Real-Debrid OAuth/device auth.
4. Implement real persisted saved/added state.
5. Implement generic Torznab search.
6. Add Redis-backed polling worker.
