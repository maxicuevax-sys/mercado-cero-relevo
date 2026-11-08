"""Fail-closed private judge release preflight; no engine commands or secret output.

Config checks read protected local files. --inspect-json accepts a privately saved
docker inspect result. --check-ready contacts ONLY http://127.0.0.1:4596 after
activation; the session probe initializes identity and can run migrations.
"""
import argparse
import json
import os
from pathlib import Path
import re
import stat
import sys
import urllib.error
import urllib.request


class InvalidRelease(ValueError):
    pass


EXPECTED = {
    'DEMO_MODE': 'true', 'JUDGE_DEMO_ACCOUNTS': 'true',
    'JUDGE_DATA_ROOT': '/data/judges', 'APP_URL': 'https://mercado.zicua.com',
    'DATABASE_PATH': '/data/legacy-must-not-be-used.db',
    'DATABASE_BACKUP_DIR': '/data/backups', 'TRUST_PROXY': '0',
    'PEY_API_KEY': '', 'PEY_WEBHOOK_SECRET': '', 'OPENAI_API_KEY': '',
    'OPERATOR_ACCESS_TOKEN': '', 'DEMO_RESET_TOKEN': '',
}
ALLOWED = set(EXPECTED) | {
    'JUDGE_RELEASE_SHA', 'JUDGE_RELEASE_IMAGE', 'JUDGE_RELEASE_ENV_FILE',
    'JUDGE_RELEASE_DATA_DIR', 'PILOT_AUTH_SECRET',
}
ORIGIN = 'http://127.0.0.1:4596'
AUTH_HEALTH_PROBE = "Promise.all([fetch('http://127.0.0.1:3000/api/health'),fetch('http://127.0.0.1:3000/api/access/session')]).then(async([h,s])=>{const j=await h.json();process.exit(h.ok&&j.ok===true&&j.demoMode===true&&j.buildSha===process.env.EXPECTED_BUILD_SHA&&s.status===401?0:1)}).catch(()=>process.exit(1))"


def require(condition, message):
    if not condition:
        raise InvalidRelease(message)


def private_path(path, directory=False, owner=None):
    require(path.is_absolute() and '..' not in path.parts, 'Path must be absolute and normalized')
    for item in [path, *path.parents]:
        require(not item.is_symlink(), 'Symlink storage/configuration is forbidden')
    info = path.stat()
    require(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode),
            'Expected directory/file is unavailable')
    if os.name == 'posix':
        require(info.st_mode & 0o077 == 0, 'Private directory/file permissions required')
        if directory:
            require(info.st_mode & 0o700 == 0o700, 'Data directory requires owner read/write/search permissions')
        require(info.st_uid == (os.geteuid() if owner is None else owner),
                'Unexpected directory/file owner')


def read_environment(path):
    private_path(path)
    env = {}
    require(path.stat().st_size <= 16384, 'Environment file exceeds limit')
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line or line.startswith('#'):
            continue
        key, sep, value = line.partition('=')
        require(sep == '=' and key in ALLOWED and key not in env, 'Unknown/duplicate environment setting')
        require(not any(char in value for char in ('$', '`', '"', "'", '\\', '\x00'))
                and value == value.strip(), 'Environment interpolation/quoting is forbidden')
        env[key] = value
    return env


def validate_environment(env, path, pilot_root=Path('/opt/mercado-cero/pilot')):
    require(set(env) == ALLOWED, 'Release environment is incomplete')
    for key, expected in EXPECTED.items():
        require(env.get(key) == expected, 'Unsafe runtime setting: ' + key)
    require(re.fullmatch(r'[0-9a-f]{40}', env['JUDGE_RELEASE_SHA']) is not None,
            'Expected build SHA must be full lowercase 40 hex')
    image = env['JUDGE_RELEASE_IMAGE']
    require(re.fullmatch(r'(?:[a-zA-Z0-9][a-zA-Z0-9._:/-]*@)?sha256:[0-9a-f]{64}', image) is not None,
            'Image must be pinned by immutable sha256 digest')
    tagged = re.search(r':([0-9a-f]{40})@sha256:', image)
    require(not tagged or tagged.group(1) == env['JUDGE_RELEASE_SHA'], 'Image tag/build SHA mismatch')
    secret = env['PILOT_AUTH_SECRET']
    require(32 <= len(secret) <= 512 and len(set(secret)) >= 10
            and not re.search(r'replace|placeholder|change.?me|example|test.?secret|development', secret, re.I),
            'Missing, weak or placeholder authentication secret')
    require(Path(env['JUDGE_RELEASE_ENV_FILE']) == path, 'Environment file identity mismatch')
    data = Path(env['JUDGE_RELEASE_DATA_DIR'])
    require(data.is_relative_to(pilot_root) and data != pilot_root,
            'Data root must remain inside the private pilot workspace')
    require(data.parent == path.parent and data != path,
            'Environment file and data storage must be separate siblings')
    private_path(data, directory=True, owner=1000)
    return env


