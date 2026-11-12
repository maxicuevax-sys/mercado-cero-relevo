# syntax=docker/dockerfile:1
FROM node:24.22.2-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d AS dependencies
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci --ignore-scripts

FROM dependencies AS builder
ARG BUILD_SHA
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV NEXT_TELEMETRY_DISABLED=1 DEMO_MODE=true
COPY web/ ./
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    BUILD_SHA="$BUILD_SHA" npm run build
RUN mkdir -p /runtime/data/backups /runtime/app-data /runtime/next-cache

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9fc11f6ee65993285c0fe3c4c9bbc4fd275fd4470572f58834ce490df91056e3 AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 \
    DEMO_MODE=true DATABASE_PATH=/data/mercado-cero.db DATABASE_BACKUP_DIR=/data/backups \
    HOME=/tmp PATH=/nodejs/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
COPY --from=builder --chown=1000:1000 /app/.next/standalone ./
COPY --from=builder --chown=1000:1000 /app/.next/static ./.next/static
COPY --from=builder --chown=1000:1000 /app/.next/BUILD_SHA ./.next/BUILD_SHA
COPY --from=builder --chown=1000:1000 /app/public ./public
COPY --chown=1000:1000 deploy/snapshot.mjs deploy/judge-snapshot.mjs ./deploy/
COPY --from=builder --chown=1000:1000 /runtime/data /data
COPY --from=builder --chown=1000:1000 /runtime/app-data /app/data
COPY --from=builder --chown=1000:1000 /runtime/next-cache /app/.next/cache
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT []
CMD ["node", "server.js"]
