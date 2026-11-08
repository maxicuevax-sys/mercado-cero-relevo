"""Outside-VPS pilot checks. Alerts stay on this Windows computer, without secrets."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import urllib.error
import urllib.request
from runtime_target import load_runtime_target, verify_readiness

ROOT = Path(__file__).resolve().parent
ACCESS_PREFIX = 'https://tiny-base-f09a.cloudflareaccess.com/cdn-cgi/access/login/mercado.zicua.com'


def age_hours(value, now):
    stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if stamp.tzinfo is None:
        raise ValueError('Timestamp requires timezone')
    age = (now - stamp).total_seconds() / 3600
    if age < -5 / 60:
        raise ValueError('Timestamp is in the future')
    return age


def verify_backup(report, now, target=None):
    if not report.get('ok') or not report.get('restoreVerified'):
        raise ValueError('Latest copy has no successful restore proof')
    # Both clocks matter: a fresh copy of an old snapshot is still stale.
    if age_hours(report['timestamp'], now) > 6 or age_hours(report['sourceSnapshotTime'], now) > 6:
        raise ValueError('Off-host restore or source snapshot is older than six hours')
    if target and target['requireJudgeAccounts'] and report.get('judgeRestoreVerified') is not True:
        raise ValueError('Latest off-host copy has no verified judge-account restore')


def transition(previous, healthy, now_seconds):
    """Debounce one transient failure; notify changes, then hourly reminders only."""
    state = dict(previous or {})
    if healthy:
        event = 'recovery' if state.get('alerted') else None
        return {'failures': 0, 'alerted': False, 'lastAlert': None}, event
    state['failures'] = state.get('failures', 0) + 1
    event = None
    if state['failures'] >= 2 and (
        not state.get('alerted') or now_seconds - state.get('lastAlert', 0) >= 3600
    ):
        event = 'failure'
        state.update(alerted=True, lastAlert=now_seconds)
    return state, event


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def public_response(path, opener):
    request = urllib.request.Request('https://mercado.zicua.com' + path,
        headers={'User-Agent': 'Mozilla/5.0 MercadoCeroMonitor/1', 'Accept': 'application/json'})
    try:
        return opener.open(request, timeout=20)
    except urllib.error.HTTPError as error:
        return error


def check_access(target=None):
    target = target or load_runtime_target(ROOT / 'runtime-target.json')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    if target['requireJudgeAccounts']:
        with public_response('/api/health', opener) as response:
            if response.code != 200:
                raise ValueError('Public judge health is not available without Access')
            body = response.read(8193)
            if len(body) > 8192:
                raise ValueError('Public health response exceeds limit')
            health = json.loads(body)
        with public_response('/api/access/session', opener) as response:
            status = response.code
        verify_readiness(health, target, status)
        return
    request = urllib.request.Request(
        'https://mercado.zicua.com/api/health',
        headers={'User-Agent': 'Mozilla/5.0 MercadoCeroMonitor/1', 'Accept': 'text/html'},
    )
    try:
        response = opener.open(request, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    try:
        if response.code != 302 or not response.headers.get('Location', '').startswith(ACCESS_PREFIX + '?'):
            raise ValueError('Public health is not redirecting to the expected Access application')
    finally:
        response.close()


def check_origin(target=None):
    target = target or load_runtime_target(ROOT / 'runtime-target.json')
    result = subprocess.run(
        ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'zicua-vps',
         'curl -fsS --max-time 10 http://127.0.0.1:4590/api/health'],
        capture_output=True, text=True, timeout=35, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
    )
    if result.returncode:
        raise ValueError('SSH origin health could not be verified from this computer')
    health = json.loads(result.stdout)
    session_status = None
    if target['requireJudgeAccounts']:
        result = subprocess.run(
            ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'zicua-vps',
             "curl -sS --max-time 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:4590/api/access/session"],
            capture_output=True, text=True, timeout=35, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
        if result.returncode or result.stdout.strip() != '401':
            raise ValueError('Judge account session endpoint is not ready (expected unauthenticated 401)')
        session_status = 401
    verify_readiness(health, target, session_status)


def notify(event, failed):
    # Native local notification only. No SMTP, webhook or third-party messaging.
    message = ('Sin verificacion: ' + ', '.join(failed)) if event == 'failure' else 'Aplicacion, Access y respaldo vuelven a estar verificados.'
    script = """
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$icon = New-Object System.Windows.Forms.NotifyIcon
try {
  $icon.Icon = [System.Drawing.SystemIcons]::Information
  $icon.Text = 'Mercado Cero'
  $icon.Visible = $true
  $icon.ShowBalloonTip(10000, 'Mercado Cero - operacion', $env:MC_MONITOR_MESSAGE, [System.Windows.Forms.ToolTipIcon]::Info)
  Start-Sleep -Seconds 12
} finally { $icon.Dispose() }
"""
    import os
    env = dict(os.environ, MC_MONITOR_MESSAGE=message)
    subprocess.run(
        ['powershell.exe', '-NoProfile', '-WindowStyle', 'Hidden', '-Command', '-'],
        input=script, text=True, env=env, check=True, timeout=25,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check-only', action='store_true', help='Read-only checks; no notification or alert-state change')
    parser.add_argument('--test-notification', action='store_true')
    args = parser.parse_args()
    if args.test_notification:
        notify('failure', ['prueba controlada del aviso local'])
        return
    now = datetime.now(timezone.utc)
    checks = []
    try:
        target = load_runtime_target(ROOT / 'runtime-target.json')
    except (OSError, ValueError):
        target = None
        checks.append({'name': 'Runtime target', 'ok': False, 'error': 'Invalid runtime target configuration'})

    def check_target_origin():
        if target is None:
            raise ValueError('Invalid runtime target configuration')
        check_origin(target)

    def check_target_access():
        if target is None:
            raise ValueError('Invalid runtime target configuration')
        check_access(target)

    def check_target_backup():
        if target is None:
            raise ValueError('Invalid runtime target configuration')
        verify_backup(json.loads((ROOT / 'last-success.json').read_text(encoding='utf-8-sig')), now, target)

    for name, check in [
        ('Acceso publico', check_target_access), ('Origen VPS', check_target_origin),
        ('Respaldo externo', check_target_backup),
    ]:
        try:
            check()
            checks.append({'name': name, 'ok': True})
        except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
            checks.append({'name': name, 'ok': False, 'error': str(error)})
    report = {'ok': all(item['ok'] for item in checks), 'timestamp': now.isoformat(), 'checks': checks}
    if not args.check_only:
        path = ROOT / 'watchdog-state.json'
        previous = json.loads(path.read_text()) if path.exists() else {}
        state, event = transition(previous, report['ok'], now.timestamp())
        if event:
            notify(event, [item['name'] for item in checks if not item['ok']])
            with (ROOT / 'watchdog-events.jsonl').open('a', encoding='utf-8') as output:
                output.write(json.dumps({'event': event, **report}) + '\n')
        path.write_text(json.dumps(state), encoding='utf-8')
        (ROOT / 'watchdog-status.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))
    if not report['ok']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