def validate_inspect(document, env):
    require(isinstance(document, list) and len(document) == 1, 'Expected one inspected container')
    item = document[0]
    require(item.get('Name') == '/mercado-cero-judge-release', 'Unexpected container identity')
    config, host = item.get('Config', {}), item.get('HostConfig', {})
    health = config.get('Healthcheck', {})
    require(health.get('Test') == ['CMD', 'node', '-e', AUTH_HEALTH_PROBE]
            and health.get('Interval') == 30_000_000_000
            and health.get('Timeout') == 10_000_000_000
            and health.get('StartPeriod') == 30_000_000_000
            and health.get('Retries') == 3, 'Auth-aware container healthcheck contract mismatch')
    require(config.get('Image') == env['JUDGE_RELEASE_IMAGE'], 'Configured image mismatch')
    if env['JUDGE_RELEASE_IMAGE'].startswith('sha256:'):
        require(item.get('Image') == env['JUDGE_RELEASE_IMAGE'], 'Actual immutable image ID mismatch')
    require(config.get('User') == '1000:1000' and config.get('Entrypoint') == ['node', 'server.js']
            and not config.get('Cmd'), 'Unexpected runtime user/entrypoint')
    values = {}
    for entry in config.get('Env', []):
        key, sep, value = entry.partition('=')
        require(sep and key not in values, 'Invalid/duplicate runtime environment')
        values[key] = value
    for key in set(EXPECTED) | {'JUDGE_RELEASE_SHA', 'PILOT_AUTH_SECRET'}:
        require(values.get(key) == env[key], 'Runtime environment mismatch: ' + key)
    require(values.get('EXPECTED_BUILD_SHA') == env['JUDGE_RELEASE_SHA'], 'Healthcheck expected SHA mismatch')
    require(host.get('ReadonlyRootfs') is True and host.get('Init') is True,
            'Read-only root filesystem/init required')
    require(not host.get('Privileged') and not host.get('CapAdd')
            and host.get('NetworkMode') not in ('host', 'container'), 'Unsafe host access')
    require(host.get('PidsLimit') == 128 and host.get('Memory') == 512 * 1024 * 1024
            and host.get('MemorySwap') == 512 * 1024 * 1024
            and host.get('NanoCpus') == 500000000, 'Unexpected resource limits')
    require(host.get('RestartPolicy', {}).get('Name') == 'unless-stopped', 'Durable restart policy required')
    require('ALL' in host.get('CapDrop', []) and
            any(x in ('no-new-privileges', 'no-new-privileges:true') for x in host.get('SecurityOpt', [])),
            'Capability/security boundary mismatch')
    require(host.get('PortBindings') == {'3000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '4596'}]},
            'Only the known loopback binding is permitted')
    mounts = [m for m in item.get('Mounts', []) if m.get('Destination') == '/data']
    require(len(mounts) == 1 and mounts[0].get('Type') == 'bind'
            and mounts[0].get('RW') is True and mounts[0].get('Source') == env['JUDGE_RELEASE_DATA_DIR'],
            'Persistent data mount mismatch')
    require(not any(m.get('Destination') != '/data' and m.get('Type') != 'tmpfs'
                    for m in item.get('Mounts', [])), 'Unexpected persistent/host mount')
    require(set(host.get('Tmpfs', {})) == {'/tmp', '/app/.next/cache'}, 'Bounded tmpfs mounts required')
    for options in host['Tmpfs'].values():
        required = {'noexec', 'nosuid', 'nodev', 'uid=1000', 'gid=1000'}
        require(required <= set(options.split(',')) and ('size=32m' in options or 'size=33554432' in options),
                'Unsafe tmpfs options')
    require(host.get('LogConfig', {}).get('Config') == {'max-size': '10m', 'max-file': '3'},
            'Bounded log rotation required')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def fetch_local(route):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    request = urllib.request.Request(ORIGIN + route, headers={'Accept': 'application/json'})
    try:
        response = opener.open(request, timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        require(response.geturl() == ORIGIN + route, 'Readiness redirect forbidden')
        body = response.read(8193)
        require(len(body) <= 8192, 'Readiness body exceeds limit')
        return response.status, json.loads(body)


def check_ready(env, fetch=fetch_local):
    status, health = fetch('/api/health')
    require(status == 200 and isinstance(health, dict) and health.get('ok') is True
            and health.get('buildSha') == env['JUDGE_RELEASE_SHA'] and health.get('demoMode') is True,
            'Application health/build identity mismatch')
    status, session = fetch('/api/access/session')
    require(status == 401 and isinstance(session, dict)
            and session.get('error') == 'Inicia sesión para continuar.' and 'user' not in session,
            'Anonymous identity readiness failed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', required=True, type=Path)
    parser.add_argument('--inspect-json', type=Path)
    parser.add_argument('--check-ready', action='store_true')
    args = parser.parse_args()
    try:
        env = validate_environment(read_environment(args.env_file), args.env_file)
        if args.inspect_json:
            private_path(args.inspect_json)
            require(args.inspect_json.stat().st_size <= 262144, 'Inspection file exceeds limit')
            validate_inspect(json.loads(args.inspect_json.read_text(encoding='utf-8')), env)
        if args.check_ready:
            check_ready(env)
    except (InvalidRelease, OSError, ValueError, TypeError, KeyError, AttributeError):
        # Do not print exception/HTTP bodies: they may contain private config.
        print('Judge release validation FAILED; review protected configuration.', file=sys.stderr)
        return 1
    print('Judge release validation PASS' + ('; local identity ready.' if args.check_ready else '; no live probe.'))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
