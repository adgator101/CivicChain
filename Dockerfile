# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────────────────────
# CivicChain — Next.js 16 (standalone output) + Prisma 7 production image.
#
# Build:  docker build -t civicchain .
# Run:    docker run --env-file .env -p 3000:3000 civicchain
#
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# must be passed as build args. All other secrets are read at runtime.
# ──────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
# libc6-compat is needed by some native deps (sharp, prisma engines) on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ──────────────── deps: install full dependency tree (incl. dev) ───────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ──────────────── builder: generate Prisma client + build Next.js ──────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public env vars are baked into the client bundle during `next build`.
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ARG NEXT_PUBLIC_MAPBOX_STYLE
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    NEXT_PUBLIC_MAPBOX_STYLE=$NEXT_PUBLIC_MAPBOX_STYLE \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# Prisma client is generated into src/generated/prisma (see schema.prisma).
RUN npx prisma generate
RUN npm run build

# ──────────────── migrator: one-shot image to apply DB migrations ──────────────
# Reuses the builder layers, so it shares the build cache. Used by compose to run
# `prisma migrate deploy` before the app boots.
FROM builder AS migrator
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

# ──────────────── runner: minimal standalone runtime image ─────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Static assets and the public folder are not bundled into the standalone server.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# server.js is emitted by Next.js standalone output.
CMD ["node", "server.js"]
