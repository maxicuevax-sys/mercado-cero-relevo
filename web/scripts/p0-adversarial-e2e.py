#!/usr/bin/env python3
"""E2E adversario P0/P1.

Cubre, contra servidores aislados y SQLite temporal:
  - P0-1: el reset no borra un pago pey firmado (aunque la fila diga demo)
    y no miente en `preservedRealPayments`.
  - P0-2: `/` no se sirve con caché pública.
  - P1-1: un webhook firmado en modo demo queda `demo_paid`, no suma a
    `verifiedDigitalCents` y `fulfill` responde 409.
  - P1-3: `/api/verify` rechaza una transacción PAID sin referencias.
  - P1-5: los totales de cobros/fiado usan el total del servidor y la UI
    declara cuando la lista está paginada.

Puertos por defecto: 3306 (demo), 3307 (real) y 3308 (mock de pey). Nunca
usa 3000 ni 3230. Escribe harness/evidence/p0-adversarial-e2e.json.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
OUT = ROOT / "harness" / "evidence" / "p0-adversarial-e2e.json"
DEMO_PORT = int(os.environ.get("P0_ADVERSARIAL_PORT", "3306"))
REAL_PORT = int(os.environ.get("P0_ADVERSARIAL_REAL_PORT", "3307"))
MOCK_PORT = int(os.environ.get("P0_ADVERSARIAL_MOCK_PORT", "3308"))
SECRET = "whsec_" + base64.b64encode(b"mercado-cero-adversarial-e2e").decode()
KEEP_DB = os.environ.get("P0_KEEP_DB") == "1"
NEXT_BIN = WEB / "node_modules" / "next" / "dist" / "bin" / "next"

DEMO_BASE = f"http://127.0.0.1:{DEMO_PORT}"
REAL_BASE = f"http://127.0.0.1:{REAL_PORT}"

RUN_DIR: Path | None = None
DEMO_DB: Path | None = None
REAL_DB: Path | None = None
DEMO_SERVER: subprocess.Popen | None = None
REAL_SERVER: subprocess.Popen | None = None
MOCK: ThreadingHTTPServer | None = None
MOCK_ORDER_ID = {"value": ""}
BUILD_SHA = {"value": ""}
results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")


def port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.4)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def request(
    base: str,
    method: str,
    path: str,
    data: dict | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, object, dict[str, str]]:
    body = None if data is None else json.dumps(data).encode("utf-8")
    merged = {"Content-Type": "application/json"}
    if headers:
        merged.update(headers)
    req = urllib.request.Request(
        f"{base}{path}",
        data=body,
        headers=merged,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            content_type = response.headers.get("content-type", "")
            if raw and "json" in content_type.lower():
                parsed = json.loads(raw)
            else:
                parsed = raw.decode("utf-8", errors="replace") if raw else {}
            return response.status, parsed, dict(response.headers)
    except urllib.error.HTTPError as error:
        raw = error.read()
        content_type = error.headers.get("content-type", "") if error.headers else ""
        try:
            if raw and "json" in content_type.lower():
                parsed = json.loads(raw)
            else:
                parsed = raw.decode("utf-8", errors="replace") if raw else {}
        except Exception:
            parsed = raw.decode("utf-8", errors="replace")
        return error.code, parsed, dict(error.headers) if error.headers else {}


def sign(body: str, event_id: str, timestamp: int) -> dict[str, str]:
    key = base64.b64decode(SECRET.replace("whsec_", ""))
    signature = base64.b64encode(
        hmac.new(key, f"{event_id}.{timestamp}.{body}".encode(), hashlib.sha256).digest()
    ).decode()
    return {
        "content-type": "application/json",
        "webhook-id": event_id,
        "webhook-timestamp": str(timestamp),
        "webhook-signature": f"v1,{signature}",
    }


def send_webhook(base: str, event: dict) -> tuple[int, object, dict[str, str]]:
    raw = json.dumps(event, separators=(",", ":"))
    event_id = f"msg_{int(time.time() * 1000)}_{os.urandom(4).hex()}"
    headers = sign(raw, event_id, int(time.time()))
    req = urllib.request.Request(
        f"{base}/api/webhooks/pey",
        data=raw.encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, json.loads(response.read() or b"{}"), dict(response.headers)
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or b"{}"), dict(error.headers)


def start_server(port: int, db_path: Path, mode: str, extra_env: dict[str, str]) -> subprocess.Popen:
    for _ in range(30):
        if not port_in_use(port):
            break
        time.sleep(0.2)
    if port_in_use(port):
        raise RuntimeError(f"El puerto {port} ya está ocupado; no lo reinicio.")
    log_path = RUN_DIR / f"server-{port}.log"
    env = os.environ.copy()
    env.update(
        {
            "NODE_ENV": "production",
            "NEXT_TELEMETRY_DISABLED": "1",
            "PORT": str(port),
            "HOSTNAME": "127.0.0.1",
            "DATABASE_PATH": str(db_path),
            "DATABASE_BACKUP_DIR": str(RUN_DIR / f"backups-{port}"),
            "DEMO_MODE": mode,
            "PEY_WEBHOOK_SECRET": SECRET,
            "PEY_API_KEY": "" if mode == "true" else "test",
            "OPENAI_API_KEY": "",
            "APP_URL": f"http://127.0.0.1:{port}",
            "FORCE_DEMO_RESET": "0",
        }
    )
    env.update(extra_env)
    log = log_path.open("w", encoding="utf-8", errors="replace")
    kwargs: dict = {
        "cwd": str(WEB),
        "env": env,
        "stdout": log,
        "stderr": subprocess.STDOUT,
        "text": True,
    }
    if os.name == "nt":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    else:
        kwargs["start_new_session"] = True
    process = subprocess.Popen(
        [
            shutil.which("node") or "node",
            str(NEXT_BIN),
            "start",
            "-H",
            "127.0.0.1",
            "-p",
            str(port),
        ],
        **kwargs,
    )
    deadline = time.time() + 90
    while time.time() < deadline:
        if process.poll() is not None:
            log.close()
            raise RuntimeError(
                f"El servidor {port} terminó al arrancar.\n"
                f"{log_path.read_text(errors='replace')[-4000:]}"
            )
        try:
            status, _, _ = request(
                f"http://127.0.0.1:{port}", "GET", "/api/health"
            )
            if status == 200:
                log.close()
                return process
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(0.6)
    stop_process(process)
    log.close()
    raise RuntimeError(
        f"El servidor {port} no respondió en 90 s.\n"
        f"{log_path.read_text(errors='replace')[-4000:]}"
    )


def stop_process(process: subprocess.Popen | None) -> None:
    if not process or process.poll() is not None:
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
        else:
            os.killpg(os.getpgid(process.pid), 15)
            process.wait(timeout=10)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass


def stop_all() -> None:
    global DEMO_SERVER, REAL_SERVER
    stop_process(DEMO_SERVER)
    stop_process(REAL_SERVER)
    DEMO_SERVER = None
    REAL_SERVER = None
    if MOCK is not None:
        MOCK.shutdown()
        MOCK.server_close()


def cleanup() -> None:
    stop_all()
    if RUN_DIR and not KEEP_DB:
        shutil.rmtree(RUN_DIR, ignore_errors=True)


def create_order(base: str, cents: int = 1000) -> dict:
    status, body, _ = request(
        base,
        "POST",
        "/api/orders",
        {"items": [{"description": "Prueba adversaria", "quantity": 1, "unitPriceCents": cents}]},
    )
    if status != 201:
        raise RuntimeError(f"No se pudo crear la orden: {status} {body}")
    return body["order"]


def create_link(base: str, order: dict) -> dict:
    status, body, _ = request(base, "POST", f"/api/orders/{order['id']}/pay", {"mode": "link"})
    if status != 200:
        raise RuntimeError(f"No se pudo crear el link: {status} {body}")
    return body["order"]


def order_detail(base: str, order_id: str) -> dict:
    status, body, _ = request(base, "GET", f"/api/orders/{order_id}")
    if status != 200:
        raise RuntimeError(f"No se pudo leer la orden: {status} {body}")
    return body


def sql(db: Path, query: str, params: tuple = ()) -> list[tuple]:
    connection = sqlite3.connect(db, timeout=10)
    try:
        return connection.execute(query, params).fetchall()
    finally:
        connection.close()


def format_mxn(cents: int) -> str:
    return f"${cents / 100:,.2f}"


def start_mock() -> None:
    global MOCK

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            if not self.path.startswith("/transaction/"):
                self.send_response(404)
                self.end_headers()
                return
            transaction_id = self.path.rsplit("/", 1)[-1]
            body = {
                "id": transaction_id,
                "status": "PAID",
                "amount": 10.0,
                "currency": "MXN",
                "paymentMethod": "CODI",
            }
            if transaction_id == "txn_with_order_ref" and MOCK_ORDER_ID["value"]:
                body["metadata"] = {"orderId": MOCK_ORDER_ID["value"]}
            data = json.dumps(body).encode()
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_args):
            pass

    MOCK = ThreadingHTTPServer(("127.0.0.1", MOCK_PORT), Handler)
    thread = threading.Thread(target=MOCK.serve_forever, daemon=True)
    thread.start()


def main() -> int:
    global RUN_DIR, DEMO_DB, REAL_DB, DEMO_SERVER, REAL_SERVER

    if DEMO_PORT in (3000, 3230) or REAL_PORT in (3000, 3230) or MOCK_PORT in (3000, 3230):
        raise RuntimeError("Este E2E no usa los puertos reservados 3000/3230.")
    if not (WEB / ".next" / "BUILD_ID").exists():
        raise RuntimeError("Falta build. Corre `npm run build` antes del E2E adversario.")

    RUN_DIR = Path(tempfile.mkdtemp(prefix="mercado-cero-adversarial-"))
    DEMO_DB = RUN_DIR / "demo.db"
    REAL_DB = RUN_DIR / "real.db"

    print("Mercado Cero — E2E adversario P0/P1")
    print(f"demo: {DEMO_BASE}  real: {REAL_BASE}  mock: 127.0.0.1:{MOCK_PORT}")
    print("")

    start_mock()
    DEMO_SERVER = start_server(DEMO_PORT, DEMO_DB, "true", {})
    status, health, _ = request(DEMO_BASE, "GET", "/api/health")
    BUILD_SHA["value"] = str(health.get("buildSha", "")) if isinstance(health, dict) else ""
    check("servidor demo aislado responde", status == 200 and health.get("ok") is True, str(health))

    # ---------------------------------------------------------------- P0-2
    status, _, headers = request(DEMO_BASE, "GET", "/")
    cache = headers.get("Cache-Control", "")
    check("P0-2 GET / responde 200", status == 200, f"status {status}")
    check(
        "P0-2 / es privado y no-store, sin caché pública",
        "private" in cache.lower()
        and "no-store" in cache.lower()
        and "s-maxage" not in cache.lower()
        and "public" not in cache.lower(),
        cache or "Cache-Control ausente",
    )
    status, html, _ = request(DEMO_BASE, "GET", "/")
    check(
        "P0-2 el HTML sigue renderizando la caja",
        status == 200 and ("Caja" in html or "caja" in html),
        f"status {status}, {len(html)} bytes",
    )

    # ------------------------------------------------------ P0-1 / P1-1
    status, reset, _ = request(DEMO_BASE, "POST", "/api/demo/reset")
    check("reset inicial de demo", status == 200 and reset.get("ok") is True, str(reset))
    _, baseline, _ = request(DEMO_BASE, "GET", "/api/dashboard")
    verified_base = int(baseline["summary"]["verifiedDigitalCents"])
    demo_base = int(baseline["summary"]["demoDigitalCents"])

    order = create_link(DEMO_BASE, create_order(DEMO_BASE, 1000))
    transaction_id = f"txn_{int(time.time() * 1000)}"
    event = {
        "type": "payment_link.status_updated",
        "paymentLinkId": order["paymentLinkId"],
        "status": "paid",
        "clientReferenceId": order["id"],
        "currency": "MXN",
        "transactions": [
            {
                "transactionId": transaction_id,
                "paymentMethod": "CODI",
                "currency": "MXN",
                "amount": 10.0,
            }
        ],
    }
    status, webhook, _ = send_webhook(DEMO_BASE, event)
    check(
        "P0-1/P1-1 webhook firmado en demo → 200 processed",
        status == 200 and webhook.get("result") == "processed",
        f"status {status} {webhook}",
    )

    detail = order_detail(DEMO_BASE, order["id"])
    check(
        "P1-1 en demo el pedido queda demo_paid, no paid",
        detail["order"]["status"] == "demo_paid",
        str(detail["order"]["status"]),
    )
    check(
        "P1-1 el pago firmado conserva paid_cents",
        detail["order"]["paidCents"] == 1000,
        str(detail["order"]["paidCents"]),
    )
    provider_rows = sql(
        DEMO_DB,
        "SELECT provider, status, demo FROM payments WHERE order_id = ?",
        (order["id"],),
    )
    check(
        "P1-1 la fila conserva provenance pey como demo",
        provider_rows == [("pey", "paid", 1)],
        str(provider_rows),
    )

    _, dashboard, _ = request(DEMO_BASE, "GET", "/api/dashboard")
    verified_after = int(dashboard["summary"]["verifiedDigitalCents"])
    demo_after = int(dashboard["summary"]["demoDigitalCents"])
    check(
        "P1-1 el demo firmado no suma a verifiedDigitalCents",
        verified_after == verified_base,
        f"{verified_base} → {verified_after}",
    )
    check(
        "P1-1 el demo firmado sí aparece como demo",
        demo_after >= demo_base + 1000,
        f"{demo_base} → {demo_after}",
    )

    status, fulfill, _ = request(
        DEMO_BASE, "PATCH", f"/api/orders/{order['id']}", {"action": "fulfill"}
    )
    check(
        "P1-1 fulfill de un pago demo → 409",
        status == 409 and fulfill.get("code") == "demo_not_deliverable",
        f"status {status} {fulfill}",
    )

    status, blocked, _ = request(DEMO_BASE, "POST", "/api/demo/reset")
    check(
        "P0-1 reset con pago pey firmado → 409",
        status == 409 and blocked.get("code") == "real_data_present",
        f"status {status} {blocked}",
    )
    check(
        "P0-1 el 409 reporta el pago firmado",
        int(blocked.get("realPayments", 0)) >= 1,
        str(blocked.get("realPayments")),
    )
    check(
        "P0-1 el pedido y el pago siguen en la base",
        len(sql(DEMO_DB, "SELECT id FROM orders WHERE id = ?", (order["id"],))) == 1
        and len(sql(DEMO_DB, "SELECT id FROM payments WHERE order_id = ?", (order["id"],))) == 1,
        "fila borrada",
    )
    check(
        "P0-1 reset no devuelve preservedRealPayments en un 409",
        "preservedRealPayments" not in blocked,
        str(blocked.get("preservedRealPayments")),
    )

    # ---------------------------------------------------------------- P1-5
    now = datetime.now(timezone.utc).isoformat()
    connection = sqlite3.connect(DEMO_DB, timeout=10)
    try:
        for index in range(51):
            order_id = f"ord_adv_pending_{index:03d}"
            connection.execute(
                "INSERT OR REPLACE INTO orders "
                "(id, status, total_cents, paid_cents, credit_cents, demo, created_at, updated_at) "
                "VALUES (?, 'payment_pending', 100, 0, 0, 1, ?, ?)",
                (order_id, now, now),
            )
        connection.execute(
            "INSERT OR REPLACE INTO customers (id, name, demo, created_at) VALUES (?, ?, 1, ?)",
            ("cus_adv_bulk", "Cliente Masivo", now),
        )
        for index in range(101):
            connection.execute(
                "INSERT OR REPLACE INTO credits "
                "(id, customer_id, original_cents, balance_cents, status, demo, created_at) "
                "VALUES (?, ?, 100, 100, 'open', 1, ?)",
                (f"cred_adv_{index:03d}", "cus_adv_bulk", now),
            )
        connection.commit()
    finally:
        connection.close()

    status, dashboard, _ = request(
        DEMO_BASE, "GET", "/api/dashboard?pendingLimit=50&creditsLimit=100"
    )
    pending_total = int(dashboard["pagination"]["pendingOrders"]["total"])
    pending_cents = int(dashboard["pendingCentsTotal"])
    open_credits = int(dashboard["creditsOpenTotal"])
    credits_balance = int(dashboard["creditsBalanceCents"])
    db_pending_cents = int(
        sql(
            DEMO_DB,
            "SELECT COALESCE(SUM(MAX(total_cents - paid_cents - credit_cents, 0)), 0) "
            "FROM orders WHERE status IN ('confirmed', 'payment_pending', 'partially_paid') "
            "AND MAX(total_cents - paid_cents - credit_cents, 0) > 0",
        )[0][0]
    )
    db_credits_balance = int(
        sql(
            DEMO_DB,
            "SELECT COALESCE(SUM(balance_cents), 0) FROM credits "
            "WHERE status != 'settled' AND balance_cents > 0",
        )[0][0]
    )
    db_open_credits = int(
        sql(
            DEMO_DB,
            "SELECT COUNT(*) FROM credits WHERE status != 'settled' AND balance_cents > 0",
        )[0][0]
    )
    check(
        "P1-5 pendingCentsTotal coincide con toda la base",
        status == 200 and pending_cents == db_pending_cents and pending_total >= 52,
        f"api={pending_cents} db={db_pending_cents} total={pending_total}",
    )
    check(
        "P1-5 creditsOpenTotal y saldo coinciden con toda la base",
        open_credits == db_open_credits
        and credits_balance == db_credits_balance
        and open_credits >= 102,
        f"creditos={open_credits}/{db_open_credits} saldo={credits_balance}/{db_credits_balance}",
    )

    status, html, _ = request(DEMO_BASE, "GET", "/")
    check(
        "P1-5 la UI no dice 'todas las fechas'",
        status == 200 and "todas las fechas" not in html.lower(),
        f"status {status}",
    )
    check(
        "P1-5 la UI muestra '50 de {pending_total}'".format(pending_total=pending_total),
        f"50 de {pending_total}" in html,
        f"buscado '50 de {pending_total}'",
    )
    check(
        "P1-5 la UI muestra el total real de cobros",
        format_mxn(pending_cents) in html,
        f"buscado {format_mxn(pending_cents)}",
    )
    check(
        "P1-5 la UI muestra '100 de {open_credits} fiados'".format(open_credits=open_credits),
        f"100 de {open_credits} fiados" in html,
        f"buscado '100 de {open_credits} fiados'",
    )
    check(
        "P1-5 la UI muestra el saldo real de fiado",
        format_mxn(credits_balance) in html,
        f"buscado {format_mxn(credits_balance)}",
    )

    # ------------------------------------- P0-1 force: preserva y reporta
    stop_process(DEMO_SERVER)
    DEMO_SERVER = None
    time.sleep(0.8)
    DEMO_SERVER = start_server(
        DEMO_PORT, DEMO_DB, "true", {"FORCE_DEMO_RESET": "1"}
    )
    status, forced, _ = request(DEMO_BASE, "POST", "/api/demo/reset")
    expected_preserved = len(
        sql(
            DEMO_DB,
            "SELECT DISTINCT order_id FROM payments WHERE provider = 'pey' AND status = 'paid'",
        )
    )
    check(
        "P0-1 con FORCE el reset responde 200",
        status == 200 and forced.get("ok") is True,
        f"status {status} {forced}",
    )
    check(
        "P0-1 preservedRealPayments coincide con la base",
        int(forced.get("preservedRealPayments", -1)) == expected_preserved
        and expected_preserved == 1,
        f"api={forced.get('preservedRealPayments')} db={expected_preserved}",
    )
    check(
        "P0-1 FORCE conserva el pago firmado y su pedido",
        len(sql(DEMO_DB, "SELECT id FROM payments WHERE order_id = ?", (order["id"],))) == 1
        and len(sql(DEMO_DB, "SELECT id FROM orders WHERE id = ?", (order["id"],))) == 1,
        "fila borrada",
    )

    stop_process(DEMO_SERVER)
    DEMO_SERVER = None

    # ---------------------------------------------------------------- P1-3
    REAL_SERVER = start_server(
        REAL_PORT,
        REAL_DB,
        "false",
        {"PEY_BASE_URL": f"http://127.0.0.1:{MOCK_PORT}", "PEY_API_KEY": "test"},
    )
    real_order = create_order(REAL_BASE, 1000)
    status, verify_no_refs, _ = request(
        REAL_BASE,
        "GET",
        f"/api/verify?transactionId=txn_no_refs&orderId={real_order['id']}",
    )
    check(
        "P1-3 PAID sin referencias → verified false",
        status == 200
        and verify_no_refs.get("verified") is False
        and verify_no_refs.get("reason") == "reference_mismatch",
        f"status {status} {verify_no_refs}",
    )
    MOCK_ORDER_ID["value"] = real_order["id"]
    status, verify_with_ref, _ = request(
        REAL_BASE,
        "GET",
        f"/api/verify?transactionId=txn_with_order_ref&orderId={real_order['id']}",
    )
    check(
        "P1-3 PAID con metadata.orderId correcto → verified true",
        status == 200 and verify_with_ref.get("verified") is True,
        f"status {status} {verify_with_ref}",
    )

    stop_process(REAL_SERVER)
    REAL_SERVER = None

    failed = [result for result in results if not result["ok"]]
    print("")
    print(f"{len(results) - len(failed)}/{len(results)} checks en verde")
    if failed:
        for result in failed:
            print(f"FALLÓ: {result['name']} — {result['detail']}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "suite": "p0-adversarial-e2e",
                "ok": not failed,
                "checks": results,
                "ports": {"demo": DEMO_PORT, "real": REAL_PORT, "mock": MOCK_PORT},
                "buildSha": BUILD_SHA["value"] or None,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return 0 if not failed else 1


if __name__ == "__main__":
    exit_code = 1
    try:
        exit_code = main()
    except Exception as error:  # noqa: BLE001
        print(f"ERROR: {error}")
        exit_code = 1
    finally:
        cleanup()
    sys.exit(exit_code)
