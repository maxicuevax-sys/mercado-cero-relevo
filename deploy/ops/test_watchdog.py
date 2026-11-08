import unittest
from datetime import datetime, timedelta, timezone
from watchdog import transition, verify_backup


class WatchdogChecks(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
