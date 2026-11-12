# syntax=docker/dockerfile:1
FROM node:26.13.0-trixie-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072 AS dependencies
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

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:088a01637f22908632ba09018be2e0b516f2fa6f7869c191d29491139db43c78 AS runner
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
