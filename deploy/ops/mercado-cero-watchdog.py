#!/usr/bin/env python3
"""Mercado Cero watchdog: container, app health, STT and disk.

Runs from a systemd timer every 2 minutes. Restarts a component only after two
consecutive failures, and never touches containers other than the production
Trangui one.
"""
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone

CONTAINER = "trangui-public-emoji"
STT_UNIT = "trangui-local-stt.service"
STT_HEALTH = "http://172.30.0.1:4097/health"
LOCAL_HEALTH = "http://127.0.0.1:4597/api/health"
PUBLIC_HEALTH = "https://xn--hw9h.st/api/health"
DEPLOYMENT = "/opt/mercado-cero/public-emoji/deployment.json"
STATE_DIR = "/var/lib/mercado-cero-watchdog"
STATE_FILE = os.path.join(STATE_DIR, "state.json")
LOG_FILE = "/var/log/mercado-cero-watchdog.log"
FREE_GB_WARN = 3.0
THRESHOLD = 2
MAX_LOG_BYTES = 5 * 1024 * 1024


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def run(cmd, timeout=30):
    try:
        out = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return (out.stdout or "").strip(), (out.stderr or "").strip(), out.returncode
    except subprocess.TimeoutExpired:
        return "", "timeout", 124


def log(message):
    line = f"{now()} {message}"
    print(line, flush=True)
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > MAX_LOG_BYTES:
            os.replace(LOG_FILE, LOG_FILE + ".1")
        with open(LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except OSError:
        pass


def load_state():
    try:
        with open(STATE_FILE, encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, dict):
                return data
    except (OSError, ValueError):
        pass
    return {}


def save_state(state):
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(state, fh)
        os.replace(tmp, STATE_FILE)
    except OSError as exc:
        log(f"state write failed: {exc}")


def expected_sha():
    try:
        with open(DEPLOYMENT, encoding="utf-8") as fh:
            return json.load(fh).get("buildSha")
    except (OSError, ValueError):
        return None


# --- checks ---------------------------------------------------------------


def check_container():
    out, err, code = run(
        f"docker inspect {CONTAINER} --format '{{{{.State.Status}}}}|{{{{.State.Health.Status}}}}'"
    )
    if code != 0 or not out:
        return False, f"inspect failed: {err[:120]}"
    status, _, health = out.partition("|")
    if status != "running":
        return False, f"status={status}"
    if health and health != "healthy":
        return False, f"health={health}"
    return True, "ok"


def check_health(url, expect_sha=None):
    out, err, code = run(f"curl -fsS --max-time 10 {url}")
    if code != 0 or not out:
        return False, f"http failed: {err[:120]}"
    try:
        data = json.loads(out)
    except ValueError:
        return False, "invalid json"
    if not data.get("ok"):
        return False, "ok=false"
    if expect_sha and data.get("buildSha") != expect_sha:
        return False, f"sha mismatch: {data.get('buildSha')} != {expect_sha}"
    return True, "ok"


def check_stt():
    out, _err, code = run(f"curl -fsS --max-time 8 {STT_HEALTH}")
    return (code == 0 and out != ""), "ok" if code == 0 else "http failed"


def check_disk():
    out, _err, code = run("df -Pk / | tail -1")
    if code != 0 or not out:
        return True, "unknown"
    try:
        free_gb = int(out.split()[3]) / 1024 / 1024
    except (IndexError, ValueError):
        return True, "unknown"
    if free_gb < FREE_GB_WARN:
        return False, f"low disk: {free_gb:.1f}G free"
    return True, f"ok ({free_gb:.1f}G free)"


# --- remediation ----------------------------------------------------------


def restart_container():
    _out, err, code = run(f"docker restart {CONTAINER}", timeout=180)
    return code, err


def restart_stt():
    _out, err, code = run(f"systemctl restart {STT_UNIT}", timeout=120)
    return code, err


POST_CHECK = {
    "container": check_container,
    "stt": check_stt,
}
REMEDIATE = {
    "container": restart_container,
    "stt": restart_stt,
}


def handle(state, component, ok, detail):
    if ok:
        if state.get(component):
            log(f"{component}: recovered")
        state[component] = 0
        state.pop(component + "_alerta", None)
        return
    fails = int(state.get(component, 0)) + 1
    state[component] = fails
    log(f"{component}: FAIL ({fails}/{THRESHOLD}) {detail}")

    remediate = REMEDIATE.get(component)
    if remediate is None:
        if fails == THRESHOLD and not state.get(component + "_alerta"):
            state[component + "_alerta"] = True
            log(f"{component}: alerta (solo monitoreo, sin acción automática)")
        return
    if fails < THRESHOLD:
        return

    log(f"{component}: umbral alcanzado, ejecutando remediación")
    code, err = remediate()
    state[component] = 0
    if code != 0:
        log(f"{component}: remediación FALLÓ: {err[:200]}")
        return
    log(f"{component}: comando ok; verificando en 25s")
    time.sleep(25)
    verify_ok, verify_detail = POST_CHECK[component]()
    log(
        f"{component}: post-remediación {'OK' if verify_ok else 'SIGUE FALLANDO'}"
        f" ({verify_detail})"
    )


def main():
    state = load_state()
    sha = expected_sha()
    results = {}

    for component, check in (
        ("container", check_container),
        ("health_local", lambda: check_health(LOCAL_HEALTH, sha)),
        ("health_public", lambda: check_health(PUBLIC_HEALTH)),
        ("stt", check_stt),
        ("disk", check_disk),
    ):
        ok, detail = check()
        results[component] = (ok, detail)
        handle(state, component, ok, detail)

    summary = " ".join(
        f"{name}={'ok' if ok else 'FAIL'}" for name, (ok, _detail) in results.items()
    )
    failures = [name for name, (ok, _d) in results.items() if not ok]
    if failures:
        log(f"watchdog RESUMEN {summary}")
    else:
        log(f"watchdog ok {summary}")

    state["last_run"] = now()
    state["expected_sha"] = sha
    save_state(state)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
