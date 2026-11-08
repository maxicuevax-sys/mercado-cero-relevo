import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from types import SimpleNamespace
import json
import contextlib
import io
from watchdog import transition, verify_backup, check_origin, check_access, ACCESS_PREFIX, main


class WatchdogChecks(unittest.TestCase):
    def public_mock(self, code, payload=None, location=None):
        response = io.BytesIO(json.dumps(payload or {}).encode())
        response.code = code
        response.headers = {'Location': location} if location else {}
        return response

    def test_public_judge_requires_exact_https_health_and_anonymous_session(self):
        target = {'version': 1, 'buildSha': 'a' * 40, 'requireJudgeAccounts': True}
        health = {'ok': True, 'buildSha': target['buildSha']}
        with patch('watchdog.urllib.request.build_opener') as factory:
            factory.return_value.open.side_effect = [self.public_mock(200, health), self.public_mock(401)]
            check_access(target)
            urls = [call.args[0].full_url for call in factory.return_value.open.call_args_list]
            self.assertEqual(urls, ['https://mercado.zicua.com/api/health', 'https://mercado.zicua.com/api/access/session'])
        for status, value in [(302, health), (200, {'ok': True, 'buildSha': 'b' * 40})]:
            with patch('watchdog.urllib.request.build_opener') as factory:
                factory.return_value.open.side_effect = [self.public_mock(status, value), self.public_mock(401)]
                with self.assertRaises(ValueError): check_access(target)
        for status in [200, 302, 503]:
            with patch('watchdog.urllib.request.build_opener') as factory:
                factory.return_value.open.side_effect = [self.public_mock(200, health), self.public_mock(status)]
                with self.assertRaises(ValueError): check_access(target)

    def test_legacy_still_requires_access_redirect(self):
        target = {'version': 1, 'buildSha': 'a' * 40, 'requireJudgeAccounts': False}
        with patch('watchdog.urllib.request.build_opener') as factory:
            factory.return_value.open.return_value = self.public_mock(302, location=ACCESS_PREFIX + '?redirect=fixture')
            check_access(target)
        for code, location in [(200, None), (302, 'https://other.example')]:
            with patch('watchdog.urllib.request.build_opener') as factory:
                factory.return_value.open.return_value = self.public_mock(code, location=location)
                with self.assertRaises(ValueError): check_access(target)

    def test_healthy_start_is_silent(self):
        self.assertIsNone(transition({}, True, 0)[1])

    def test_one_transient_failure_is_silent(self):
        state, event = transition({}, False, 0)
        self.assertIsNone(event)
        self.assertIsNone(transition(state, True, 300)[1])

    def test_two_failures_alert_once_then_wait_an_hour(self):
        state, _ = transition({}, False, 0)
        state, event = transition(state, False, 300)
        self.assertEqual(event, 'failure')
        state, event = transition(state, False, 600)
        self.assertIsNone(event)
        self.assertEqual(transition(state, False, 3900)[1], 'failure')

    def test_recovery_only_after_reported_failure(self):
        state, _ = transition({}, False, 0)
        state, _ = transition(state, False, 300)
        state, event = transition(state, True, 600)
        self.assertEqual(event, 'recovery')
        self.assertIsNone(transition(state, True, 900)[1])

    def test_fresh_restore_of_stale_snapshot_is_rejected(self):
        now = datetime.now(timezone.utc)
        with self.assertRaises(ValueError):
            verify_backup({'ok': True, 'restoreVerified': True, 'timestamp': now.isoformat(),
                           'sourceSnapshotTime': (now - timedelta(hours=7)).isoformat()}, now)

    def test_future_timestamp_is_rejected(self):
        now = datetime.now(timezone.utc)
        with self.assertRaises(ValueError):
            verify_backup({'ok': True, 'restoreVerified': True, 'timestamp': now.isoformat(),
                           'sourceSnapshotTime': (now + timedelta(hours=1)).isoformat()}, now)

    def test_missing_restore_is_rejected(self):
        with self.assertRaises(ValueError):
            verify_backup({'ok': True, 'restoreVerified': False}, datetime.now(timezone.utc))

    def test_verified_current_snapshot_is_accepted(self):
        now = datetime.now(timezone.utc)
        verify_backup({'ok': True, 'restoreVerified': True, 'timestamp': now.isoformat(),
                       'sourceSnapshotTime': (now - timedelta(hours=1)).isoformat()}, now)

    def test_judge_mode_requires_judge_restore_proof(self):
        now = datetime.now(timezone.utc)
        target = {'version': 1, 'buildSha': 'a' * 40, 'requireJudgeAccounts': True}
        report = {'ok': True, 'restoreVerified': True, 'timestamp': now.isoformat(),
                  'sourceSnapshotTime': now.isoformat()}
        for proof in [None, False, 'true']:
            with self.subTest(proof=proof), self.assertRaises(ValueError):
                verify_backup({**report, 'judgeRestoreVerified': proof}, now, target)
        verify_backup({**report, 'judgeRestoreVerified': True}, now, target)

    def test_origin_rejects_wrong_sha_and_false_health(self):
        target = {'version': 1, 'buildSha': 'a' * 40, 'requireJudgeAccounts': False}
        for health in [{'ok': True, 'buildSha': 'b' * 40}, {'ok': False, 'buildSha': 'a' * 40}]:
            with patch('watchdog.subprocess.run', return_value=SimpleNamespace(returncode=0, stdout=json.dumps(health))):
                with self.assertRaises(ValueError):
                    check_origin(target)

    def test_origin_requires_ready_judge_session_and_keeps_fixed_url(self):
        target = {'version': 1, 'buildSha': 'a' * 40, 'requireJudgeAccounts': True}
        health = SimpleNamespace(returncode=0, stdout=json.dumps({'ok': True, 'buildSha': 'a' * 40}))
        for status in ['401', '503', '200', '302']:
            with patch('watchdog.subprocess.run', side_effect=[health, SimpleNamespace(returncode=0, stdout=status)]) as run:
                if status == '401':
                    check_origin(target)
                else:
                    with self.assertRaises(ValueError):
                        check_origin(target)
                self.assertIn('http://127.0.0.1:4590/api/access/session', run.call_args.args[0][-1])

    def test_invalid_configuration_is_reported_red_without_legacy_probe(self):
        output = io.StringIO()
        with patch('sys.argv', ['watchdog.py', '--check-only']), contextlib.redirect_stdout(output):
            with patch('watchdog.load_runtime_target', side_effect=ValueError('invalid')):
                with patch('watchdog.check_access'), patch('watchdog.check_origin') as origin:
                    with self.assertRaises(SystemExit) as exited:
                        main()
                    self.assertEqual(exited.exception.code, 1)
                    origin.assert_not_called()
        report = json.loads(output.getvalue())
        self.assertFalse(report['ok'])
        self.assertEqual(report['checks'][0]['name'], 'Runtime target')


if __name__ == '__main__':
    unittest.main()
