"""Read-only integrity and payment-domain checks on the restored pilot database."""
import json
import sqlite3
import sys
from pathlib import Path

database = Path(sys.argv[1]).resolve()
connection = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)
try:
    assert connection.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    count = connection.execute('SELECT count(*) FROM orders').fetchone()[0]
    # The smoke order is evidence that restore preserved the deployed data.
    order = connection.execute(
        'SELECT status, paid_cents, demo FROM orders WHERE id = ?',
        ('ord_7135b44274924e4e830c',),
    ).fetchone()
    if order is not None:
        assert order == ('demo_paid', 100, 1), 'Persisted smoke-order mismatch'
    print(json.dumps({'integrity': 'ok', 'orders': count, 'demoSmokeOrderPreserved': order is not None}))
finally:
    connection.close()
