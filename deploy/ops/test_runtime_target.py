import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import urllib.error

from runtime_target import LEGACY_TARGET, load_runtime_target, validate_runtime_target, verify_readiness

spec = importlib.util.spec_from_file_location('wait_app', Path(__file__).with_name('wait-app.py'))
wait_app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wait_app)  # Must not poll, sleep or contact the origin on import.
TARGET = {'version': 1, 'buildSha': 'a' * 40, 'requireJudgeAccounts': True}


class RuntimeTargetChecks(unittest.TestCase):
    def test_missing_file_retains_only_legacy_nonjudge_target(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(load_runtime_target(Path(directory) / 'missing.json'), LEGACY_TARGET)

    def test_valid_bom_and_uppercase_sha(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'target.json'
            path.write_text(json.dumps({**TARGET, 'buildSha': 'A' * 40}), encoding='utf-8-sig')
            self.assertEqual(load_runtime_target(path), TARGET)

    def test_invalid_present_file_never_falls_back(self):
        texts = ['{', 'null', '[]', json.dumps({**TARGET, 'url': 'http://elsewhere'}),
                 json.dumps({**TARGET, 'buildSha': 'abc'}), json.dumps({**TARGET, 'version': True}),
                 json.dumps({**TARGET, 'requireJudgeAccounts': 'true'}),
                 '{"version":1,"version":1,"buildSha":"' + 'a' * 40 + '","requireJudgeAccounts":true}',
                 json.dumps(TARGET) + (' ' * 4097)]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'target.json'
            for text in texts:
                with self.subTest(text=text[:80]):
                    path.write_text(text, encoding='utf-8')
                    with self.assertRaises(ValueError):
                        load_runtime_target(path)

    def test_health_truth_sha_and_auth_are_all_required(self):
        for health, status in [({'ok': False, 'buildSha': 'a' * 40}, 401),
                               ({'ok': 1, 'buildSha': 'a' * 40}, 401),
                               ({'ok': True, 'buildSha': 'b' * 40}, 401),
                               ({'ok': True, 'buildSha': 'a' * 40}, 503),
                               ({'ok': True, 'buildSha': 'a' * 40}, 200),
                               ({'ok': True, 'buildSha': 'a' * 40}, None)]:
            with self.subTest(health=health, status=status), self.assertRaises(ValueError):
                verify_readiness(health, TARGET, status)
        verify_readiness({'ok': True, 'buildSha': 'a' * 40}, TARGET, 401)
        verify_readiness({'ok': True, 'buildSha': 'a' * 40}, {**TARGET, 'requireJudgeAccounts': False})

    def test_wait_checks_actual_unauthenticated_endpoint_status(self):
        for status in [401, 503]:
            opener = Mock()
            health = io.StringIO(json.dumps({'ok': True, 'buildSha': TARGET['buildSha']}))
            health.code = 200
            opener.open.side_effect = [health, urllib.error.HTTPError('local', status, '', {}, None)]
            if status == 401:
                wait_app.check_once(TARGET, opener)
            else:
                with self.assertRaises(ValueError):
                    wait_app.check_once(TARGET, opener)
            self.assertEqual(opener.open.call_args.args[0], 'http://127.0.0.1:4590/api/access/session')

    def test_wait_retries_failures_and_finishes_without_sleep_after_last(self):
        check = Mock(side_effect=[ValueError('wrong SHA'), OSError('offline')])
        sleep = Mock()
        self.assertFalse(wait_app.wait_for_app(TARGET, attempts=2, check=check, sleep=sleep))
        self.assertEqual(check.call_count, 2)
        sleep.assert_called_once_with(1)
        self.assertTrue(wait_app.wait_for_app(TARGET, check=Mock(), sleep=Mock()))

    def test_invalid_target_main_refuses_before_origin_poll(self):
        with patch.object(wait_app, 'load_runtime_target', side_effect=ValueError('invalid')):
            with patch.object(wait_app, 'wait_for_app') as wait:
                with self.assertRaises(SystemExit):
                    wait_app.main()
                wait.assert_not_called()


if __name__ == '__main__':
    unittest.main()
