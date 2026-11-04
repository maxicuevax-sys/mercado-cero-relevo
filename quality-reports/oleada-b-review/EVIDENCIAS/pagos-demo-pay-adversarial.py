#!/usr/bin/env python3
"""Adversarial demo/pay sobre una COPIA de la base (servidor 3210).

No toca la base de 3100. Demuestra:
- doble POST concurrente a /api/demo/pay;
- /api/demo/pay sobre un pedido con demo=0 (fixture en la copia).
"""
from __future__ import annotations

import concurrent.futures
import json
import os
import sqlite3
import time
import uuid
from pathlib import Path

import requests

BASE = os.environ.get("BASE_URL", "http://localhost:3210").rstrip("/")
ROOT = Path(__file__).resolve().parents[3]
DB = Path(os.environ["COPY_DB"])
OUT = Path(__file__).resolve().parent
MARK = f"AUDDEMO{int(time.time())}"
RESULTS: list[dict] = []


def check(name: str, ok: bool, detail: str = "", severity: str = "") -> None:
    RESULTS.append({"name": name, "ok": bool(ok), "detail": detail, "severity": severity})
    print(f"{'PASS' if ok else 'FAIL'}  {name} | {detail}")


def db_one(sql: str, params: tuple = ()) -> dict | None:
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        row = con.execute(sql, params).fetchone()
        return dict(row) if row else None
    finally:
        con.close()


def db_all(sql: str, params: tuple = ()) -> list[dict]:
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        return [dict(row) for row in con.execute(sql, params).fetchall()]
    finally:
        con.close()


def db_exec(sql: str, params: tuple = ()) -> None:
    con = sqlite3.connect(DB, timeout=10)
    try:
        con.execute(sql, params)
        con.commit()
    finally:
        con.close()


def api(method: str, path: str, payload: dict | None = None, timeout: int = 30):
    response = requests.request(method, BASE + path, json=payload, timeout=timeout)
    try:
        body = response.json()
    except Exception:
        body = {"raw": response.text[:400]}
    return response.status_code, body


def create_digital(amount: int) -> dict:
    status, body = api(
        "POST",
        "/api/orders",
        {
            "items": [{"description": f"{MARK} Demo {amount}", "quantity": 1, "unitPriceCents": amount}],
            "cashCents": 0,
            "creditCents": 0,
            "customerName": None,
            "requestId": f"{MARK}_{uuid.uuid4()}",
        },
    )
    assert status == 201, (status, body)
    order = body["order"]
    status, body = api("POST", f"/api/orders/{order['id']}/pay", {"mode": "link"})
    assert status == 200, (status, body)
    return body["order"]


