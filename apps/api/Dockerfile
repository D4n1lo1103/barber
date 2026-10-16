# syntax=docker/dockerfile:1

# ─── Fase di costruzione ───────────────────────────────────────────────────────
FROM node:24-alpine AS costruzione
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
# Lo schema serve già durante l'installazione: lo script postinstall
# di @barber/api esegue "prisma generate", che richiede DATABASE_URL.
# Il valore qui sotto è un segnaposto usato solo per generare il client:
# non è una credenziale e non compare nell'immagine finale.
ENV DATABASE_URL="postgresql://segnaposto:segnaposto@database:5432/segnaposto"
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
RUN pnpm install --frozen-lockfile --filter @barber/api... --filter @barber/shared...

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @barber/shared build \
  && pnpm --filter @barber/api build \
  && pnpm prune --prod --ignore-scripts

# ─── Immagine di esecuzione ────────────────────────────────────────────────────
FROM node:24-alpine AS esecuzione
RUN corepack enable && apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production

COPY --from=costruzione /app/node_modules ./node_modules
COPY --from=costruzione /app/package.json ./package.json
COPY --from=costruzione /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=costruzione /app/packages/shared ./packages/shared
COPY --from=costruzione /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=costruzione /app/apps/api/dist ./apps/api/dist
COPY --from=costruzione /app/apps/api/package.json ./apps/api/package.json
COPY --from=costruzione /app/apps/api/prisma ./apps/api/prisma
COPY --from=costruzione /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

USER node
WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
