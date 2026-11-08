import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from legacy_archive import capture, mode


class LegacyArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.root.chmod(0o700)
        self.source = self.root / 'legacy-archive/mercado-cero.db'
        self.source.parent.mkdir(mode=0o700)
        db = sqlite3.connect(self.source)
        db.executescript('CREATE TABLE orders(id TEXT); CREATE TABLE payments(id TEXT); INSERT INTO orders VALUES("owner-retained");')
        db.close()
        self.source.chmod(0o600)
        self.stage = self.root / 'backup-current/database'
        self.stage.mkdir(parents=True, mode=0o700)
        (self.stage / 'mercado-cero.db').write_text('previous verified backup')
        (self.root / 'judge-backup.env').write_text('protected fixture')
        (self.root / 'judge-backup.env').chmod(0o600)
        self.target(True)
        self.manifest = {'version': 1, 'source': self.source.as_posix(),
                         'sha256': hashlib.sha256(self.source.read_bytes()).hexdigest(),
                         'capturedAt': '2026-01-01T00:00:00Z', 'reason': 'retired_legacy'}
        self.write_manifest()

    def target(self, judge):
        path = self.root / 'runtime-target.json'
        path.write_text(json.dumps({'version': 1, 'buildSha': 'a' * 40, 'requireJudgeAccounts': judge}))
        path.chmod(0o600)

    def write_manifest(self):
        path = self.root / 'legacy-archive.json'
        path.write_text(json.dumps(self.manifest))
        path.chmod(0o600)

    def preserved(self):
        self.assertEqual((self.stage / 'mercado-cero.db').read_text(), 'previous verified backup')

    def test_legacy_default_does_not_require_archive(self):
        (self.root / 'runtime-target.json').unlink()
        (self.root / 'legacy-archive.json').unlink()
        self.assertEqual(mode(self.root), 'legacy')
        self.target(False)
        self.assertEqual(mode(self.root), 'legacy')
        with self.assertRaises(ValueError): capture(self.root)
        self.preserved()

    def test_archive_retains_exact_database_and_manifest_and_requires_judge_hook(self):
        original = self.source.read_bytes()
        capture(self.root)
        self.assertEqual((self.stage / 'mercado-cero.db').read_bytes(), original)
        self.assertEqual(self.source.read_bytes(), original)
        self.assertEqual(json.loads((self.stage / 'legacy-archive.json').read_text()), self.manifest)
        (self.root / 'judge-backup.env').unlink()
        with self.assertRaises(OSError): capture(self.root)

    def test_missing_manifest_and_changed_hash_preserve_previous_backup(self):
        (self.root / 'legacy-archive.json').unlink()
        with self.assertRaises(OSError): capture(self.root)
        self.preserved()
        self.manifest['sha256'] = 'b' * 64
        self.write_manifest()
        with self.assertRaises(ValueError): capture(self.root)
        self.preserved()

    def test_invalid_path_future_time_unknown_keys_and_sqlite_fail_closed(self):
        original = dict(self.manifest)
        for key, value in [('source', '/etc/other'), ('capturedAt', '2999-01-01T00:00:00Z'),
                           ('version', True), ('reason', 'active'), ('extra', 'not allowed')]:
            self.manifest = {**original, key: value}
            self.write_manifest()
            with self.assertRaises(ValueError): capture(self.root)
            self.preserved()
        self.source.write_bytes(b'not SQLite')
        self.manifest = {**original, 'sha256': hashlib.sha256(self.source.read_bytes()).hexdigest()}
        self.write_manifest()
        with self.assertRaises(sqlite3.Error): capture(self.root)
        self.preserved()

    def test_live_wal_sidecar_and_invalid_target_are_rejected(self):
        sidecar = Path(str(self.source) + '-wal')
        sidecar.write_text('not a standalone snapshot')
        with self.assertRaises(ValueError): capture(self.root)
        self.preserved()
        sidecar.unlink()
        (self.root / 'runtime-target.json').write_text('{')
        with self.assertRaises(ValueError): capture(self.root)
        self.preserved()

    @unittest.skipUnless(os.name == 'posix', 'POSIX symlinks/modes checked on Linux')
    def test_unsafe_permissions_and_links_are_rejected(self):
        self.source.chmod(0o644)
        with self.assertRaises(ValueError): capture(self.root)
        self.source.chmod(0o600)
        real = self.source.with_name('real.db')
        self.source.rename(real)
        self.source.symlink_to(real)
        with self.assertRaises(ValueError): capture(self.root)
        self.preserved()


if __name__ == '__main__': unittest.main()
