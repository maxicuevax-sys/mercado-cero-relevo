#!/usr/bin/env python3
"""Read-only, content-private verification of a judge recovery snapshot."""
import argparse
from collections import Counter
from contextlib import closing
from datetime import datetime, timedelta
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
import sys


class ValidationError(Exception):
    pass


def require(condition):
    if not condition:
        raise ValidationError()


def no_links(path):
    path = Path(os.path.abspath(path))
    for item in (path, *path.parents):
        try:
            info = item.lstat()
        except FileNotFoundError:
            continue
        require(not stat.S_ISLNK(info.st_mode))
        require(not getattr(info, 'st_file_attributes', 0) & 0x400)
    return path


def exact_keys(value, keys):
    require(type(value) is dict and set(value) == set(keys))


def timestamp(value):
    require(type(value) is str and bool(re.fullmatch(
        r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})', value)))
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.utcoffset() is not None)
    return result


def record(value, snapshot_time):
    exact_keys(value, ('startedAt', 'completedAt', 'sha256'))
    require(type(value['sha256']) is str and bool(re.fullmatch('[a-f0-9]{64}', value['sha256'])))
    start, end = timestamp(value['startedAt']), timestamp(value['completedAt'])
    require(start <= end)
    if snapshot_time is not None:
        require(snapshot_time - timedelta(minutes=15) <= start <= end <= snapshot_time + timedelta(minutes=5))


def digest(path):
    no_links(path)
    require(path.is_file())
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()


def database(path):
    no_links(path)
    require(path.is_file())
    return sqlite3.connect(path.as_uri() + '?mode=ro&immutable=1', uri=True)


def integrity(path):
    with closing(database(path)) as db:
        require(db.execute('PRAGMA integrity_check').fetchall() == [('ok',)])


def exact_tree(root, files, optional_empty=()):
    root = no_links(root)
    require(root.is_dir())
    allowed = set(files)
    for name in files:
        allowed.update(str(p).replace('\\', '/') for p in Path(name).parents if str(p) != '.')
    seen = set()
    for directory, directories, names in os.walk(root, followlinks=False):
        for name in directories + names:
            path = no_links(Path(directory) / name)
            relative = path.relative_to(root).as_posix()
            if relative in optional_empty:
                require(path.is_file() and path.stat().st_size == 0)
                continue
            require(relative in allowed)
            require(path.is_file() if relative in files else path.is_dir())
            seen.add(relative)
    require(seen == allowed)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def quote_identifier(name):
    return '"' + name.replace('"', '""') + '"'


def compare_identity(source, restored):
    with closing(database(source)) as before, closing(database(restored)) as after:
        schema_query = 'SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name'
        schema = before.execute(schema_query).fetchall()
        require(schema == after.execute(schema_query).fetchall())
        tables = [row[1] for row in schema if row[0] == 'table']
        require('session' in tables)
        revoked = 0
        for table in tables:
            query = 'SELECT * FROM ' + quote_identifier(table)
            # Preserve SQLite storage classes as well as duplicate-row counts.
            original = Counter(tuple((type(value).__name__, value) for value in row) for row in before.execute(query))
            recovered = Counter(tuple((type(value).__name__, value) for value in row) for row in after.execute(query))
            if table == 'session':
                require(not recovered)
                revoked = sum(original.values())
            else:
                require(original == recovered)
        return revoked


def verify(snapshot_root, restored_root=None, snapshot_time=None):
    root = no_links(snapshot_root)
    reference = timestamp(snapshot_time) if snapshot_time is not None else None
    manifest_path = no_links(root / 'manifest.json')
    require(manifest_path.is_file() and manifest_path.stat().st_size <= 128 * 1024)
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'), object_pairs_hook=unique_object)
    exact_keys(manifest, ('version', 'identity', 'accounts'))
    require(type(manifest['version']) is int and manifest['version'] == 1)
    require(type(manifest['accounts']) is list and len(manifest['accounts']) <= 100)
    record(manifest['identity'], reference)
    expected = {'identity/identity.sqlite': manifest['identity']['sha256']}
    ids = []
    for account in manifest['accounts']:
        require(type(account) is dict)
        captured = account.get('status') == 'captured'
        exact_keys(account, ('userId', 'directory', 'status', 'database') if captured else ('userId', 'directory', 'status'))
        user_id = account['userId']
        require(type(user_id) is str and bool(user_id))
        require(account['directory'] == hashlib.sha256(user_id.encode('utf-8')).hexdigest())
        ids.append(user_id)
        if captured:
            record(account['database'], reference)
            expected['business/' + account['directory'] + '/demo.sqlite'] = account['database']['sha256']
        else:
            require(account['status'] == 'notCreated')
    require(len(set(ids)) == len(ids))
    exact_tree(root, set(expected) | {'manifest.json'})
    for relative, expected_hash in expected.items():
        require(digest(root / relative) == expected_hash)
        integrity(root / relative)
    with closing(database(root / 'identity/identity.sqlite')) as db:
        actual_ids = [row[0] for row in db.execute('SELECT id FROM "user" ORDER BY id LIMIT 101')]
    require(actual_ids == ids)
    revoked = 0
    if restored_root is not None:
        restored = no_links(restored_root)
        require(restored != root and root not in restored.parents and restored not in root.parents)
        # Node restore checkpoints identity WAL; a retained empty WAL/SHM is harmless.
        exact_tree(restored, set(expected), {'identity/identity.sqlite-wal', 'identity/identity.sqlite-shm'})
        for relative, expected_hash in expected.items():
            integrity(restored / relative)
            if relative != 'identity/identity.sqlite':
                require(digest(restored / relative) == expected_hash)
        revoked = compare_identity(root / 'identity/identity.sqlite', restored / 'identity/identity.sqlite')
    return {'accounts': len(ids), 'captured': len(expected) - 1, 'sessionsRevoked': revoked}


def main():
    class PrivateParser(argparse.ArgumentParser):
        def error(self, message):
            raise ValidationError()

    parser = PrivateParser(description=__doc__)
    parser.add_argument('snapshotRoot')
    parser.add_argument('--restored-root')
    parser.add_argument('--snapshot-time')
    try:
        args = parser.parse_args()
        summary = verify(args.snapshotRoot, args.restored_root, args.snapshot_time)
    except Exception:
        print('Judge recovery verification failed.', file=sys.stderr)
        return 1
    print(json.dumps(summary, sort_keys=True))
    return 0


if __name__ == '__main__':
    sys.exit(main())
