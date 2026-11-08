import importlib.util
import json
from contextlib import closing
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('verify-judge-snapshot.py')
SPEC = importlib.util.spec_from_file_location('judge_verifier', SCRIPT)
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)
TIME = '2026-11-07T12:00:00.000Z'


class VerifyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.source = self.base / 'snapshot'
        self.restored = self.base / 'restored'
        identity = self.source / 'identity/identity.sqlite'
        identity.parent.mkdir(parents=True)
        with closing(sqlite3.connect(identity)) as db:
            db.executescript('CREATE TABLE user(id TEXT PRIMARY KEY, password TEXT);'
                             'CREATE TABLE session(id TEXT, userId TEXT);'
                             'CREATE TABLE "odd""table"(value BLOB);'
                             'INSERT INTO user VALUES ("alpha", "private-password"), ("beta", "other");'
                             'INSERT INTO session VALUES ("secret-session", "alpha");'
                             'INSERT INTO "odd""table" VALUES (x\'00ff\'), (x\'00ff\');')
        self.directory = verifier.hashlib.sha256(b'alpha').hexdigest()
        business = self.source / 'business' / self.directory / 'demo.sqlite'
        business.parent.mkdir(parents=True)
        with closing(sqlite3.connect(business)) as db:
            db.executescript('CREATE TABLE sale(id INTEGER, amount INTEGER); INSERT INTO sale VALUES (1,42);')
        def record(path):
            return dict(startedAt=TIME, completedAt=TIME, sha256=verifier.digest(path))
        self.manifest = dict(version=1, identity=record(identity), accounts=[
            dict(userId='alpha', directory=self.directory, status='captured', database=record(business)),
            dict(userId='beta', directory=verifier.hashlib.sha256(b'beta').hexdigest(), status='notCreated')])
        self.save_manifest()
        shutil.copytree(self.source, self.restored)
        (self.restored / 'manifest.json').unlink()
        self.change(self.restored / 'identity/identity.sqlite', 'DELETE FROM session')

    def save_manifest(self):
        (self.source / 'manifest.json').write_text(json.dumps(self.manifest), encoding='utf-8')

    def change(self, path, sql):
        with closing(sqlite3.connect(path)) as db:
            db.execute(sql)
            db.commit()

    def verify(self):
        return verifier.verify(self.source, self.restored, TIME)

    def test_source_and_restored_success_read_only(self):
        before = {str(p): p.read_bytes() for p in self.base.rglob('*') if p.is_file()}
        self.assertEqual(verifier.verify(self.source, snapshot_time=TIME),
                         dict(accounts=2, captured=1, sessionsRevoked=0))
        self.assertEqual(self.verify(), dict(accounts=2, captured=1, sessionsRevoked=1))
        self.assertEqual(before, {str(p): p.read_bytes() for p in self.base.rglob('*') if p.is_file()})

    def test_identity_changes_and_sessions_rejected(self):
        identity = self.restored / 'identity/identity.sqlite'
        for statement in ['INSERT INTO session VALUES ("left", "alpha")',
                          'UPDATE user SET password="changed" WHERE id="alpha"',
                          'UPDATE user SET id="changed" WHERE id="alpha"',
                          'DELETE FROM "odd""table" WHERE rowid=1',
                          'CREATE TABLE extra(value TEXT)']:
            with self.subTest(statement=statement):
                shutil.copyfile(self.source / 'identity/identity.sqlite', identity)
                self.change(identity, 'DELETE FROM session')
                self.change(identity, statement)
                with self.assertRaises(verifier.ValidationError):
                    self.verify()

    def test_business_change_and_snapshot_hash_rejected(self):
        relative = Path('business') / self.directory / 'demo.sqlite'
        self.change(self.restored / relative, 'UPDATE sale SET amount=43')
        with self.assertRaises(verifier.ValidationError):
            self.verify()
        self.change(self.source / relative, 'UPDATE sale SET amount=44')
        with self.assertRaises(verifier.ValidationError):
            verifier.verify(self.source)

    def test_exact_tree_and_missing(self):
        for root in (self.source, self.restored):
            for name in ('unexpected', 'identity/identity.sqlite-wal'):
                with self.subTest(root=root, name=name):
                    extra = root / name
                    extra.write_bytes(b'nonempty')
                    with self.assertRaises(verifier.ValidationError):
                        self.verify()
                    extra.unlink()
            (root / 'extra-directory').mkdir()
            with self.assertRaises(verifier.ValidationError):
                self.verify()
            (root / 'extra-directory').rmdir()
        missing = self.restored / 'business' / self.directory / 'demo.sqlite'
        missing.unlink()
        with self.assertRaises(verifier.ValidationError):
            self.verify()

    def test_empty_identity_sidecars_allowed_only_restored(self):
        for suffix in ('-wal', '-shm'):
            (self.restored / ('identity/identity.sqlite' + suffix)).touch()
        self.verify()
        (self.source / 'identity/identity.sqlite-wal').touch()
        with self.assertRaises(verifier.ValidationError):
            self.verify()

    def test_timestamps_all_records(self):
        for record in [self.manifest['identity'], self.manifest['accounts'][0]['database']]:
            for start, end in [('2026-11-07T11:44:59Z', TIME),
                               (TIME, '2026-11-07T12:05:01Z'),
                               ('2026-11-07T12:00:00', TIME),
                               ('2026-11-07T12:01:00Z', TIME)]:
                with self.subTest(start=start, end=end):
                    record.update(startedAt=start, completedAt=end)
                    self.save_manifest()
                    with self.assertRaises(verifier.ValidationError):
                        self.verify()
            record.update(startedAt=TIME, completedAt=TIME)
        self.save_manifest()
        self.verify()

    def test_manifest_strict_keys_mapping_order_and_limits(self):
        original = json.dumps(self.manifest)
        variants = []
        bad = json.loads(original); bad['extra'] = True; variants.append(bad)
        bad = json.loads(original); bad['accounts'].reverse(); variants.append(bad)
        bad = json.loads(original); bad['accounts'][0]['directory'] = '../escape'; variants.append(bad)
        bad = json.loads(original); bad['accounts'] *= 51; variants.append(bad)
        bad = json.loads(original); bad['version'] = True; variants.append(bad)
        for variant in variants:
            self.manifest = variant
            self.save_manifest()
            with self.assertRaises(verifier.ValidationError):
                self.verify()
        (self.source / 'manifest.json').write_text(' ' * (128 * 1024 + 1))
        with self.assertRaises(verifier.ValidationError):
            self.verify()

    def test_symlink_ancestor_rejected(self):
        link = self.base / 'linked'
        try:
            link.symlink_to(self.source, target_is_directory=True)
        except OSError:
            self.skipTest('Symlink creation unavailable')
        with self.assertRaises(verifier.ValidationError):
            verifier.verify(link)

    @unittest.skipUnless(sys.platform == 'win32', 'Windows junction test')
    def test_junction_ancestor_rejected(self):
        link = self.base / 'junction'
        result = subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(self.source)], capture_output=True)
        self.assertEqual(result.returncode, 0)
        try:
            with self.assertRaises(verifier.ValidationError):
                verifier.verify(link)
        finally:
            link.rmdir()

    def test_cli_private_output(self):
        result = subprocess.run([sys.executable, str(SCRIPT), str(self.source), '--restored-root', str(self.restored),
                                 '--snapshot-time', TIME], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout), dict(accounts=2, captured=1, sessionsRevoked=1))
        (self.source / 'manifest.json').write_text('{private-password')
        result = subprocess.run([sys.executable, str(SCRIPT), str(self.source)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertEqual(result.stderr, 'Judge recovery verification failed.\n')

    def test_actual_node_restore(self):
        node = shutil.which('node')
        if node is None:
            self.skipTest('Node unavailable')
        target = self.base / 'node-restored'
        captured = self.base / 'node-snapshot'
        command = SCRIPT.parent.parent / 'judge-snapshot.mjs'
        with closing(sqlite3.connect(self.source / 'identity/identity.sqlite')) as db:
            db.execute('PRAGMA journal_mode=WAL')
        result = subprocess.run([node, str(command), 'snapshot', str(self.source), str(captured)], capture_output=True)
        self.assertEqual(result.returncode, 0, 'Node fixture snapshot failed')
        result = subprocess.run([node, str(command), 'restore', str(captured), str(target)], capture_output=True)
        self.assertEqual(result.returncode, 0, 'Node fixture restore failed')
        self.assertEqual(verifier.verify(captured, target), dict(accounts=2, captured=1, sessionsRevoked=1))

    def test_hash_matching_invalid_database_rejected(self):
        business = self.source / 'business' / self.directory / 'demo.sqlite'
        business.write_bytes(b'not a sqlite database')
        self.manifest['accounts'][0]['database']['sha256'] = verifier.digest(business)
        self.save_manifest()
        with self.assertRaises(sqlite3.DatabaseError):
            verifier.verify(self.source)


if __name__ == '__main__':
    unittest.main()
