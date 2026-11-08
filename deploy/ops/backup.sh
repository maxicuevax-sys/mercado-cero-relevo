#!/usr/bin/env bash
set -euo pipefail
umask 077
root=/opt/mercado-cero/pilot
engine=podman
container=mercado-cero-pilot
if [ -f "$root/app-runtime.env" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      APP_ENGINE) engine="$value" ;;
      APP_CONTAINER) container="$value" ;;
    esac
  done < "$root/app-runtime.env"
fi
[[ "$engine" == podman || "$engine" == docker ]] || exit 1
[[ "$container" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 1
app_exec() { "$engine" exec "$container" "$@"; }
exec 9>/run/lock/mercado-cero-backup.lock
flock -n 9 || exit 0
export RESTIC_REPOSITORY="$root/restic-repo"
export RESTIC_PASSWORD_FILE="$root/restic-password"
export RESTIC_CACHE_DIR="$root/restic-cache"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
inside="/data/backups/auto-$stamp.db"
stage="$root/backup-current"
mkdir -p "$stage/database" "$stage/config"
trap 'app_exec rm -f "$inside" >/dev/null 2>&1 || true' EXIT
app_exec node deploy/snapshot.mjs "$inside"
"$engine" cp "$container:$inside" "$stage/database/mercado-cero.db.partial"
mv "$stage/database/mercado-cero.db.partial" "$stage/database/mercado-cero.db"
cp "$root/pilot.env" "$root/cloudflared.env" "$stage/config/"
cp /etc/containers/systemd/mercado-cero-{tunnel,kuma,litestream}.container "$stage/config/"
if [ -f /etc/containers/systemd/mercado-cero-pilot.container ]; then
  cp /etc/containers/systemd/mercado-cero-pilot.container "$stage/config/"
fi
if [ -f /etc/systemd/system/mercado-cero-pilot.service ]; then
  cp /etc/systemd/system/mercado-cero-pilot.service "$stage/config/"
fi
if [ -f "$root/app-runtime.env" ]; then cp "$root/app-runtime.env" "$stage/config/"; fi
cp -a "$root/ops" "$stage/config/"
if [ -d "$root/recovery-source" ]; then cp -a "$root/recovery-source" "$stage/"; fi
cp "$root/ops/litestream-local.yml" "$stage/config/"
if [ -f /data/coolify/source/.env ]; then
  mkdir -p "$stage/coolify/ssh-keys"
  docker exec coolify-db pg_dump -U coolify -d coolify --format=custom > "$stage/coolify/database.dump.partial"
  docker exec -i coolify-db pg_restore --list < "$stage/coolify/database.dump.partial" > /dev/null
  mv "$stage/coolify/database.dump.partial" "$stage/coolify/database.dump"
  cp /data/coolify/source/.env /data/coolify/source/docker-compose*.yml "$stage/coolify/"
  cp /data/coolify/ssh/keys/* "$stage/coolify/ssh-keys/"
  cp /etc/docker/daemon.json "$stage/coolify/docker-daemon.json"
  cp /etc/systemd/system/mercado-cero-coolify.service "$stage/coolify/"
  sha256sum "$stage/coolify/database.dump" > "$stage/coolify/SHA256SUMS"
fi
if [ -f "$root/kuma-admin.json" ]; then cp "$root/kuma-admin.json" "$stage/config/"; fi
if [ -f "$root/backup-push-token" ]; then cp "$root/backup-push-token" "$stage/config/"; fi
sha256sum "$stage/database/mercado-cero.db" > "$stage/database/SHA256SUMS"
# A size stop avoids silently filling a shared server; no destructive retention.
if [ -d "$RESTIC_REPOSITORY" ] && [ "$(du -sm "$RESTIC_REPOSITORY" | cut -f1)" -ge 1024 ]; then
  echo 'Mercado Cero backup repository reached 1 GiB; retention review required.' >&2
  exit 1
fi
restic backup --tag mercado-cero --host mercado-cero-pilot "$stage"
restic check
date -u +%FT%TZ > "$root/last-backup-success"
if [ -r "$root/backup-push-token" ]; then
  # Feed the private push URL via stdin, keeping its secret out of process args.
  printf 'url = "http://127.0.0.1:4591/api/push/%s?status=up&msg=Consistent-backup-verified"\n' "$(cat "$root/backup-push-token")" |
    curl --config - --fail --silent --show-error --max-time 10 > /dev/null
fi