def main() -> int:
    health = requests.get(BASE + "/api/health", timeout=10).json()
    check("0 servidor copia arriba", health.get("ok") is True, json.dumps(health))

    # ---------------------------------------------------------------
    # 1. Doble POST concurrente a /api/demo/pay.
    # ---------------------------------------------------------------
    order = create_digital(10000)
    check(
        "1.1 pedido digital pendiente listo",
        order["status"] == "payment_pending" and order["totalCents"] == 10000,
        json.dumps({"id": order["id"], "status": order["status"]}),
    )
    methods = ["card", "codi", "wallet", "card", "codi", "wallet", "card", "codi", "wallet", "card"]

    def pay(method: str):
        return api("POST", "/api/demo/pay", {"orderId": order["id"], "method": method})

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        outcomes = list(pool.map(pay, methods))
    statuses = [status for status, _ in outcomes]
    detail = api("GET", f"/api/orders/{order['id']}")[1]
    pays = db_all("SELECT * FROM payments WHERE order_id = ? ORDER BY created_at, rowid", (order["id"],))
    duplicate = len(pays) > 1 or detail.get("order", {}).get("paidCents", 0) > 10000
    check(
        "1.2 diez POST concurrentes no duplican el pago demo",
        not duplicate,
        json.dumps(
            {
                "http": statuses,
                "paidCents": detail.get("order", {}).get("paidCents"),
                "status": detail.get("order", {}).get("status"),
                "pagos": len(pays),
                "amounts": [p["amount_cents"] for p in pays],
            }
        ),
        severity="P1",
    )
    check(
        "1.3 la orden queda demo_paid, nunca paid",
        detail.get("order", {}).get("status") == "demo_paid",
        detail.get("order", {}).get("status"),
    )

    # Repeticion secuencial con la misma llave inexistente (la ruta no acepta requestId).
    status, body = api("POST", "/api/demo/pay", {"orderId": order["id"], "method": "card"})
    pays_after = db_all("SELECT id FROM payments WHERE order_id = ?", (order["id"],))
    check(
        "1.4 repeticion secuencial no duplica",
        status == 200 and len(pays_after) == len(pays),
        json.dumps({"status": status, "pagos": len(pays_after)}),
    )

    # ---------------------------------------------------------------
    # 2. /api/demo/pay sobre un pedido con demo=0 (fixture en la copia).
    # ---------------------------------------------------------------
    fixture_id = f"ord_auditreal_{uuid.uuid4().hex[:12]}"
    now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    db_exec(
        """INSERT INTO orders
           (id, merchant_id, status, total_cents, paid_cents, payment_method,
            customer_name, credit_id, credit_cents, demo, created_at, updated_at)
           VALUES (?, 'lupita', 'payment_pending', 5000, 0, NULL, 'Cliente real', NULL, 0, 0, ?, ?)""",
        (fixture_id, now, now),
    )
    item_id = f"itm_auditreal_{uuid.uuid4().hex[:10]}"
    db_exec(
        """INSERT INTO order_items (id, order_id, description, quantity, unit_price_cents, total_cents)
           VALUES (?, ?, 'Fixture no demo', 1, 5000, 5000)""",
        (item_id, fixture_id),
    )
    before = db_one("SELECT demo, status, paid_cents FROM orders WHERE id = ?", (fixture_id,))
    status, body = api("POST", "/api/demo/pay", {"orderId": fixture_id, "method": "card"})
    after = db_one("SELECT demo, status, paid_cents FROM orders WHERE id = ?", (fixture_id,))
    fixture_pays = db_all("SELECT provider, demo, amount_cents FROM payments WHERE order_id = ?", (fixture_id,))
    check(
        "2.1 /api/demo/pay acepta un pedido demo=0",
        status == 200 and after is not None and after["status"] == "demo_paid",
        json.dumps({"http": status, "antes": before, "despues": after, "pagos": fixture_pays}),
        severity="P1",
    )
    check(
        "2.2 el pago insertado es demo y el pedido conserva demo=0",
        len(fixture_pays) == 1
        and fixture_pays[0]["provider"] == "demo"
        and fixture_pays[0]["demo"] == 1
        and after is not None
        and after["demo"] == 0,
        json.dumps({"pagos": fixture_pays, "order_demo": after["demo"] if after else None}),
        severity="P1",
    )

    # ---------------------------------------------------------------
    # 3. Evidencia de visibilidad: un pedido demo_paid con demo=0 queda fuera
    #    del filtro real (misma clausula que db.ts).
    # ---------------------------------------------------------------
    hidden = db_one(
        """SELECT COUNT(*) n FROM orders
           WHERE id = ? AND demo = 0 AND id NOT LIKE 'demo_%' AND status != 'demo_paid'""",
        (fixture_id,),
    )
    check(
        "3.1 en modo real el pedido quedaria oculto (status demo_paid)",
        hidden is not None and hidden["n"] == 0,
        json.dumps({"coincide_filtro_real": hidden["n"] if hidden else None, "status": after["status"] if after else None}),
        severity="P1",
    )

    failed = [item for item in RESULTS if not item["ok"]]
    payload = {
        "base": BASE,
        "db": str(DB),
        "mark": MARK,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "results": RESULTS,
        "summary": {"total": len(RESULTS), "pass": len(RESULTS) - len(failed), "fail": len(failed)},
    }
    (OUT / "pagos-demo-pay-adversarial.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nDEMO PAY ADVERSARIAL: {len(RESULTS) - len(failed)} PASS / {len(failed)} FAIL")
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
