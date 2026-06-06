FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
ENV NO_UPDATE_NOTIFIER=1

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

# Apply pending DB migrations before starting the app command (idempotent).
# Invoked via `sh` so it works even when the bind-mounted copy lacks +x.
ENTRYPOINT ["sh", "/app/scripts/docker-entrypoint.sh"]
CMD ["pnpm", "dev"]
