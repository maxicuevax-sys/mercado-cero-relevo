# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci --ignore-scripts

FROM dependencies AS builder
ARG BUILD_SHA
ENV NEXT_TELEMETRY_DISABLED=1 DEMO_MODE=true
COPY web/ ./
RUN BUILD_SHA="$BUILD_SHA" npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    DEMO_MODE=true DATABASE_PATH=/data/mercado-cero.db DATABASE_BACKUP_DIR=/data/backups
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/.next/BUILD_SHA ./.next/BUILD_SHA
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node deploy/snapshot.mjs deploy/judge-snapshot.mjs ./deploy/
RUN mkdir -p /data /app/data /app/.next/cache && chown -R node:node /data /app/data /app/.next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
