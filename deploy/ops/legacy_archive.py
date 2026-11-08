"""Preserve the retired owner's frozen SQLite snapshot in every judge backup.

No container/SQL writes. The private manifest is data, never executed. Capture
requires judge mode and its separate backup configuration; legacy mode is intact.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import stat
import sys
from runtime_target import load_runtime_target

ROOT = Path('/opt/mercado-cero/pilot')


def private(path, directory=False):
    for item in [path, *path.parents]:
        if item.is_symlink():
            raise ValueError('Symlink rejected')
    info = path.stat()
    if (not stat.S_ISDIR(info.st_mode) if directory else not stat.S_ISREG(info.st_mode)):
        raise ValueError('Unexpected file type')
    if os.name == 'posix' and (info.st_uid != os.geteuid() or info.st_mode & 0o077):
        raise ValueError('Private ownership/permissions required')


def unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate manifest key')
        result[key] = value
    return result


def mode(root=ROOT):
    target = root / 'runtime-target.json'
    if target.is_symlink():
        raise ValueError('Symlink target rejected')
    if target.exists():
        private(target)
    return 'archive' if load_runtime_target(target)['requireJudgeAccounts'] else 'legacy'


def digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def verify_sqlite(path):
    if any(Path(str(path) + suffix).exists() for suffix in ['-wal', '-shm', '-journal']):
        raise ValueError('Frozen snapshot must be standalone')
    database = sqlite3.connect(path.as_uri() + '?mode=ro&immutable=1', uri=True)
    try:
        if database.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Invalid SQLite archive')
        # Preserve the owner database contract consumed by the existing verifier.
        for table in ['orders', 'payments']:
            database.execute('SELECT count(*) FROM ' + table).fetchone()
    finally:
        database.close()


def capture(root=ROOT):
    if mode(root) != 'archive':
        raise ValueError('Archive capture requires explicit judge target')
    private(root / 'judge-backup.env')  # Never make the joint judge hook optional.
    manifest_path = root / 'legacy-archive.json'
    private(manifest_path)
    if manifest_path.stat().st_size > 4096:
        raise ValueError('Manifest too large')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'), object_pairs_hook=unique)
    if not isinstance(manifest, dict) or set(manifest) != {'version', 'source', 'sha256', 'capturedAt', 'reason'}:
        raise ValueError('Invalid archive manifest')
    source = root / 'legacy-archive/mercado-cero.db'
    if type(manifest['version']) is not int or manifest['version'] != 1 or manifest['source'] != source.as_posix() or manifest['reason'] != 'retired_legacy':
        raise ValueError('Invalid archive identity')
    if not isinstance(manifest['sha256'], str) or not re.fullmatch('[0-9a-f]{64}', manifest['sha256']):
        raise ValueError('Invalid archive digest')
    stamp = datetime.fromisoformat(manifest['capturedAt'].replace('Z', '+00:00'))
    if stamp.tzinfo is None or (stamp - datetime.now(timezone.utc)).total_seconds() > 300:
        raise ValueError('Invalid archive timestamp')
    private(source.parent, directory=True)
    private(source)
    if digest(source) != manifest['sha256']:
        raise ValueError('Archive digest mismatch')
    verify_sqlite(source)
    destination = root / 'backup-current/database'
    private(destination, directory=True)
    output = destination / 'mercado-cero.db'
    incoming = destination / '.legacy-archive.partial'
    for path in [output, incoming, destination / 'legacy-archive.json']:
        if path.is_symlink():
            raise ValueError('Unsafe publication path')
    try:
        with incoming.open('xb') as target, source.open('rb') as original:
            shutil.copyfileobj(original, target)
            target.flush()
            os.fsync(target.fileno())
        if digest(incoming) != manifest['sha256'] or digest(source) != manifest['sha256']:
            raise ValueError('Archive changed during copy')
        verify_sqlite(incoming)
        os.replace(incoming, output)
        (destination / 'legacy-archive.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    finally:
        if incoming.exists():
            incoming.unlink()


def main():
    try:
        if sys.argv[1:] == ['mode']:
            print(mode())
        elif sys.argv[1:] == ['capture']:
            capture()
            print('Retired legacy archive verified.')
        else:
            raise ValueError('Invalid command')
    except (OSError, ValueError, TypeError, KeyError, sqlite3.Error):
        print('Legacy archive verification failed; no backup success recorded.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
