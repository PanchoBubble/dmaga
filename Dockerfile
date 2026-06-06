FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
ENV NO_UPDATE_NOTIFIER=1

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
# Keep pnpm's content-addressable store in a build cache mount instead of the
# image layer. Without this the ~750MB store is committed on top of
# node_modules (a 1.56GB layer); with it the layer is just node_modules, and the
# store is reused across rebuilds — smaller image, faster builds, less commit
# scratch. PNPM_HOME=/pnpm, so the store lives at /pnpm/store.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

# Apply pending DB migrations before starting the app command (idempotent).
# Invoked via `sh` so it works even when the bind-mounted copy lacks +x.
ENTRYPOINT ["sh", "/app/scripts/docker-entrypoint.sh"]
CMD ["pnpm", "dev"]
