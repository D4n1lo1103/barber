# syntax=docker/dockerfile:1

# ─── Fase di costruzione ───────────────────────────────────────────────────────
FROM node:24-alpine AS costruzione
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter @barber/web... --filter @barber/shared...

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
# L'URL dell'API finisce nel bundle: va passato in fase di costruzione.
ARG VITE_URL_API=/api
ENV VITE_URL_API=$VITE_URL_API
RUN pnpm --filter @barber/shared build && pnpm --filter @barber/web build

# ─── Immagine di esecuzione: file statici serviti da Caddy ─────────────────────
FROM caddy:2-alpine AS esecuzione
COPY infra/caddy/Caddyfile.sito /etc/caddy/Caddyfile
COPY --from=costruzione /app/apps/web/dist /srv
EXPOSE 80
