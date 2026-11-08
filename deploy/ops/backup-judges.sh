#!/usr/bin/env bash
# Optional joint judge-account backup; requires Linux bash, python3, flock and engine CLI.
# Configuration is data, never shell. The parent owns restic encryption/success reporting.
set -euo pipefail
umask 077
parent_lock_held=0
emoji=0
for arg in "$@"; do
  case "$arg" in
    --parent-lock-held) [[ "$parent_lock_held" == 0 ]] || exit 1; parent_lock_held=1 ;;
    --emoji) [[ "$emoji" == 0 ]] || exit 1; emoji=1 ;;
    *) echo 'Invalid judge backup arguments.' >&2; exit 1 ;;
  esac
done
root=${MC_PILOT_ROOT:-/opt/mercado-cero/pilot}
[[ "$root" == /* && "$root" != / ]] || exit 1
config="$root/judge-backup.env"
stage="$root/backup-current"
if [[ "$emoji" == 1 ]]; then config="$root/emoji-backup.env"; stage="$stage/emoji"; fi
if [[ ! -e "$config" && ! -L "$config" ]]; then
  # Missing configuration may only be a first-use no-op. Published judge material
  # must never silently survive as a supposedly fresh encrypted backup.
  python3 - "$stage" <<'PYNOOP'
import pathlib, sys
root=pathlib.Path(sys.argv[1])
for rel in ['judges', 'judge-tools', 'config/judge-backup.env']:
    p=root/rel
    if p.exists() or p.is_symlink(): raise SystemExit(1)
PYNOOP
  exit $?
fi

# Validate every existing ancestor before opening the lock or creating private staging.
python3 - "$root" "$config" "$stage" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
if str(p) != sys.argv[1] or '..' in p.parts: raise SystemExit(1)
for q in [p, *p.parents]:
    if q.is_symlink(): raise SystemExit(1)
if not p.is_dir(): raise SystemExit(1)
for q in [pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]), p/'.judge-backup.lock', p/'backup-current']:
    if q.is_symlink(): raise SystemExit(1)
if not pathlib.Path(sys.argv[2]).is_file(): raise SystemExit(1)
PY
# Share the parent's lock across capture, publication and restic encryption.
# Test sandboxes use a local lock; production retains the established global path.
main_lock=/run/lock/mercado-cero-backup.lock
[[ -z "${MC_PILOT_ROOT:-}" ]] || main_lock="$root/.mercado-cero-backup.lock"
[[ ! -L "$main_lock" ]] || exit 1
if [[ "$parent_lock_held" == 1 ]]; then
  python3 - "$main_lock" <<'PYLOCK'
import os, sys
try:
    if not os.path.samefile('/proc/self/fd/9',sys.argv[1]): raise SystemExit(1)
except OSError:
    raise SystemExit(1)
PYLOCK
  flock -n 9 || { echo 'Parent backup lock unavailable.' >&2; exit 1; }
else
  exec 9>"$main_lock"
  flock -n 9 || { echo 'Main backup already running.' >&2; exit 1; }
fi
exec 8>"$root/.judge-backup.lock"
flock -n 8 || { echo 'Judge backup already running.' >&2; exit 1; }
# Strict allowlist and one occurrence per setting. No quoting, interpolation or commands.
engine= container= data_root=
declare -A seen=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line=${line%$'\r'}
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" == *=* ]] || { echo 'Invalid judge backup configuration.' >&2; exit 1; }
  key=${line%%=*}; value=${line#*=}
  [[ "$key" == JUDGE_BACKUP_ENGINE || "$key" == JUDGE_BACKUP_CONTAINER || "$key" == JUDGE_BACKUP_DATA_ROOT ]] || exit 1
  [[ -z "${seen[$key]:-}" ]] || exit 1
  seen[$key]=1
  case "$key" in
    JUDGE_BACKUP_ENGINE) [[ -z "$engine" ]] || exit 1; engine=$value ;;
    JUDGE_BACKUP_CONTAINER) [[ -z "$container" ]] || exit 1; container=$value ;;
    JUDGE_BACKUP_DATA_ROOT) [[ -z "$data_root" ]] || exit 1; data_root=$value ;;
    *) echo 'Invalid judge backup configuration.' >&2; exit 1 ;;
  esac
done < "$config"
[[ "$engine" == docker || "$engine" == podman ]] || exit 1
if [[ "$emoji" == 1 ]]; then
  [[ "$container" == trangui-public-emoji ]] || exit 1
else
  [[ "$container" =~ ^mercado-cero-[a-zA-Z0-9][a-zA-Z0-9_.-]*$ && ${#container} -le 128 ]] || exit 1
fi
[[ "$data_root" == /data/judges ]] || exit 1
mkdir -p "$stage"
work=$(mktemp -d "$stage/.judges-incoming.XXXXXXXXXXXX")
inside="/data/judge-backups/auto-$(date -u +%Y%m%dT%H%M%SZ)-${work##*.}"
completed=0
cleanup() {
  result=$?
  set +e
  trap - EXIT
  # Node checks the exact generated basename and every ancestor before removal.
  if [[ -n "${inside:-}" ]]; then
    "$engine" exec "$container" node --input-type=module -e '
      import fs from "node:fs"; import path from "node:path";
      const p=process.argv[1];
      if (!/^\/data\/judge-backups\/auto-[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9]{12}$/.test(p) || path.resolve(p)!==p) process.exit(1);
      for(let q=p;;q=path.dirname(q)){const s=fs.lstatSync(q,{throwIfNoEntry:false});if(s?.isSymbolicLink())process.exit(1);if(q==="/")break;}
      fs.rmSync(p,{recursive:true,force:true});' "$inside" >/dev/null 2>&1 || result=1
  fi
  python3 - "$stage" "$work" <<'PY'
import pathlib, re, shutil, sys
base, target = map(pathlib.Path, sys.argv[1:])
if target.parent != base or not re.fullmatch(r'\.judges-incoming\.[A-Za-z0-9]{12}', target.name): raise SystemExit(1)
for p in [base, *base.parents, target]:
    if p.is_symlink(): raise SystemExit(1)
if target.exists():
    # Never traverse a link while deleting generated private work.
    for p in target.rglob('*'):
        if p.is_symlink(): raise SystemExit(1)
    shutil.rmtree(target)
PY
  cleanup_result=$?
  [[ "$cleanup_result" == 0 ]] || result=1
  if [[ "$result" != 0 || "$completed" != 1 ]]; then
    echo 'Judge backup failed; no success recorded.' >&2
    exit 1
  fi
  echo 'Judge backup verified and published.'
}
trap cleanup EXIT
mkdir "$work/tools"
# Redirect the complete inspect payload privately; never echo environment or engine errors.
"$engine" inspect --format '{{json .Config.Env}}' "$container" > "$work/tools/runtime-env.json" 2>/dev/null
"$engine" inspect --format '{{json .State.Running}}' "$container" > "$work/running.json" 2>/dev/null
"$engine" inspect --format '{{.Image}}' "$container" > "$work/image" 2>/dev/null
python3 - "$work" <<'PY'
import json, pathlib, re, sys
p = pathlib.Path(sys.argv[1]); entries = json.loads((p/'tools/runtime-env.json').read_text())
if not isinstance(entries,list) or any(not isinstance(x,str) or '=' not in x for x in entries): raise SystemExit(1)
env={}
for x in entries:
    k,v=x.split('=',1)
    if k in env: raise SystemExit(1)
    env[k]=v
if json.loads((p/'running.json').read_text()) is not True: raise SystemExit(1)
if any(env.get(k)!=v for k,v in {'JUDGE_DEMO_ACCOUNTS':'true','DEMO_MODE':'true','JUDGE_DATA_ROOT':'/data/judges'}.items()): raise SystemExit(1)
if any(env.get(k) for k in ['PEY_API_KEY','OPENAI_API_KEY','PEY_WEBHOOK_SECRET','OPERATOR_ACCESS_TOKEN']): raise SystemExit(1)
if not re.fullmatch(r'sha256:[0-9a-f]{64}', (p/'image').read_text().strip()): raise SystemExit(1)
PY
image=$(cat "$work/image")
# All transient runs use the captured immutable image ID and no network/write access.
readonly_flags=(--rm --network none --read-only --user 0 --cap-drop ALL --memory 256m --memory-swap 256m --cpus .25)
"$engine" run "${readonly_flags[@]}" --entrypoint node "$image" --input-type=module -e 'import fs from "node:fs"; process.stdout.write(fs.readFileSync("/app/deploy/judge-snapshot.mjs"));' > "$work/tools/judge-snapshot.mjs" 2>/dev/null
# The snapshot API requires an existing parent. Create only this guarded directory,
# using the application container's configured user (never elevate the capture).
"$engine" exec "$container" node --input-type=module -e '
  import fs from "node:fs"; import path from "node:path";
  const p="/data/judge-backups";
  for(let q=p;;q=path.dirname(q)){const s=fs.lstatSync(q,{throwIfNoEntry:false});if(s?.isSymbolicLink())process.exit(1);if(q==="/")break;}
  if(!fs.existsSync(p))fs.mkdirSync(p,{mode:0o700});
  if(!fs.statSync(p).isDirectory())process.exit(1);' >/dev/null 2>&1
"$engine" exec "$container" node /app/deploy/judge-snapshot.mjs snapshot "$data_root" "$inside" >/dev/null 2>&1
mkdir "$work/judges"
"$engine" cp "$container:$inside/." "$work/judges/" >/dev/null 2>&1
# Engine cp uses caller ownership by default; root validator can read captured mode 0600.
"$engine" run "${readonly_flags[@]}" --mount "type=bind,src=$work/judges,dst=/snapshot,readonly" --entrypoint node "$image" --input-type=module -e '
  import {verifySnapshot} from "/app/deploy/judge-snapshot.mjs";
  const {manifest}=verifySnapshot("/snapshot");
  console.log(JSON.stringify({accounts:manifest.accounts.length,captured:manifest.accounts.filter(a=>a.status==="captured").length}));' > "$work/counts.json" 2>/dev/null
python3 - "$stage" "$work" "$container" <<'PY'
import datetime, hashlib, json, pathlib, shutil, sys
stage, work = map(pathlib.Path, sys.argv[1:3]); container=sys.argv[3]
for p in [stage, *stage.parents, work]:
    if p.is_symlink(): raise SystemExit(1)
# Reject links before publishing or chmod; no recursive chown of captured data.
for p in work.rglob('*'):
    if p.is_symlink(): raise SystemExit(1)
    p.chmod(0o700 if p.is_dir() else 0o600)
counts=json.loads((work/'counts.json').read_text())
if set(counts)!={'accounts','captured'} or any(type(v) is not int or v<0 for v in counts.values()) or counts['captured']>counts['accounts']: raise SystemExit(1)
tools=work/'tools'
(tools/'capture.json').write_text(json.dumps({'image':(work/'image').read_text().strip(),'container':container,'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),**counts})+'\n')
(tools/'SHA256SUMS').write_text(''.join(hashlib.sha256((tools/n).read_bytes()).hexdigest()+'  '+n+'\n' for n in ['judge-snapshot.mjs','runtime-env.json','capture.json']))
for p in tools.iterdir(): p.chmod(0o600)
# Preserve prior publication on any ordinary rename failure, including the second tree.
moved=[]; published=[]
try:
    for name, source in [('judges','judges'),('judge-tools','tools')]:
        current=stage/name
        if current.is_symlink() or (current.exists() and not current.is_dir()): raise RuntimeError()
        if current.exists():
            old=work/('previous-'+name); current.rename(old); moved.append((old,current))
        (work/source).rename(current); published.append((current,work/source))
except BaseException:
    for current, original in reversed(published): current.rename(original)
    for old, current in reversed(moved): old.rename(current)
    raise
print(f"Judge accounts: {counts['accounts']}; captured databases: {counts['captured']}.")
PY
completed=1
