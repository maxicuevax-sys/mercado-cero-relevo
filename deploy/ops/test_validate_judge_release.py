"""Local tempfiles and mocked HTTP only; no daemon/Next/production calls."""
import importlib.util
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).with_name('validate-judge-release.py')
spec = importlib.util.spec_from_file_location('judge_release', SOURCE)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.data = self.root / 'data'
        self.data.mkdir(mode=0o700)
        self.file = self.root / 'release.env'
        self.env = dict(release.EXPECTED, JUDGE_RELEASE_SHA='a' * 40,
                        JUDGE_RELEASE_IMAGE='localhost/mercado-cero:' + 'a' * 40 + '@sha256:' + 'b' * 64,
                        JUDGE_RELEASE_ENV_FILE=self.file.as_posix(), JUDGE_RELEASE_DATA_DIR=self.data.as_posix(),
                        PILOT_AUTH_SECRET=secrets.token_hex(32))
        self.write()

    def write(self, text=None):
        self.file.write_text(text if text is not None else '\n'.join(k + '=' + v for k, v in self.env.items()), encoding='utf-8')
        self.file.chmod(0o600)

    def validate(self):
        # Real temp directory modes are checked separately. Avoid requiring the
        # test runner to chown a fixture to the application UID.
        original = release.private_path
        def paths(path, directory=False, owner=None):
            return original(path, directory, None if directory else owner)
        with patch.object(release, 'private_path', side_effect=paths):
            return release.validate_environment(release.read_environment(self.file), self.file, self.root)

    def inspected(self):
        return [{
            'Name': '/mercado-cero-judge-release',
            'Image': 'sha256:' + 'b' * 64,
            'Config': {'Image': self.env['JUDGE_RELEASE_IMAGE'], 'User': '1000:1000',
                       'Entrypoint': ['node', 'server.js'], 'Cmd': None,
                       'Healthcheck': {'Test': ['CMD', 'node', '-e', release.AUTH_HEALTH_PROBE],
                                       'Interval': 30_000_000_000, 'Timeout': 10_000_000_000,
                                       'StartPeriod': 30_000_000_000, 'Retries': 3},
                       'Env': [k + '=' + v for k, v in self.env.items()] + ['EXPECTED_BUILD_SHA=' + self.env['JUDGE_RELEASE_SHA']]},
            'HostConfig': {
                'ReadonlyRootfs': True, 'Init': True, 'PidsLimit': 128,
                'Memory': 512 * 1024 * 1024, 'MemorySwap': 512 * 1024 * 1024, 'NanoCpus': 500000000,
                'RestartPolicy': {'Name': 'unless-stopped'}, 'CapDrop': ['ALL'],
                'SecurityOpt': ['no-new-privileges:true'],
                'PortBindings': {'3000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '4596'}]},
                'Tmpfs': {name: 'rw,noexec,nosuid,nodev,size=32m,uid=1000,gid=1000,mode=0700'
                          for name in ['/tmp', '/app/.next/cache']},
                'LogConfig': {'Type': 'json-file', 'Config': {'max-size': '10m', 'max-file': '3'}},
            },
            'Mounts': [{'Destination': '/data', 'Type': 'bind', 'RW': True, 'Source': self.data.as_posix()}],
        }]

    def test_valid_protected_configuration_and_immutable_image(self):
        self.validate()
        self.env['JUDGE_RELEASE_IMAGE'] = 'sha256:' + 'b' * 64
        self.write()
        self.validate()

    def test_missing_unsafe_and_placeholder_settings_fail(self):
        cases = [('JUDGE_RELEASE_SHA', 'abc123'), ('JUDGE_RELEASE_IMAGE', 'localhost/mercado-cero:' + 'a' * 40),
                 ('APP_URL', 'http://127.0.0.1:4596'), ('APP_URL', 'https://evil.example'),
                 ('JUDGE_DATA_ROOT', '/data'), ('JUDGE_DEMO_ACCOUNTS', 'false'),
                 ('PEY_API_KEY', 'fixture-disabled-provider'), ('OPERATOR_ACCESS_TOKEN', 'fixture'),
                 ('TRUST_PROXY', '1'), ('PILOT_AUTH_SECRET', 'REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS'),
                 ('PILOT_AUTH_SECRET', 'a' * 64),
                 ('JUDGE_RELEASE_IMAGE', 'localhost/mercado-cero:' + 'c' * 40 + '@sha256:' + 'b' * 64)]
        original = dict(self.env)
        for key, value in cases:
            with self.subTest(key=key):
                self.env = dict(original)
                self.env[key] = value
                self.write()
                with self.assertRaises(release.InvalidRelease):
                    self.validate()
        self.env = dict(original)
        del self.env['PILOT_AUTH_SECRET']
        self.write()
        with self.assertRaises(release.InvalidRelease):
            self.validate()

    def test_parser_rejects_duplicate_unknown_and_shell_interpolation(self):
        for suffix in ['\nAPP_URL=https://mercado.zicua.com', '\nUNKNOWN=x', '\nPILOT_AUTH_SECRET=$(echo nope)',
                       '\nPILOT_AUTH_SECRET="quoted"']:
            with self.subTest(case=suffix.split('=')[0]):
                self.write('\n'.join(k + '=' + v for k, v in self.env.items()) + suffix)
                with self.assertRaises(release.InvalidRelease):
                    release.read_environment(self.file)

    @unittest.skipUnless(os.name == 'posix', 'POSIX ownership/modes require Linux; Windows uses ACLs')
    def test_permissions_and_wrong_data_owner_fail(self):
        self.file.chmod(0o644)
        with self.assertRaises(release.InvalidRelease):
            release.read_environment(self.file)
        self.file.chmod(0o600)
        self.data.chmod(0o755)
        with self.assertRaises(release.InvalidRelease):
            release.private_path(self.data, directory=True)
        self.data.chmod(0o700)
        with self.assertRaises(release.InvalidRelease):
            release.private_path(self.data, directory=True, owner=os.geteuid() + 1)
        for mode in [0o500, 0o600]:
            self.data.chmod(mode)
            try:
                with self.assertRaises(release.InvalidRelease):
                    release.private_path(self.data, directory=True)
            finally:
                self.data.chmod(0o700)

    def test_data_path_must_be_private_sibling_and_inside_workspace(self):
        self.env['JUDGE_RELEASE_DATA_DIR'] = str(self.root.parent)
        self.write()
        with self.assertRaises(release.InvalidRelease):
            self.validate()
        self.env['JUDGE_RELEASE_ENV_FILE'] = str(self.root / 'other.env')
        self.write()
        with self.assertRaises(release.InvalidRelease):
            self.validate()

    def test_inspection_matches_runtime_and_hardening(self):
        release.validate_inspect(self.inspected(), self.env)
        modifications = [
            lambda x: x[0]['Config'].update(User='0'),
            lambda x: x[0]['Config'].update(Entrypoint=['npm', 'start']),
            lambda x: x[0]['Config']['Env'].append('PEY_API_KEY=fixture'),
            lambda x: x[0]['HostConfig'].update(ReadonlyRootfs=False),
            lambda x: x[0]['HostConfig'].update(Privileged=True),
            lambda x: x[0]['HostConfig'].update(PidsLimit=0),
            lambda x: x[0]['HostConfig'].update(MemorySwap=1024 * 1024 * 1024),
            lambda x: x[0]['HostConfig']['RestartPolicy'].update(Name='no'),
            lambda x: x[0]['HostConfig']['PortBindings']['3000/tcp'][0].update(HostIp='0.0.0.0'),
            lambda x: x[0]['Mounts'][0].update(Source='/data/other'),
            lambda x: x[0]['Mounts'].append({'Type': 'bind', 'Destination': '/host'}),
            lambda x: x[0]['HostConfig']['Tmpfs'].update({'/tmp': 'rw,size=32m'}),
        ]
        for change in modifications:
            item = self.inspected()
            change(item)
            with self.assertRaises(release.InvalidRelease):
                release.validate_inspect(item, self.env)

    def test_direct_image_id_requires_actual_container_image_match(self):
        self.env['JUDGE_RELEASE_IMAGE'] = 'sha256:' + 'b' * 64
        release.validate_inspect(self.inspected(), self.env)
        item = self.inspected()
        item[0]['Image'] = 'sha256:' + 'c' * 64
        with self.assertRaises(release.InvalidRelease):
            release.validate_inspect(item, self.env)

    def test_inspection_rejects_disabled_liveness_only_or_changed_health_timing(self):
        for field, value in [('Test', ['NONE']),
                             ('Test', ['CMD', 'node', '-e', "fetch('http://127.0.0.1:3000/api/health')"]),
                             ('Interval', 60_000_000_000), ('Timeout', 30_000_000_000),
                             ('StartPeriod', 0), ('Retries', 1)]:
            with self.subTest(field=field):
                item = self.inspected()
                item[0]['Config']['Healthcheck'][field] = value
                with self.assertRaises(release.InvalidRelease):
                    release.validate_inspect(item, self.env)

    def test_ready_requires_exact_sha_demo_and_anonymous_initialized_session(self):
        good = {'/api/health': (200, {'ok': True, 'buildSha': self.env['JUDGE_RELEASE_SHA'], 'demoMode': True}),
                '/api/access/session': (401, {'error': 'Inicia sesión para continuar.'})}
        release.check_ready(self.env, lambda route: good[route])
        for route, replacement in [('/api/health', (200, {'ok': True, 'buildSha': 'c' * 40, 'demoMode': True})),
                                   ('/api/health', (200, [])),
                                   ('/api/access/session', (503, {'error': 'closed'})),
                                   ('/api/access/session', (200, {'user': {}})),
                                   ('/api/access/session', (302, {})),
                                   ('/api/access/session', (401, {'error': 'wrong endpoint'}))]:
            responses = dict(good)
            responses[route] = replacement
            with self.assertRaises(release.InvalidRelease):
                release.check_ready(self.env, lambda key: responses[key])

    def test_http_transport_is_fixed_loopback_no_proxy_no_redirect_and_no_credentials(self):
        class Response:
            status = 401
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def geturl(self): return release.ORIGIN + '/api/access/session'
            def read(self, limit): return b'{"error":"fixture"}'
        with patch.object(release.urllib.request, 'build_opener') as make:
            make.return_value.open.return_value = Response()
            status, _ = release.fetch_local('/api/access/session')
            self.assertEqual(status, 401)
            handlers = make.call_args.args
            self.assertEqual(handlers[0].proxies, {})
            self.assertIsInstance(handlers[1], release.NoRedirect)
            request = make.return_value.open.call_args.args[0]
            self.assertEqual(request.full_url, 'http://127.0.0.1:4596/api/access/session')
            self.assertIsNone(request.get_header('Cookie'))
            self.assertIsNone(request.get_header('Authorization'))

    def test_cli_failures_never_echo_secret_or_private_setting_values(self):
        self.env['APP_URL'] = 'https://private-fixture.invalid'
        self.write()
        result = subprocess.run([sys.executable, str(SOURCE), '--env-file', str(self.file)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(self.env['PILOT_AUTH_SECRET'], result.stdout + result.stderr)
        self.assertNotIn(self.env['APP_URL'], result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
