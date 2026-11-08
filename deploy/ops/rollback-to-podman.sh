#!/usr/bin/env bash
# Prepared recovery procedure. Do not run during an active Coolify deployment.
set -euo pipefail
root=/opt/mercado-cero/pilot
rollback_dir=$(python3 - <<'PY'
import json
from pathlib import Path
root=Path('/opt/mercado-cero/pilot')
target=Path(json.loads((root/'migration.json').read_text())['rollbackDirectory']).resolve()
assert target.is_relative_to((root/'rollback').resolve())
assert (target/'mercado-cero-pilot.container').is_file()
print(target)
PY
)
test ! -e /etc/containers/systemd/mercado-cero-pilot.container
grep -q 'docker start mercado-cero-pilot-jmkt3zjnd560s3g0vhqw97db' /etc/systemd/system/mercado-cero-pilot.service
systemctl stop mercado-cero-backup.timer mercado-cero-tunnel.service mercado-cero-litestream.service
systemctl stop mercado-cero-pilot.service
docker update --restart=no mercado-cero-pilot-jmkt3zjnd560s3g0vhqw97db > /dev/null
systemctl disable mercado-cero-pilot.service
mv /etc/systemd/system/mercado-cero-pilot.service "$rollback_dir/mercado-cero-pilot-docker.service.used"
cp "$rollback_dir/mercado-cero-pilot.container" /etc/containers/systemd/mercado-cero-pilot.container
printf 'APP_ENGINE=podman\nAPP_CONTAINER=mercado-cero-pilot\n' > "$root/app-runtime.env"
chmod 600 "$root/app-runtime.env"
systemctl daemon-reload
systemctl start mercado-cero-pilot.service
python3 "$root/ops/wait-app.py"
systemctl start mercado-cero-litestream.service mercado-cero-tunnel.service mercado-cero-backup.timer
echo 'Podman rollback ready on the same current SQLite database; no old snapshot restored.'
