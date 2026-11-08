# Judge-account joint recovery

Use Node.js 24 or newer. This utility snapshots the judge identity catalog and only the business databases belonging to that captured catalog. It does not change deployment configuration or start an application.

```powershell
node deploy/judge-snapshot.mjs snapshot 'C:\judge-data' 'C:\recovery\judge-cut-001'
node deploy/judge-snapshot.mjs restore 'C:\recovery\judge-cut-001' 'C:\recovery\judge-restored-001'
node --test deploy/judge-snapshot.test.mjs
```

Both destinations must be NEW directories, and their parent directories must already exist. Source and destination cannot be equal, contain each other, or traverse symlinks/junctions. Never point either command at an existing application data directory. Use explicit absolute paths during operations; examples are placeholders, not discovered production targets.

## Snapshot contract

This judge-demo utility accepts at most 100 captured users and a manifest no larger than 128 KiB. It rejects larger catalogs and metadata rather than attempting an unbounded import.

The source layout is `identity/identity.sqlite` with BetterAuth `user.id`, plus `business/<sha256(user.id)>/demo.sqlite`. Identity is captured first with SQLite `VACUUM INTO`, which includes committed WAL data without copying a live database/WAL pair. User IDs are read from that identity snapshot, then each corresponding business database is captured with its own `VACUUM INTO`. No business application imports or internal per-tenant backup files are needed.

The version 1 manifest records the identity capture interval, each captured user ID, its derived directory, each business capture interval and SHA-256, and explicit `notCreated` status when a business database does not exist. A restored `notCreated` account relies on the application's normal first-login seed behavior. Orphan business directories and users created after the identity cut are excluded. Treat the manifest as private: it contains account identifiers. Database content includes password hashes and private business data.

Each SQLite capture is individually consistent. There is NO cross-database transaction or single global recovery timestamp. The start/end timestamps bound each capture operation; they are not transaction commit timestamps. The identity catalog is the first cut, and business databases reflect later independent cuts. For example, a business write committed after the identity snapshot can be captured. Pause application writes externally when the recovery objective requires a coordinated logical cut. The utility does not promise application-level consistency across identity and business writes.

Before publication, the utility runs full SQLite `integrity_check`, verifies every database SHA-256, validates the user-to-directory mapping, and checks the exact snapshot tree. Unknown manifest keys, malformed records, extra files/directories, missing databases, unexpected paths and links are rejected. `manifest.json` is the root metadata and is structurally validated; database files carry hashes in it. The manifest does not hash itself. Hashes detect accidental corruption; they do not authenticate a maliciously rewritten manifest. Store snapshots in access-controlled storage with independent trusted retention.

## Restore contract and session revocation

Every copied database must match the hash captured from the initial verified manifest, before any session deletion. Re-reading source hashes alone is insufficient: a source file could change temporarily during copying and revert before the final source verification. The regression test simulates that transient valid-SQLite change and requires publication to fail.

Restore verifies the complete snapshot, copies verified database files into an adjacent new temporary directory, verifies the copies and revalidates the source. It then deletes ALL rows from the restored identity `session` table and verifies that the count is zero, followed by another integrity check. Missing or incompatible session schemas fail closed. Password hashes, users and per-account business records are preserved; active database sessions are not restored. Existing browser cookies must authenticate again through the application's database-backed session lookup. If authentication enables a stateless cookie/session cache that can bypass the database, separately invalidate that cache or rotate its signing secret before serving the restored environment. The utility does not manage secrets or browser cookies.

Snapshot and restore publish only after their validations succeed, using a rename from an adjacent temporary directory. The destination is never intentionally overwritten. Run with exclusive control of the snapshot and destination parent: this is not a defense against a hostile process racing filesystem changes. Do not expose the restored root to application processes until the command succeeds and the normal deployment checks approve it.

Failure can leave an unpublished `.judge-snapshot-*` or `.judge-restore-*` temporary directory beside the intended destination. A failed command never approves that directory for use. Inspect it privately; remove it only after resolving and checking the exact absolute path. The utility performs no recursive deletion. Failed attempts do not modify source database records; SQLite may maintain its own shared-memory bookkeeping while opening a live WAL database. New temporary roots use the OS's private temporary-directory permissions, and restored database files are set to mode 0600 where supported. On Windows, also enforce suitable inherited ACLs on the recovery parent directory.

## Operational rollout and rollback

1. Inspect the actual data root and storage permissions read-only. Arrange a write pause if the desired cut requires one.
2. Snapshot to a new directory on protected storage, then retain a separate off-host recovery copy through the operator's normal backup process.
3. Restore into a new inactive root. Confirm the expected account inventory, isolated account records and session revocation in an isolated instance before any deployment.
4. Switching application mounts/configuration and deploying require their normal production authorization. This script does neither.
5. Preserve the previous root untouched for rollback. If a deployment later points at the restored root, rollback is the separately planned switch back to the retained previous root, subject to reconciling any writes made after the switch.

## Test coverage and limits

The standalone test uses temporary SQLite fixtures with live WAL connections, two distinct tenant databases, an orphan tenant and one account without a business database. It checks restored ownership, users/password preservation, absence of old sessions, exclusion of later-created users and orphan files, source records remaining unchanged, corrupted hashes, invalid SQLite despite a matching hash, missing files, extra files/directories, traversal/remapping, same/nested/existing destinations, and session-schema failure. File symlink creation can be skipped explicitly on Windows when privileges prohibit it; directory junction rejection is tested separately. No test touches production, and these fixtures do not prove the production data root, application seeding, cookie policy, runtime mounts or deployment are correct.
