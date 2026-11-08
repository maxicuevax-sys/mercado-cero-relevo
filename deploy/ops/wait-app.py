"""Systemd readiness bridge; Docker owns restart policy, Coolify owns deployment."""
import json
import time
import urllib.request

for attempt in range(30):
    try:
        with urllib.request.urlopen('http://127.0.0.1:4590/api/health', timeout=2) as response:
            health = json.load(response)
        if health.get('ok') and health.get('buildSha') == '09b4f8d1aa63f40682e2e4082034fe952a1dd1e2':
            print('Mercado Cero active build ready.')
            break
    except (OSError, ValueError):
        pass
    time.sleep(1)
else:
    raise SystemExit('Active application did not become ready with the expected build.')
