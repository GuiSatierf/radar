# Production image for Coolify (Dockerfile build pack). Based on the official Next.js "with-docker" example.
# Pinned to the patch, so production runs a known Node; bump it on each Node security release.
FROM node:24.22.1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3210
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
# Migrations run on start (scripts/start.mjs). The standalone output has no migrator,
# so it gets a tiny install of its own, pinned to the versions in package-lock.json.
WORKDIR /migrate
RUN npm init -y >/dev/null \
 && npm install --no-audit --no-fund --save-exact drizzle-orm@0.45.4 pg@8.23.1 \
 && npm pkg set type=module
COPY scripts/start.mjs ./start.mjs
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/drizzle ./drizzle
# Studio videos (VIDEO_FILES_DIR). A new Docker volume copies this folder, owner included.
RUN mkdir -p /app/data/videos && chown -R nextjs:nodejs /app/data
USER nextjs
EXPOSE 3210
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3210/api/health || exit 1
CMD ["node", "/migrate/start.mjs"]
