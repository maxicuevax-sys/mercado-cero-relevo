#!/usr/bin/env python3
"""E2E de dinero/verdad del carril fix-dinero.

Cubre:
  - arranque real sin fixtures demo (DEMO_MODE=false, DB nueva);
  - fixtures demo declarados (provider demo, demo_paid, ids demo_seed_*);
  - /api/demo/pay rechaza efectivo;
  - webhook: reintento corregido con el mismo webhook-id tras 409 y 404;
  - /api/verify exige orden y rechaza una transacción de otra orden;
  - abonos de fiado cash/declarado, sin duplicar;
  - fechas: pedido de ayer pagado hoy;
  - allowlist de recordPayment (test puro aparte);
  - corte: expected_negative y totals_changed.

Corre en un servidor aislado en :3122 con DB temporal. Nunca toca :3000
ni :3101. Escribe harness/evidence/p0-dinero-e2e.json.
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
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
OUT = ROOT / "harness" / "evidence" / "p0-dinero-e2e.json"
PORT = 3122
BASE = f"http://localhost:{PORT}"
SECRET = "whsec_" + base64.b64encode(b"mercado-cero-dinero-e2e").decode()
KEEP_DB = os.environ.get("P0_KEEP_DB") == "1"
SERVER: subprocess.Popen | None = None
RUN_DIR: Path | None = None
DB_PATH: Path | None = None

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")


def known(name: str, detail: str = "") -> None:
    results.append({"name": name, "ok": None, "detail": detail})
    print(f"KNOWN  {name}{(' — ' + detail) if detail else ''}")


def git_value(*args: str) -> str:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception:
        return ""


def port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.4)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def which_npm() -> str:
    for name in ("npm.cmd", "npm"):
        found = shutil.which(name)
        if found:
            return found
    raise RuntimeError("No encontré npm en PATH.")


def start_server(mode: bool) -> None:
    global SERVER, RUN_DIR, DB_PATH
    if port_in_use(PORT):
        raise RuntimeError(f"El puerto {PORT} ya está ocupado; no lo reinicio.")
    RUN_DIR = Path(tempfile.mkdtemp(prefix="mercado-cero-p0-dinero-"))
    DB_PATH = RUN_DIR / "mercado-cero.db"
    log_path = RUN_DIR / "server.log"
    env = os.environ.copy()
    env.update(
        {
            "PORT": str(PORT),
            "HOSTNAME": "127.0.0.1",
            "DATABASE_PATH": str(DB_PATH),
            "DEMO_MODE": "true" if mode else "false",
            "PEY_WEBHOOK_SECRET": SECRET,
            "PEY_API_KEY": "",
            "OPENAI_API_KEY": "",
            "APP_URL": BASE,
        }
    )
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
    SERVER = subprocess.Popen([which_npm(), "start"], **kwargs)
    deadline = time.time() + 90
    while time.time() < deadline:
        if SERVER.poll() is not None:
            log.close()
            raise RuntimeError(
                f"El servidor terminó al arrancar.\n{log_path.read_text(errors='replace')[-4000:]}"
            )
        try:
            status, _ = request("GET", "/api/dashboard")
            if status == 200:
                log.close()
                return
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(0.6)
    stop_server()
    log.close()
    raise RuntimeError(
        f"El servidor no respondió en 90 s.\n{log_path.read_text(errors='replace')[-4000:]}"
    )


def stop_server() -> None:
    global SERVER
    if not SERVER or SERVER.poll() is not None:
        SERVER = None
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(SERVER.pid), "/T", "/F"],
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
        else:
            os.killpg(os.getpgid(SERVER.pid), 15)
            SERVER.wait(timeout=10)
    except Exception:
        try:
            SERVER.kill()
        except Exception:
            pass
    SERVER = None


def cleanup() -> None:
    stop_server()
    if RUN_DIR and not KEEP_DB:
        shutil.rmtree(RUN_DIR, ignore_errors=True)


def request(method: str, path: str, data: dict | None = None) -> tuple[int, dict]:
    body = None if data is None else json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read() or b"{}")
        except Exception:
            return error.code, {}


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


def send_webhook(event: dict, event_id: str | None = None) -> tuple[int, dict, str]:
    body = json.dumps(event, separators=(",", ":"))
    event_id = event_id or f"msg_{int(time.time() * 1000)}_{hashlib.sha1(body.encode()).hexdigest()[:8]}"
    headers = sign(body, event_id, int(time.time()))
    req = urllib.request.Request(
        f"{BASE}/api/webhooks/pey",
        data=body.encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, json.loads(response.read() or b"{}"), event_id
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read() or b"{}"), event_id
        except Exception:
            return error.code, {}, event_id


def db_rows(sql: str, params: tuple = ()) -> list[tuple]:
    assert DB_PATH is not None
    connection = sqlite3.connect(str(DB_PATH), timeout=10)
    try:
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection.execute(sql, params).fetchall()
    finally:
        connection.close()


def db_exec(sql: str, params: tuple = ()) -> None:
    assert DB_PATH is not None
    connection = sqlite3.connect(str(DB_PATH), timeout=10)
    try:
        connection.execute("PRAGMA busy_timeout = 5000")
        connection.execute(sql, params)
        connection.commit()
    finally:
        connection.close()


def dashboard() -> dict:
    status, body = request("GET", "/api/dashboard")
    assert status == 200, body
    return body


def create_order(
    amount_cents: int,
    cash_cents: int = 0,
    credit_cents: int = 0,
    customer: str | None = None,
) -> dict:
    payload: dict = {
        "items": [
            {
                "description": "Prueba de dinero",
                "quantity": 1,
                "unitPriceCents": amount_cents,
            }
        ],
        "cashCents": cash_cents,
        "creditCents": credit_cents,
    }
    if customer:
        payload["customerName"] = customer
    status, body = request("POST", "/api/orders", payload)
    assert status == 201, (status, body)
    return body["order"]


def create_link(order_id: str) -> dict:
    status, body = request("POST", f"/api/orders/{order_id}/pay", {"mode": "link"})
    assert status == 200, (status, body)
    return body["order"]


def order_detail(order_id: str) -> dict:
    status, body = request("GET", f"/api/orders/{order_id}")
    assert status == 200, (status, body)
    return body


def payment_event(event_id: str) -> tuple:
    rows = db_rows(
        "SELECT result, error FROM payment_events WHERE idempotency_key = ?",
        (event_id,),
    )
    return rows[0] if rows else (None, None)


def summary() -> dict:
    return dashboard()["summary"]


def cash_status() -> dict:
    status, body = request("GET", "/api/cash")
    assert status == 200, body
    return body


def preview_cash(payload: dict) -> tuple[int, dict]:
    return request("POST", "/api/cash/preview", payload)


def close_cash(payload: dict) -> tuple[int, dict]:
    return request("POST", "/api/cash/close", payload)


def main() -> int:
    started = datetime.now(timezone.utc)
    start_server(True)

    # ------------------------------------------------------------------
    # 1 · Demo: fixtures visibles y declarados, nunca como efectivo real.
    # ------------------------------------------------------------------
    reset_status, _ = request("POST", "/api/demo/reset")
    check("demo: reset responde 200", reset_status == 200, f"status {reset_status}")
    demo_dash = dashboard()
    demo_summary = demo_dash["summary"]
    seed_orders = [o for o in demo_dash["orders"] if o["id"].startswith("demo_seed_")]
    seed_credits = [c for c in demo_dash["credits"] if c["id"].startswith("demo_seed_")]
    seed_payment = db_rows(
        "SELECT provider, method, amount_cents FROM payments WHERE id LIKE 'demo_seed_%'"
    )
    check(
        "demo: el fixture de pedido se declara demo_paid/provider demo",
        bool(seed_orders)
        and seed_orders[0]["status"] == "demo_paid"
        and seed_orders[0]["lastPaymentProvider"] == "demo",
        json.dumps(seed_orders[:1], ensure_ascii=False),
    )
    check(
        "demo: el efectivo del fixture va a demoCashCents, no a cashCents",
        demo_summary["demoCashCents"] == 7000
        and demo_summary["cashCents"] == 0
        and bool(seed_payment)
        and seed_payment[0][0] == "demo",
        json.dumps(demo_summary, ensure_ascii=False),
    )
    check(
        "demo: el fiado del fixture se declara demoCreditCents",
        bool(seed_credits) and demo_summary["demoCreditCents"] == 5000,
        json.dumps({"credits": seed_credits[:1], "summary": demo_summary}, ensure_ascii=False),
    )
    cash_demo = cash_status()
    check(
        "demo: el corte no suma efectivo demo",
        cash_demo["cashSalesCents"] == 0 and cash_demo["cashCreditCents"] == 0,
        json.dumps(cash_demo, ensure_ascii=False),
    )
    goals_status, goals_body = request("GET", "/api/goals")
    check(
        "demo: la meta fixture se declara demo",
        goals_status == 200
        and len(goals_body["goals"]) == 1
        and goals_body["goals"][0]["demo"] is True
        and goals_body["goals"][0]["id"].startswith("demo_seed_goal_"),
        json.dumps(goals_body, ensure_ascii=False),
    )

    # ------------------------------------------------------------------
    # 2 · /api/demo/pay rechaza efectivo.
    # ------------------------------------------------------------------
    demo_cash_order = create_order(3000)
    status_cash, body_cash = request(
        "POST", "/api/demo/pay", {"orderId": demo_cash_order["id"], "method": "cash"}
    )
    check(
        "demo/pay: method cash se rechaza con 400",
        status_cash == 400 and "efectivo" in json.dumps(body_cash).lower(),
        f"status {status_cash} · {json.dumps(body_cash, ensure_ascii=False)[:200]}",
    )
    check(
        "demo/pay: el rechazo no crea pago ni marca el pedido",
        order_detail(demo_cash_order["id"])["order"]["status"] != "demo_paid"
        and order_detail(demo_cash_order["id"])["payments"] == [],
        order_detail(demo_cash_order["id"])["order"]["status"],
    )
    before_summary = summary()
    status_codi, body_codi = request(
        "POST", "/api/demo/pay", {"orderId": demo_cash_order["id"], "method": "codi"}
    )
    after_summary = summary()
    check(
        "demo/pay: codi sí simula y queda demo_paid",
        status_codi == 200
        and body_codi["order"]["status"] == "demo_paid"
        and body_codi["order"]["lastPaymentProvider"] == "demo",
        f"status {status_codi} · {json.dumps(body_codi, ensure_ascii=False)[:200]}",
    )
    check(
        "demo/pay: el demo digital no entra a cashCents ni al corte",
        after_summary["cashCents"] == before_summary["cashCents"]
        and after_summary["demoDigitalCents"] == before_summary["demoDigitalCents"] + 3000
        and cash_status()["cashSalesCents"] == 0,
        json.dumps(after_summary, ensure_ascii=False),
    )

    # Checkout: un pago demo no se presenta como efectivo real.
    checkout_order = create_link(create_order(4000)["id"])
    request("POST", "/api/demo/pay", {"orderId": checkout_order["id"], "method": "codi"})
    checkout_status, checkout_body = request("GET", f"/api/checkout/{checkout_order['id']}")
    check(
        "checkout: pago demo con cashPaidCents 0 y provider demo",
        checkout_status == 200
        and checkout_body["payment"]["provider"] == "demo"
        and checkout_body["order"]["cashPaidCents"] == 0
        and checkout_body["order"]["demoPaidCents"] == 4000,
        json.dumps(checkout_body, ensure_ascii=False)[:300],
    )

    # ------------------------------------------------------------------
    # 3 · Webhook 409 → mismo webhook-id corregido → paid.
    # ------------------------------------------------------------------
    retry_order = create_link(create_order(1000)["id"])
    transaction_id = f"txn_retry_{int(time.time() * 1000)}"
    wrong_event = {
        "type": "payment_link.status_updated",
        "paymentLinkId": retry_order["paymentLinkId"],
        "status": "paid",
        "clientReferenceId": retry_order["id"],
        "transactions": [
            {"transactionId": transaction_id, "paymentMethod": "CODI", "amount": 1.0}
        ],
    }
    wrong_status, wrong_body, wrong_event_id = send_webhook(wrong_event)
    check(
        "webhook: monto distinto responde 409",
        wrong_status == 409,
        f"status {wrong_status} · {json.dumps(wrong_body, ensure_ascii=False)[:200]}",
    )
    corrected_event = json.loads(json.dumps(wrong_event))
    corrected_event["transactions"][0]["amount"] = retry_order["totalCents"] / 100
    corrected_status, corrected_body, _ = send_webhook(corrected_event, wrong_event_id)
    corrected_detail = order_detail(retry_order["id"])
    check(
        "webhook: reintento corregido mismo webhook-id → 200 processed",
        corrected_status == 200 and corrected_body.get("result") == "processed",
        f"status {corrected_status} · {json.dumps(corrected_body, ensure_ascii=False)[:200]}",
    )
    check(
        "webhook: el reintento cobra una sola vez",
        corrected_detail["order"]["status"] == "paid"
        and corrected_detail["order"]["paidCents"] == retry_order["totalCents"]
        and len(corrected_detail["payments"]) == 1,
        json.dumps(corrected_detail, ensure_ascii=False)[:300],
    )
    check(
        "webhook: el evento rechazado se reutiliza como processed",
        payment_event(wrong_event_id)[0] == "processed",
        json.dumps(payment_event(wrong_event_id), ensure_ascii=False),
    )

    # ------------------------------------------------------------------
    # 4 · Webhook 404 → mismo webhook-id corregido → paid.
    # ------------------------------------------------------------------
    retry404_order = create_link(create_order(1200)["id"])
    missing_event = {
        "type": "payment_link.status_updated",
        "paymentLinkId": retry404_order["paymentLinkId"],
        "status": "paid",
        "clientReferenceId": "ord_inexistente_retry",
        "transactions": [
            {
                "transactionId": f"txn_404_{int(time.time() * 1000)}",
                "paymentMethod": "CODI",
                "amount": retry404_order["totalCents"] / 100,
            }
        ],
    }
    missing_status, missing_body, missing_event_id = send_webhook(missing_event)
    check(
        "webhook: referencia inexistente responde 404",
        missing_status == 404,
        f"status {missing_status} · {json.dumps(missing_body, ensure_ascii=False)[:200]}",
    )
    corrected404_event = dict(missing_event)
    corrected404_event["clientReferenceId"] = retry404_order["id"]
    corrected404_status, corrected404_body, _ = send_webhook(
        corrected404_event, missing_event_id
    )
    check(
        "webhook: reintento 404 corregido mismo id → 200 processed",
        corrected404_status == 200 and corrected404_body.get("result") == "processed",
        f"status {corrected404_status} · {json.dumps(corrected404_body, ensure_ascii=False)[:200]}",
    )
    check(
        "webhook: el 404 corregido marca paid una vez",
        order_detail(retry404_order["id"])["order"]["status"] == "paid"
        and len(order_detail(retry404_order["id"])["payments"]) == 1,
        order_detail(retry404_order["id"])["order"]["status"],
    )

    # ------------------------------------------------------------------
    # 5 · /api/verify por orden.
    # ------------------------------------------------------------------
    other_order = create_order(9900)
    verify_other_status, verify_other = request(
        "GET",
        f"/api/verify?{urllib.parse.urlencode({'transactionId': transaction_id, 'orderId': other_order['id']})}",
    )
    check(
        "verify: transacción de A contra orden B → verified false",
        verify_other_status == 200
        and verify_other.get("verified") is False
        and verify_other.get("reason") == "order_mismatch",
        json.dumps(verify_other, ensure_ascii=False)[:300],
    )
    verify_ok_status, verify_ok = request(
        "GET",
        f"/api/verify?{urllib.parse.urlencode({'transactionId': transaction_id, 'orderId': retry_order['id']})}",
    )
    check(
        "verify: transacción de A contra orden A → verified true",
        verify_ok_status == 200 and verify_ok.get("verified") is True,
        json.dumps(verify_ok, ensure_ascii=False)[:300],
    )
    verify_missing_status, _ = request(
        "GET", f"/api/verify?transactionId={transaction_id}"
    )
    check(
        "verify: falta orderId → 400",
        verify_missing_status == 400,
        f"status {verify_missing_status}",
    )

    # ------------------------------------------------------------------
    # 6 · Abonos de fiado: cash + declarado, sin duplicar.
    # ------------------------------------------------------------------
    before_credit = summary()
    before_cash = cash_status()
    credit_order = create_order(5000, credit_cents=5000, customer="Cliente Fiado")
    check(
        "fiado: el pedido nace confirmed, no fulfilled",
        credit_order["status"] == "confirmed" and credit_order["creditCents"] == 5000,
        credit_order["status"],
    )
    deliver_status, deliver_body = request(
        "PATCH", f"/api/orders/{credit_order['id']}", {"action": "fulfill"}
    )
    check(
        "fiado: no se puede entregar con deuda abierta",
        deliver_status == 409,
        f"status {deliver_status} · {json.dumps(deliver_body, ensure_ascii=False)[:160]}",
    )

    credit_id = credit_order["creditId"]
    pay_cash_status, pay_cash = request(
        "POST",
        f"/api/credits/{credit_id}/pay",
        {"amountCents": 2000, "method": "cash", "requestId": "e2e-dinero-cash-1"},
    )
    check(
        "abono: cash aplica 2000 y deja saldo 3000",
        pay_cash_status == 200
        and pay_cash.get("appliedCents") == 2000
        and pay_cash.get("balanceCents") == 3000,
        json.dumps(pay_cash, ensure_ascii=False)[:300],
    )
    pay_digital_status, pay_digital = request(
        "POST",
        f"/api/credits/{credit_id}/pay",
        {"amountCents": 1000, "method": "codi", "requestId": "e2e-dinero-codi-1"},
    )
    check(
        "abono: codi aplica 1000 y deja saldo 2000",
        pay_digital_status == 200
        and pay_digital.get("appliedCents") == 1000
        and pay_digital.get("balanceCents") == 2000,
        json.dumps(pay_digital, ensure_ascii=False)[:300],
    )
    duplicate_status, duplicate_body = request(
        "POST",
        f"/api/credits/{credit_id}/pay",
        {"amountCents": 1000, "method": "codi", "requestId": "e2e-dinero-codi-1"},
    )
    check(
        "abono: reintento con la misma requestId no duplica",
        duplicate_status == 200
        and duplicate_body.get("duplicate") is True
        and duplicate_body.get("balanceCents") == 2000,
        json.dumps(duplicate_body, ensure_ascii=False)[:300],
    )
    after_credit = summary()
    after_cash = cash_status()
    check(
        "abono: cash suma a summary.cashCents y al corte",
        after_credit["cashCents"] == before_credit["cashCents"] + 2000
        and after_cash["cashCreditCents"] == before_cash["cashCreditCents"] + 2000,
        json.dumps(
            {
                "summary": {
                    "before": before_credit["cashCents"],
                    "after": after_credit["cashCents"],
                },
                "cash": {
                    "before": before_cash["cashCreditCents"],
                    "after": after_cash["cashCreditCents"],
                },
            },
            ensure_ascii=False,
        ),
    )
    check(
        "abono: codi va a declaredDigitalCents, no a verificado",
        after_credit["declaredDigitalCents"]
        == before_credit["declaredDigitalCents"] + 1000
        and after_credit["verifiedDigitalCents"] == before_credit["verifiedDigitalCents"],
        json.dumps(after_credit, ensure_ascii=False),
    )
    provider_rows = db_rows(
        "SELECT method, provider, amount_cents FROM credit_payments "
        "WHERE credit_id = ? ORDER BY rowid ASC",
        (credit_id,),
    )
    check(
        "abono: provider cash/declared queda registrado",
        provider_rows
        == [("cash", "cash", 2000), ("codi", "declared", 1000)],
        json.dumps(provider_rows, ensure_ascii=False),
    )
    analytics_status, analytics_today = request("GET", "/api/analytics?period=today")
    check(
        "abono: analytics de hoy usa fecha del abono",
        analytics_status == 200
        and analytics_today["cashCents"] >= 2000
        and analytics_today["declaredDigitalCents"] >= 1000,
        json.dumps(analytics_today, ensure_ascii=False)[:300],
    )
    final_pay_status, final_pay = request(
        "POST",
        f"/api/credits/{credit_id}/pay",
        {"amountCents": 2000, "method": "cash", "requestId": "e2e-dinero-cash-2"},
    )
    check(
        "abono: liquidar el fiado deja saldo 0",
        final_pay_status == 200 and final_pay.get("balanceCents") == 0,
        json.dumps(final_pay, ensure_ascii=False)[:200],
    )
    paid_before_delivery = dashboard()["summary"]["paidOrderCount"]
    deliver_after_status, deliver_after = request(
        "PATCH", f"/api/orders/{credit_order['id']}", {"action": "fulfill"}
    )
    check(
        "fiado saldado: la entrega es explícita y permitida",
        deliver_after_status == 200
        and deliver_after["order"]["status"] == "fulfilled",
        f"status {deliver_after_status} · {json.dumps(deliver_after, ensure_ascii=False)[:200]}",
    )
    paid_after_delivery = dashboard()["summary"]["paidOrderCount"]
    check(
        "reportes: un fulfilled con fiado no se cuenta como pedido pagado",
        paid_after_delivery == paid_before_delivery,
        f"paidOrderCount {paid_before_delivery} → {paid_after_delivery}",
    )

    # ------------------------------------------------------------------
    # 7 · Fechas: pedido de ayer pagado hoy.
    # ------------------------------------------------------------------
    before_dates = summary()
    before_analytics_status, before_analytics = request("GET", "/api/analytics?period=today")
    date_order = create_order(2500)
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    db_exec(
        "UPDATE orders SET created_at = ?, updated_at = ? WHERE id = ?",
        (yesterday, yesterday, date_order["id"]),
    )
    paid_at = datetime.now(timezone.utc).isoformat()
    db_exec(
        "INSERT INTO payments "
        "(id, order_id, provider, method, amount_cents, status, transaction_id, created_at) "
        "VALUES (?, ?, 'pey', 'codi', ?, 'paid', ?, ?)",
        (
            f"pay_date_{date_order['id']}",
            date_order["id"],
            2500,
            f"txn_date_{date_order['id']}",
            paid_at,
        ),
    )
    db_exec(
        "UPDATE orders SET paid_cents = 2500, status = 'paid' WHERE id = ?",
        (date_order["id"],),
    )
    after_dates = summary()
    after_analytics_status, after_analytics = request("GET", "/api/analytics?period=today")
    check(
        "fechas: el cobro de hoy entra a verifiedDigital y collected",
        after_dates["verifiedDigitalCents"] == before_dates["verifiedDigitalCents"] + 2500
        and after_analytics["collectedCents"] == before_analytics["collectedCents"] + 2500,
        json.dumps(
            {
                "summaryBefore": before_dates["verifiedDigitalCents"],
                "summaryAfter": after_dates["verifiedDigitalCents"],
                "collectedBefore": before_analytics["collectedCents"],
                "collectedAfter": after_analytics["collectedCents"],
            },
            ensure_ascii=False,
        ),
    )
    check(
        "fechas: la venta de ayer no se atribuye a hoy",
        after_dates["orderCount"] == before_dates["orderCount"]
        and after_dates["paidOrderCount"] == before_dates["paidOrderCount"]
        and after_analytics["salesCents"] == before_analytics["salesCents"]
        and after_analytics["orderCount"] == before_analytics["orderCount"],
        json.dumps(
            {
                "summary": {
                    "ordersBefore": before_dates["orderCount"],
                    "ordersAfter": after_dates["orderCount"],
                },
                "analytics": {
                    "salesBefore": before_analytics["salesCents"],
                    "salesAfter": after_analytics["salesCents"],
                },
            },
            ensure_ascii=False,
        ),
    )

    # ------------------------------------------------------------------
    # 8 · Corte: expected negativo y preview fingerprint.
    # ------------------------------------------------------------------
    negative_payload = {
        "openingCents": 50000,
        "expensesCents": 100000,
        "withdrawalsCents": 0,
        "countedCents": 50000,
        "baseNextCents": 40000,
    }
    negative_preview_status, negative_preview = preview_cash(negative_payload)
    check(
        "corte: preview con esperado negativo → 400 expected_negative",
        negative_preview_status == 400
        and negative_preview.get("code") == "expected_negative",
        f"status {negative_preview_status} · {json.dumps(negative_preview, ensure_ascii=False)[:240]}",
    )
    negative_close_status, negative_close = close_cash(
        {
            **negative_payload,
            "previewFingerprint": "huella-vieja",
            "requestId": "e2e-negative",
            "expectedVersion": 0,
        }
    )
    check(
        "corte: close con esperado negativo → 400 expected_negative",
        negative_close_status == 400
        and negative_close.get("code") == "expected_negative",
        f"status {negative_close_status} · {json.dumps(negative_close, ensure_ascii=False)[:240]}",
    )

    status_ok = cash_status()
    base_payload = {
        "openingCents": status_ok["openingCents"],
        "expensesCents": 0,
        "withdrawalsCents": 0,
        "countedCents": status_ok["expectedCents"],
        "baseNextCents": min(40000, status_ok["expectedCents"]),
    }
    preview_ok_status, preview_ok = preview_cash(base_payload)
    check(
        "corte: preview válido devuelve fingerprint",
        preview_ok_status == 200
        and isinstance(preview_ok.get("preview", {}).get("fingerprint"), str)
        and len(preview_ok["preview"]["fingerprint"]) == 16,
        json.dumps(preview_ok, ensure_ascii=False)[:300],
    )
    stale_fingerprint = preview_ok["preview"]["fingerprint"]
    create_order(5000, cash_cents=5000)
    stale_close_status, stale_close = close_cash(
        {
            **base_payload,
            "previewFingerprint": stale_fingerprint,
            "requestId": "e2e-stale-total",
            "expectedVersion": status_ok["saved"]["version"] if status_ok["saved"] else 0,
        }
    )
    check(
        "corte: venta entre preview y close → 409 totals_changed",
        stale_close_status == 409 and stale_close.get("code") == "totals_changed",
        f"status {stale_close_status} · {json.dumps(stale_close, ensure_ascii=False)[:240]}",
    )
    today_rows = db_rows(
        "SELECT COUNT(*) FROM cash_closes WHERE date = ?", (status_ok["date"],)
    )
    check(
        "corte: el 409 no guarda ninguna versión",
        today_rows[0][0] == (status_ok["saved"]["version"] if status_ok["saved"] else 0),
        f"filas={today_rows[0][0]}",
    )
    fresh_status = cash_status()
    fresh_payload = {
        "openingCents": fresh_status["openingCents"],
        "expensesCents": 0,
        "withdrawalsCents": 0,
        "countedCents": fresh_status["expectedCents"],
        "baseNextCents": min(40000, fresh_status["expectedCents"]),
    }
    fresh_preview_status, fresh_preview = preview_cash(fresh_payload)
    close_status, close_body = close_cash(
        {
            **fresh_payload,
            "previewFingerprint": fresh_preview.get("preview", {}).get("fingerprint"),
            "requestId": "e2e-fresh-total",
            "expectedVersion": fresh_status["saved"]["version"] if fresh_status["saved"] else 0,
        }
    )
    check(
        "corte: re-preview con fingerprint nuevo sí guarda",
        fresh_preview_status == 200
        and close_status == 200
        and close_body.get("close", {}).get("differenceCents") == 0,
        f"status {close_status} · {json.dumps(close_body, ensure_ascii=False)[:240]}",
    )

    stop_server()

    # ------------------------------------------------------------------
    # 9 · Arranque real: DB nueva + DEMO_MODE=false no siembra nada.
    # ------------------------------------------------------------------
    start_server(False)
    real_dash = dashboard()
    real_summary = real_dash["summary"]
    real_cash = cash_status()
    real_goals_status, real_goals = request("GET", "/api/goals")
    real_analytics_status, real_analytics = request("GET", "/api/analytics?period=today")
    counts = db_rows(
        "SELECT (SELECT COUNT(*) FROM orders), (SELECT COUNT(*) FROM credits), "
        "(SELECT COUNT(*) FROM payments), (SELECT COUNT(*) FROM goals), "
        "(SELECT COUNT(*) FROM customers)"
    )[0]
    check(
        "real: 0 pedidos, 0 clientes, 0 fiado, 0 pagos, 0 metas",
        real_dash["orders"] == []
        and real_dash["credits"] == []
        and real_goals["goals"] == []
        and tuple(int(value) for value in counts) == (0, 0, 0, 0, 0),
        json.dumps(counts, ensure_ascii=False),
    )
    check(
        "real: summary y corte en cero",
        real_summary["cashCents"] == 0
        and real_summary["creditCents"] == 0
        and real_summary["verifiedDigitalCents"] == 0
        and real_summary["orderCount"] == 0
        and real_cash["cashSalesCents"] == 0
        and real_cash["cashCreditCents"] == 0
        and real_cash["openingCents"] == 0,
        json.dumps({"summary": real_summary, "cash": real_cash}, ensure_ascii=False)[:400],
    )
    check(
        "real: analytics no inventa ventas ni cobros",
        real_analytics_status == 200
        and real_analytics["salesCents"] == 0
        and real_analytics["collectedCents"] == 0
        and real_analytics["demoMode"] is False,
        json.dumps(real_analytics, ensure_ascii=False)[:300],
    )
    demo_reset_status, _ = request("POST", "/api/demo/reset")
    check(
        "real: /api/demo/reset responde 403",
        demo_reset_status == 403,
        f"status {demo_reset_status}",
    )

    known(
        "P1-4: payload real de pey no verificable sin portal",
        "El contrato del webhook y /api/verify usan el payload sintético documentado; "
        "la forma real de pey sigue pendiente de validar con el portal.",
    )
    known(
        "P1: reconciliación de red no ejecutada",
        "reconcile.ts filtra por fecha del pago y excluye demo; no se llamó a pey real.",
    )
    known(
        "Contrato de conteo posterior al cierre",
        "El backend exige previewFingerprint: si entran movimientos, close responde "
        "409 totals_changed y obliga a un preview nuevo. La UI de flujos debe reemplazar "
        "el conteo guardado por el vigente en lugar de presentarlo como actual.",
    )

    failed = [item for item in results if item["ok"] is False]
    passed = [item for item in results if item["ok"] is True]
    summary_out = {
        "pass": len(passed),
        "fail": len(failed),
        "known": len([item for item in results if item["ok"] is None]),
        "total": len(results),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "suite": "p0-dinero-e2e",
                "startedAt": started.isoformat(),
                "finishedAt": datetime.now(timezone.utc).isoformat(),
                "git": {
                    "sha": git_value("rev-parse", "HEAD"),
                    "branch": git_value("rev-parse", "--abbrev-ref", "HEAD"),
                    "dirty": bool(git_value("status", "--porcelain", "--untracked-files=no")),
                },
                "baseUrl": BASE,
                "summary": summary_out,
                "results": results,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print("")
    print(f"{summary_out['pass']} PASS · {summary_out['fail']} FAIL · {summary_out['known']} KNOWN")
    print(f"EVIDENCIA {OUT.relative_to(ROOT).as_posix()}")
    return 0 if not failed else 1


if __name__ == "__main__":
    try:
        code = main()
    except Exception as error:  # noqa: BLE001
        print(f"ERROR: {error}", file=sys.stderr)
        code = 1
    finally:
        cleanup()
    raise SystemExit(code)
