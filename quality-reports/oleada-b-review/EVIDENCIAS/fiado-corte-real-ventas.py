#!/usr/bin/env python3
"""Verificacion complementaria en modo real (DEMO_MODE=false) de /ventas.

No genera links de pago ni llama a pey. Solo crea ventas de efectivo/fiado y
abonos sobre una base temporal aislada, y lee /ventas. Sirve para comprobar las
etiquetas "Saldado"/"Cobrado"/"Pendiente" que el modo demo oculta.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent
BASE = os.environ.get("REAL_BASE", "http://127.0.0.1:3106").rstrip("/")
RUN = datetime.now().strftime("%H%M%S")
MARKER = os.environ.get("REAL_MARKER", f"AUD-RM-{RUN}")
PREFIX = "fiado-corte-mcfc-real"
checks: list[dict] = []
evidence: dict = {
    "run": RUN,
    "marker": MARKER,
    "base": BASE,
    "startedAt": datetime.now().isoformat(),
    "steps": [],
    "checks": checks,
}


def check(name: str, ok: bool, detail=None) -> None:
    checks.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + ("" if detail is None else f" :: {detail}"))


def http_json(method: str, path: str, body=None) -> dict:
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return {"status": response.status, "body": json.loads(response.read().decode("utf-8"))}
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw}
        return {"status": error.code, "body": parsed}


def create_sale(description: str, total: int, cash: int, credit: int, customer: str | None) -> dict:
    request_id = f"{MARKER}-{description.replace(' ', '-')}"
    response = http_json(
        "POST",
        "/api/orders",
        {
            "items": [{"description": f"{description} {MARKER}", "quantity": 1, "unitPriceCents": total}],
            "cashCents": cash,
            "creditCents": credit,
            "customerName": customer,
            "requestId": request_id,
        },
    )
    response["requestId"] = request_id
    return response


def ventas_rows(marker: str) -> dict:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1448, "height": 1086}, locale="es-MX")
        page.goto(BASE + "/ventas", wait_until="domcontentloaded")
        page.wait_for_selector("#ventas-title")
        page.wait_for_timeout(500)
        rows = {}
        locator = page.locator("li", has_text=marker)
        for index in range(locator.count()):
            text = locator.nth(index).inner_text()
            if MARKER in text:
                rows[str(index)] = text
        result = {
            "stats": page.locator(".mc-ventas-stats").inner_text(),
            "note": page.locator(".mc-ventas-note").inner_text(),
            "rows": rows,
        }
        page.screenshot(path=str(OUT / f"{PREFIX}-ventas-{int(time.time())}.png"), full_page=True)
        browser.close()
        return result


def main() -> int:
    dashboard = http_json("GET", "/api/dashboard?ordersLimit=1&pendingLimit=1&creditsLimit=1")
    demo_mode = dashboard["body"].get("demoMode")
    check("Servidor en modo real", demo_mode is False, dashboard["body"].get("demoMode"))
    before_cash = http_json("GET", "/api/cash")["body"]

    fiado = create_sale("Real fiado", 10000, 0, 10000, f"Real Fiado {MARKER}")
    mixed = create_sale("Real mixto", 9000, 6000, 3000, f"Real Mixto {MARKER}")
    cash = create_sale("Real efectivo", 5000, 5000, 0, None)
    digital = create_sale("Real digital", 8000, 0, 0, None)

    fiado_order = fiado["body"].get("order", {})
    mixed_order = mixed["body"].get("order", {})
    cash_order = cash["body"].get("order", {})
    digital_order = digital["body"].get("order", {})
    fiado_credit = fiado_order.get("creditId")

    for label, response in (("fiado", fiado), ("mixto", mixed), ("efectivo", cash), ("digital", digital)):
        check(f"POST real {label} 201", response.get("status") == 201, response)

    check(
        "Real fiado: paid=0 credit=10000 confirmed",
        fiado_order.get("paidCents") == 0
        and fiado_order.get("creditCents") == 10000
        and fiado_order.get("status") == "confirmed",
        fiado_order,
    )
    check(
        "Real mixto: paid=6000 credit=3000",
        mixed_order.get("paidCents") == 6000 and mixed_order.get("creditCents") == 3000,
        mixed_order,
    )
    check(
        "Real efectivo: paid=5000 status=paid",
        cash_order.get("paidCents") == 5000 and cash_order.get("status") == "paid",
        cash_order,
    )
    check(
        "Real digital: paid=0 credit=0 con saldo pendiente",
        digital_order.get("paidCents") == 0 and digital_order.get("creditCents") == 0,
        digital_order,
    )

    partial = http_json(
        "POST",
        f"/api/credits/{fiado_credit}/pay",
        {
            "amountCents": 4000,
            "method": "cash",
            "note": f"Abono parcial real {MARKER}",
            "requestId": f"{MARKER}-partial",
        },
    )
    check(
        "Real abono parcial 4000 -> saldo 6000",
        partial.get("status") == 200
        and partial["body"].get("appliedCents") == 4000
        and partial["body"].get("balanceCents") == 6000,
        partial,
    )
    after_partial_cash = http_json("GET", "/api/cash")["body"]
    after_partial_summary = http_json("GET", "/api/dashboard?ordersLimit=1&pendingLimit=1&creditsLimit=1")["body"].get("summary", {})
    after_partial_ventas = ventas_rows(f"Real Fiado {MARKER}")
    evidence["steps"].append(
        {
            "id": "real-parcial",
            "orders": {
                "fiado": fiado_order,
                "mixto": mixed_order,
                "efectivo": cash_order,
                "digital": digital_order,
            },
            "partial": partial,
            "cashAfter": after_partial_cash,
            "summaryAfter": after_partial_summary,
            "ventas": after_partial_ventas,
        }
    )
    partial_row = next(iter(after_partial_ventas["rows"].values()), "")
    check(
        "Real /ventas parcial muestra Saldo vivo 60.00",
        "Saldo vivo" in partial_row and "60.00" in partial_row,
        partial_row,
    )
    check(
        "Real /ventas parcial NO deberia decir 'Fiado, no cobrado' tras abono",
        "Fiado, no cobrado" not in partial_row,
        partial_row,
    )

    full = http_json(
        "POST",
        f"/api/credits/{fiado_credit}/pay",
        {
            "amountCents": 6000,
            "method": "cash",
            "note": f"Liquidacion real {MARKER}",
            "requestId": f"{MARKER}-full",
        },
    )
    check(
        "Real abono total 6000 -> saldo 0",
        full.get("status") == 200
        and full["body"].get("appliedCents") == 6000
        and full["body"].get("balanceCents") == 0,
        full,
    )
    after_full_cash = http_json("GET", "/api/cash")["body"]
    after_full_summary = http_json("GET", "/api/dashboard?ordersLimit=1&pendingLimit=1&creditsLimit=1")["body"].get("summary", {})
    after_full_ventas = ventas_rows(f"Real Fiado {MARKER}")
    evidence["steps"].append(
        {
            "id": "real-total",
            "full": full,
            "cashAfter": after_full_cash,
            "summaryAfter": after_full_summary,
            "ventas": after_full_ventas,
        }
    )
    full_row = next(iter(after_full_ventas["rows"].values()), "")
    check(
        "Real /ventas saldado muestra Saldado y ya no Saldo vivo",
        "saldado" in full_row.lower() and "saldo vivo" not in full_row.lower(),
        full_row,
    )

    mixed_ventas = ventas_rows(f"Real Mixto {MARKER}")
    cash_ventas = ventas_rows(f"Real efectivo {MARKER}")
    digital_ventas = ventas_rows(f"Real digital {MARKER}")
    mixed_row = next(iter(mixed_ventas["rows"].values()), "")
    cash_row = next(iter(cash_ventas["rows"].values()), "")
    digital_row = next(iter(digital_ventas["rows"].values()), "")
    evidence["ventasFinal"] = {
        "mixto": mixed_ventas,
        "efectivo": cash_ventas,
        "digital": digital_ventas,
    }
    check(
        "Real /ventas mixto muestra Cobrado 60.00 y Saldo vivo 30.00",
        "Cobrado" in mixed_row and "60.00" in mixed_row and "Saldo vivo" in mixed_row and "30.00" in mixed_row,
        mixed_row,
    )
    check(
        "Real /ventas efectivo muestra Pagado/Cobrado 50.00",
        ("Pagado" in cash_row or "Cobrado" in cash_row) and "50.00" in cash_row,
        cash_row,
    )
    check(
        "Real /ventas digital muestra pendiente y Falta cobrar 80.00",
        ("Pendiente" in digital_row or "Sin cobro confirmado" in digital_row) and "80.00" in digital_row,
        digital_row,
    )

    evidence["cash"] = {"before": before_cash, "afterPartial": after_partial_cash, "afterFull": after_full_cash}
    evidence["finishedAt"] = datetime.now().isoformat()
    evidence["checksSummary"] = {
        "total": len(checks),
        "pass": len([c for c in checks if c["ok"]]),
        "fail": len([c for c in checks if not c["ok"]]),
    }
    (OUT / f"{PREFIX}-ventas.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        f"REAL RUN {RUN} · MARKER {MARKER} · BASE {BASE}",
        f"{evidence['checksSummary']['pass']}/{evidence['checksSummary']['total']} PASS",
        "",
    ]
    for item in checks:
        lines.append(("PASS " if item["ok"] else "FAIL ") + item["name"])
        if not item["ok"] and item["detail"] is not None:
            lines.append("     " + json.dumps(item["detail"], ensure_ascii=False)[:2500])
    (OUT / f"{PREFIX}-ventas.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\n{evidence['checksSummary']}")
    print(OUT / f"{PREFIX}-ventas.json")
    return 0 if evidence["checksSummary"]["fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
