#!/usr/bin/env python3
"""Auditoria adversarial fiado/corte de Oleada B (solo lectura de producto).

Ejecuta la matriz T1/T2/T3/T9 contra la UI real de /caja y el endpoint de abonos.
No modifica el repositorio. Escribe evidencia en EVIDENCIAS/fiado-corte-mcfc-*.

Uso:
  BASE_URL=http://127.0.0.1:3101 CAPTURE_DB=... python fiado-corte-e2e.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent
REPO_ROOT = OUT.parents[2]
WEB = REPO_ROOT / "web"
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3101").rstrip("/")
CAPTURE_DB = os.environ.get("CAPTURE_DB", "")
RUN = datetime.now().strftime("%H%M%S")
MARKER = os.environ.get("MARKER", f"AUD-FC-{RUN}")
PREFIX = "fiado-corte-mcfc"
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


def cash_status() -> dict:
    return http_json("GET", "/api/cash")["body"]


def preview() -> dict:
    status = cash_status()
    opening = status.get("openingCents", 0)
    response = http_json(
        "POST",
        "/api/cash/preview",
        {
            "openingCents": opening,
            "expensesCents": 0,
            "withdrawalsCents": 0,
            "countedCents": opening,
            "baseNextCents": opening,
        },
    )
    return response


def summary() -> dict:
    response = http_json("GET", "/api/dashboard?ordersLimit=1&pendingLimit=1&creditsLimit=10")
    return response["body"].get("summary", {})


def capture(label: str) -> dict:
    args = ["node", str(OUT / "fiado-corte-capture.mjs"), label, MARKER]
    env = os.environ.copy()
    env["CAPTURE_BASE"] = BASE
    if CAPTURE_DB:
        env["CAPTURE_DB"] = CAPTURE_DB
    completed = subprocess.run(
        args, cwd=str(WEB), env=env, capture_output=True, text=True, timeout=120
    )
    if completed.returncode != 0:
        return {"error": completed.stderr.strip(), "stdout": completed.stdout.strip()}
    try:
        data = json.loads(completed.stdout.splitlines()[-1])
    except Exception:
        data = {"stdout": completed.stdout.strip()}
    data["file"] = (OUT / f"{PREFIX}-{label}.json").as_posix()
    return data


def visible_result(page) -> dict:
    def text(selector: str) -> str | None:
        locator = page.locator(selector)
        return locator.inner_text() if locator.count() else None

    return {
        "title": text("#mc-caja-result-title"),
        "facts": text(".mc-caja-result__facts"),
        "note": text(".mc-caja-result__note"),
        "banner": text(".mc-caja-result__banner"),
        "summary": text(".mc-caja-summary"),
        "paymentTitle": text("#mc-caja-payment-title"),
        "paymentAmount": text(".mc-caja-payment__amount"),
        "main": text("main"),
    }


def shot(page, name: str) -> str:
    path = OUT / f"{PREFIX}-{name}.png"
    page.screenshot(path=str(path), full_page=True)
    return path.as_posix()


def add_line(page, description: str, quantity: str, price: str) -> None:
    # The first fill can land before React hydrates the controlled inputs.
    # Verify the value and retry instead of silently adding an empty line.
    for _ in range(4):
        page.locator("#mc-caja-new-description").fill(description)
        inputs = page.locator(".mc-caja-add__grid input")
        inputs.nth(1).fill(quantity)
        inputs.nth(2).fill(price)
        page.wait_for_timeout(500)
        if page.locator("#mc-caja-new-description").input_value() != description:
            page.wait_for_timeout(600)
            continue
        page.get_by_role("button", name="Agregar", exact=True).click()
        page.wait_for_timeout(700)
        error = page.locator("#mc-caja-add-error")
        if not (error.count() and error.is_visible()):
            return
        page.wait_for_timeout(600)
    error_text = page.locator("#mc-caja-add-error").inner_text()
    raise RuntimeError("No se pudo agregar el concepto: " + error_text)


def reset_caja(page) -> None:
    page.goto(BASE + "/caja", wait_until="domcontentloaded")
    page.evaluate("localStorage.clear()")
    page.goto(BASE + "/caja", wait_until="domcontentloaded")
    page.wait_for_selector("#mc-caja-new-description")
    page.wait_for_timeout(900)


def post_sale(page) -> tuple[dict, dict]:
    with page.expect_response(
        lambda response: response.url.endswith("/api/orders")
        and response.request.method == "POST"
    ) as info:
        page.locator(".mc-caja-confirm").click()
    response = info.value
    payload = response.request.post_data_json
    return payload, {"status": response.status, "body": response.json()}


def ventas_row(page, marker: str) -> dict:
    page.goto(BASE + "/ventas", wait_until="domcontentloaded")
    page.wait_for_selector("#ventas-title")
    row = page.locator("li", has_text=marker).first
    row.wait_for(state="visible")
    row.scroll_into_view_if_needed()
    data = {
        "rowText": row.inner_text(),
        "stats": page.locator(".mc-ventas-stats").inner_text(),
        "pageNote": page.locator(".mc-ventas-note").inner_text(),
        "url": page.url,
    }
    path = OUT / f"{PREFIX}-ventas-{marker.replace(' ', '_')}-{int(time.time())}.png"
    row.screenshot(path=str(path))
    data["screenshot"] = path.as_posix()
    return data


def main() -> int:
    baseline_cash = cash_status()
    baseline_preview = preview()
    baseline_summary = summary()
    baseline = capture("baseline")
    evidence["baseline"] = {
        "cash": baseline_cash,
        "preview": baseline_preview,
        "summary": baseline_summary,
        "capture": baseline,
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1448, "height": 1086}, locale="es-MX")
        page = context.new_page()
        console: list[str] = []
        page.on("console", lambda message: console.append(f"{message.type}: {message.text}"))
        page.on("pageerror", lambda error: console.append(f"pageerror: {error}"))

        # ---------------- T1: fiado puro ----------------
        reset_caja(page)
        add_line(page, f"Venta fiado {MARKER}", "1", "100")
        page.get_by_role("button", name="Fiado", exact=True).click()
        page.locator(".mc-caja-summary input").nth(1).wait_for(state="visible", timeout=10000)
        page.locator(".mc-caja-summary input").nth(1).fill(f"Cliente Fiado {MARKER}")
        fiado_summary = page.locator(".mc-caja-summary").inner_text()
        fiado_payload, fiado_response = post_sale(page)
        page.wait_for_selector("#mc-caja-result-title")
        page.wait_for_timeout(200)
        fiado_ui = visible_result(page)
        fiado_shot = shot(page, "t1-fiado-resultado")
        fiado_order = fiado_response["body"].get("order", {})
        fiado_id = fiado_order.get("id")
        fiado_credit_id = fiado_order.get("creditId")
        after_fiado_cash = cash_status()
        after_fiado_preview = preview()
        after_fiado_summary = summary()
        after_fiado_capture = capture("t1-fiado")

        evidence["steps"].append(
            {
                "id": "T1-fiado",
                "summaryBeforeConfirm": fiado_summary,
                "payload": fiado_payload,
                "response": fiado_response,
                "ui": fiado_ui,
                "screenshot": fiado_shot,
                "orderId": fiado_id,
                "creditId": fiado_credit_id,
                "cashAfter": after_fiado_cash,
                "previewAfter": after_fiado_preview,
                "summaryAfter": after_fiado_summary,
                "capture": after_fiado_capture,
            }
        )
        check("T1 payload fiado: cashCents=0", fiado_payload.get("cashCents") == 0, fiado_payload)
        check("T1 payload fiado: creditCents=10000", fiado_payload.get("creditCents") == 10000, fiado_payload)
        check("T1 order paidCents=0", fiado_order.get("paidCents") == 0, fiado_order)
        check("T1 order creditCents=10000", fiado_order.get("creditCents") == 10000, fiado_order)
        check("T1 order status=confirmed", fiado_order.get("status") == "confirmed", fiado_order)
        check("T1 corte cashSales sin cambio", after_fiado_cash.get("cashSalesCents") == baseline_cash.get("cashSalesCents"), after_fiado_cash)
        check("T1 corte cashCredit sin cambio", after_fiado_cash.get("cashCreditCents") == baseline_cash.get("cashCreditCents"), after_fiado_cash)
        check(
            "T1 preview cashSales/cashCredit iguales a /api/cash",
            after_fiado_preview["body"]["preview"].get("cashSalesCents") == after_fiado_cash.get("cashSalesCents")
            and after_fiado_preview["body"]["preview"].get("cashCreditCents") == after_fiado_cash.get("cashCreditCents"),
            after_fiado_preview["body"],
        )
        fiado_capture = after_fiado_capture.get("markerOrders", [])
        fiado_payments = after_fiado_capture.get("payments", [])
        fiado_credits = after_fiado_capture.get("credits", [])
        check("T1 DB: 0 payments de la venta fiado", len(fiado_payments) == 0, fiado_payments)
        check(
            "T1 DB: crÃ©dito original=balance=10000",
            len(fiado_credits) == 1
            and fiado_credits[0].get("original_cents") == 10000
            and fiado_credits[0].get("balance_cents") == 10000
            and fiado_credits[0].get("status") == "open",
            fiado_credits,
        )
        check("T1 UI resultado no dice cobrado", "cobrada" not in (fiado_ui.get("title") or "").lower(), fiado_ui.get("title"))
        check(
            "T1 UI muestra saldo vivo fiado 100.00",
            "100.00" in (fiado_ui.get("facts") or "").lower()
            and "saldo vivo fiado" in (fiado_ui.get("facts") or "").lower(),
            fiado_ui.get("facts"),
        )

        # ---------------- T2: mixto efectivo + fiado ----------------
        page.get_by_role("button", name="Nueva venta").click()
        page.wait_for_selector("#mc-caja-new-description")
        add_line(page, f"Venta mixta {MARKER}", "1", "90")
        page.get_by_role("button", name="Mixto", exact=True).click()
        summary_inputs = page.locator(".mc-caja-summary input")
        summary_inputs.nth(2).wait_for(state="visible", timeout=10000)
        summary_inputs.nth(0).fill("100")
        summary_inputs.nth(1).fill("30")
        summary_inputs.nth(2).fill(f"Cliente Mixto {MARKER}")
        mixed_summary = page.locator(".mc-caja-summary").inner_text()
        mixed_payload, mixed_response = post_sale(page)
        page.wait_for_selector("#mc-caja-result-title")
        page.wait_for_timeout(200)
        mixed_ui = visible_result(page)
        mixed_shot = shot(page, "t2-mixto-resultado")
        mixed_order = mixed_response["body"].get("order", {})
        mixed_id = mixed_order.get("id")
        mixed_credit_id = mixed_order.get("creditId")
        after_mixed_cash = cash_status()
        after_mixed_preview = preview()
        after_mixed_summary = summary()
        after_mixed_capture = capture("t2-mixto")

        evidence["steps"].append(
            {
                "id": "T2-mixto",
                "summaryBeforeConfirm": mixed_summary,
                "payload": mixed_payload,
                "response": mixed_response,
                "ui": mixed_ui,
                "screenshot": mixed_shot,
                "orderId": mixed_id,
                "creditId": mixed_credit_id,
                "cashAfter": after_mixed_cash,
                "previewAfter": after_mixed_preview,
                "summaryAfter": after_mixed_summary,
                "capture": after_mixed_capture,
            }
        )
        check(
            "T2 payload mixto: cashCents=6000 (no 10000)",
            mixed_payload.get("cashCents") == 6000,
            mixed_payload,
        )
        check("T2 payload mixto: creditCents=3000", mixed_payload.get("creditCents") == 3000, mixed_payload)
        check(
            "T2 order paidCents=6000 y creditCents=3000",
            mixed_order.get("paidCents") == 6000 and mixed_order.get("creditCents") == 3000,
            mixed_order,
        )
        check(
            "T2 UI muestra cambio 40.00",
            "cambio" in (mixed_ui.get("facts") or "").lower()
            and "40.00" in (mixed_ui.get("facts") or ""),
            mixed_ui.get("facts"),
        )
        check(
            "T2 UI separa recibido 100.00 y efectivo aplicado 60.00",
            "100.00" in (mixed_ui.get("facts") or "") and "60.00" in (mixed_ui.get("facts") or ""),
            mixed_ui.get("facts"),
        )
        check(
            "T2 UI saldo vivo fiado 30.00",
            "saldo vivo fiado" in (mixed_ui.get("facts") or "").lower()
            and "30.00" in (mixed_ui.get("facts") or ""),
            mixed_ui.get("facts"),
        )
        mixed_payments = after_mixed_capture.get("payments", [])
        mixed_credits = after_mixed_capture.get("credits", [])
        check(
            "T2 DB: exactamente 1 payment cash de 6000 para la venta mixta",
            len([p for p in mixed_payments if p.get("order_id") == mixed_id]) == 1
            and [p for p in mixed_payments if p.get("order_id") == mixed_id][0].get("amount_cents") == 6000,
            mixed_payments,
        )
        check(
            "T2 DB: ningÃºn asiento por el cambio 4000",
            all(p.get("amount_cents") != 4000 for p in mixed_payments),
            mixed_payments,
        )
        check(
            "T2 DB: crÃ©dito 3000 open",
            len([c for c in mixed_credits if c.get("order_id") == mixed_id]) == 1
            and [c for c in mixed_credits if c.get("order_id") == mixed_id][0].get("balance_cents") == 3000,
            mixed_credits,
        )
        check(
            "T2 corte cashSales +6000",
            after_mixed_cash.get("cashSalesCents") == baseline_cash.get("cashSalesCents") + 6000,
            after_mixed_cash,
        )
        check(
            "T2 corte cashCredit sin cambio",
            after_mixed_cash.get("cashCreditCents") == baseline_cash.get("cashCreditCents"),
            after_mixed_cash,
        )

        # ---------------- Venta en efectivo (bucket) ----------------
        page.get_by_role("button", name="Nueva venta").click()
        page.wait_for_selector("#mc-caja-new-description")
        add_line(page, f"Venta efectivo {MARKER}", "1", "50")
        page.get_by_role("button", name="Efectivo", exact=True).click()
        page.locator(".mc-caja-summary input").nth(0).wait_for(state="visible", timeout=10000)
        page.locator(".mc-caja-summary input").nth(0).fill("50")
        cash_payload, cash_response = post_sale(page)
        page.wait_for_selector("#mc-caja-result-title")
        page.wait_for_timeout(200)
        cash_ui = visible_result(page)
        cash_shot = shot(page, "t4-efectivo-resultado")
        cash_order = cash_response["body"].get("order", {})
        cash_id = cash_order.get("id")
        after_cash_cash = cash_status()
        after_cash_preview = preview()
        after_cash_summary = summary()
        after_cash_capture = capture("t4-efectivo")

        evidence["steps"].append(
            {
                "id": "T4-efectivo",
                "payload": cash_payload,
                "response": cash_response,
                "ui": cash_ui,
                "screenshot": cash_shot,
                "orderId": cash_id,
                "cashAfter": after_cash_cash,
                "previewAfter": after_cash_preview,
                "summaryAfter": after_cash_summary,
                "capture": after_cash_capture,
            }
        )
        check(
            "T4 efectivo: corte cashSales +5000 sobre el paso anterior",
            after_cash_cash.get("cashSalesCents") == after_mixed_cash.get("cashSalesCents") + 5000,
            after_cash_cash,
        )
        check(
            "T4 efectivo: cashCredit sin cambio",
            after_cash_cash.get("cashCreditCents") == after_mixed_cash.get("cashCreditCents"),
            after_cash_cash,
        )
        check(
            "T4 efectivo: preview coincide con /api/cash",
            after_cash_preview["body"]["preview"].get("cashSalesCents") == after_cash_cash.get("cashSalesCents")
            and after_cash_preview["body"]["preview"].get("cashCreditCents") == after_cash_cash.get("cashCreditCents")
            and after_cash_preview["body"]["preview"].get("expectedCents") == after_cash_cash.get("expectedCents"),
            after_cash_preview["body"],
        )

        # ---------------- Digital pendiente (bucket) ----------------
        page.get_by_role("button", name="Nueva venta").click()
        page.wait_for_selector("#mc-caja-new-description")
        add_line(page, f"Venta digital {MARKER}", "1", "80")
        page.get_by_role("button", name="Digital", exact=True).click()
        page.wait_for_timeout(300)
        digital_payload, digital_response = post_sale(page)
        page.wait_for_selector("#mc-caja-payment-title")
        page.wait_for_timeout(300)
        digital_ui = visible_result(page)
        digital_shot = shot(page, "t4-digital-pendiente")
        digital_order = digital_response["body"].get("order", {})
        digital_id = digital_order.get("id")
        after_digital_cash = cash_status()
        after_digital_preview = preview()
        after_digital_summary = summary()
        after_digital_capture = capture("t4-digital")

        evidence["steps"].append(
            {
                "id": "T4-digital",
                "payload": digital_payload,
                "response": digital_response,
                "ui": digital_ui,
                "screenshot": digital_shot,
                "orderId": digital_id,
                "cashAfter": after_digital_cash,
                "previewAfter": after_digital_preview,
                "summaryAfter": after_digital_summary,
                "capture": after_digital_capture,
            }
        )
        check(
            "T4 digital: no crea payments",
            len([p for p in after_digital_capture.get("payments", []) if p.get("order_id") == digital_id]) == 0,
            after_digital_capture.get("payments", []),
        )
        check(
            "T4 digital: corte sin cambio",
            after_digital_cash.get("cashSalesCents") == after_cash_cash.get("cashSalesCents")
            and after_digital_cash.get("cashCreditCents") == after_cash_cash.get("cashCreditCents"),
            after_digital_cash,
        )
        check(
            "T4 digital: pendiente del resumen +8000",
            after_digital_summary.get("pendingCents") == after_cash_summary.get("pendingCents") + 8000,
            {"before": after_cash_summary.get("pendingCents"), "after": after_digital_summary.get("pendingCents")},
        )

        # ---------------- T3: abono parcial, replay y saldado ----------------
        orders_before_abono = http_json("GET", "/api/orders?limit=1")["body"].get("total")
        partial_response = http_json(
            "POST",
            f"/api/credits/{fiado_credit_id}/pay",
            {
                "amountCents": 4000,
                "method": "cash",
                "note": f"Abono parcial {MARKER}",
                "requestId": f"cp-{MARKER}-1",
            },
        )
        after_partial_cash = cash_status()
        after_partial_preview = preview()
        after_partial_summary = summary()
        after_partial_capture = capture("t3-abono-parcial")
        ventas_partial = ventas_row(page, f"Cliente Fiado {MARKER}")
        partial_shot = ventas_partial["screenshot"]
        orders_after_abono = http_json("GET", "/api/orders?limit=1")["body"].get("total")

        evidence["steps"].append(
            {
                "id": "T3-abono-parcial",
                "response": partial_response,
                "cashAfter": after_partial_cash,
                "previewAfter": after_partial_preview,
                "summaryAfter": after_partial_summary,
                "capture": after_partial_capture,
                "ventas": ventas_partial,
                "screenshot": partial_shot,
                "ordersTotalBefore": orders_before_abono,
                "ordersTotalAfter": orders_after_abono,
            }
        )
        check("T3 abono parcial HTTP 200", partial_response.get("status") == 200, partial_response)
        check(
            "T3 abono aplicado 4000 y saldo 6000",
            partial_response["body"].get("appliedCents") == 4000
            and partial_response["body"].get("balanceCents") == 6000
            and partial_response["body"].get("duplicate") is False,
            partial_response["body"],
        )
        check(
            "T3 abono no crea venta nueva",
            orders_before_abono == orders_after_abono,
            {"before": orders_before_abono, "after": orders_after_abono},
        )
        partial_credits = after_partial_capture.get("credits", [])
        partial_credit = [c for c in partial_credits if c.get("id") == fiado_credit_id]
        check(
            "T3 DB: balance 6000 y status partial; order.credit_cents sigue 10000",
            len(partial_credit) == 1
            and partial_credit[0].get("balance_cents") == 6000
            and partial_credit[0].get("status") == "partial"
            and fiado_order.get("creditCents") == 10000,
            {"credit": partial_credit, "orderCreditCents": fiado_order.get("creditCents")},
        )
        check(
            "T3 corte cashCredit +4000 y cashSales sin cambio",
            after_partial_cash.get("cashCreditCents") == after_digital_cash.get("cashCreditCents") + 4000
            and after_partial_cash.get("cashSalesCents") == after_digital_cash.get("cashSalesCents"),
            after_partial_cash,
        )
        check(
            "T3 preview cashCredit coincide con /api/cash",
            after_partial_preview["body"]["preview"].get("cashCreditCents") == after_partial_cash.get("cashCreditCents"),
            after_partial_preview["body"],
        )
        check(
            "T3 /ventas muestra Saldo vivo 60.00",
            "Saldo vivo" in ventas_partial["rowText"] and "60.00" in ventas_partial["rowText"],
            ventas_partial["rowText"],
        )

        replay_response = http_json(
            "POST",
            f"/api/credits/{fiado_credit_id}/pay",
            {
                "amountCents": 4000,
                "method": "cash",
                "note": f"Abono parcial {MARKER}",
                "requestId": f"cp-{MARKER}-1",
            },
        )
        after_replay_capture = capture("t3-abono-replay")
        after_replay_cash = cash_status()
        evidence["steps"].append(
            {
                "id": "T3-abono-replay",
                "response": replay_response,
                "cashAfter": after_replay_cash,
                "capture": after_replay_capture,
            }
        )
        check(
            "T3 replay: duplicate=true, applied=4000, saldo=6000",
            replay_response["body"].get("duplicate") is True
            and replay_response["body"].get("appliedCents") == 4000
            and replay_response["body"].get("balanceCents") == 6000,
            replay_response["body"],
        )
        replay_credit_payments = after_replay_capture.get("creditPayments", [])
        check(
            "T3 replay: no inserta segundo credit_payment",
            len([p for p in replay_credit_payments if p.get("credit_id") == fiado_credit_id]) == 1,
            replay_credit_payments,
        )
        check(
            "T3 replay: corte sin cambio",
            after_replay_cash.get("cashCreditCents") == after_partial_cash.get("cashCreditCents"),
            after_replay_cash,
        )

        full_response = http_json(
            "POST",
            f"/api/credits/{fiado_credit_id}/pay",
            {
                "amountCents": 6000,
                "method": "cash",
                "note": f"Liquidacion {MARKER}",
                "requestId": f"cp-{MARKER}-2",
            },
        )
        after_full_cash = cash_status()
        after_full_preview = preview()
        after_full_capture = capture("t3-abono-total")
        ventas_full = ventas_row(page, f"Cliente Fiado {MARKER}")
        orders_after_full = http_json("GET", "/api/orders?limit=1")["body"].get("total")
        evidence["steps"].append(
            {
                "id": "T3-abono-total",
                "response": full_response,
                "cashAfter": after_full_cash,
                "previewAfter": after_full_preview,
                "capture": after_full_capture,
                "ventas": ventas_full,
                "screenshot": ventas_full["screenshot"],
                "ordersTotalBefore": orders_after_abono,
                "ordersTotalAfter": orders_after_full,
            }
        )
        check(
            "T3 abono total: aplicado 6000 y saldo 0",
            full_response["body"].get("appliedCents") == 6000
            and full_response["body"].get("balanceCents") == 0
            and full_response["body"].get("duplicate") is False,
            full_response["body"],
        )
        check(
            "T3 abono total no crea venta nueva",
            orders_after_full == orders_after_abono,
            {"before": orders_after_abono, "after": orders_after_full},
        )
        full_credits = after_full_capture.get("credits", [])
        full_credit = [c for c in full_credits if c.get("id") == fiado_credit_id]
        check(
            "T3 DB: crÃ©dito settled, balance 0; order.credit_cents sigue 10000",
            len(full_credit) == 1
            and full_credit[0].get("balance_cents") == 0
            and full_credit[0].get("status") == "settled"
            and fiado_order.get("creditCents") == 10000,
            {"credit": full_credit, "orderCreditCents": fiado_order.get("creditCents")},
        )
        check(
            "T3 corte cashCredit +6000 sobre parcial",
            after_full_cash.get("cashCreditCents") == after_partial_cash.get("cashCreditCents") + 6000,
            after_full_cash,
        )
        check(
            "T3 preview coincide con /api/cash tras liquidar",
            after_full_preview["body"]["preview"].get("cashCreditCents") == after_full_cash.get("cashCreditCents")
            and after_full_preview["body"]["preview"].get("expectedCents") == after_full_cash.get("expectedCents"),
            after_full_preview["body"],
        )
        check(
            "T3 /ventas muestra Fiado saldado y ya no Saldo vivo",
            "Fiado saldado" in ventas_full["rowText"] and "Saldo vivo" not in ventas_full["rowText"],
            ventas_full["rowText"],
        )

        # ---------------- /ventas mixto y digital ----------------
        ventas_mixed = ventas_row(page, f"Cliente Mixto {MARKER}")
        ventas_digital = ventas_row(page, f"Venta digital {MARKER}")
        ventas_fiado_final = ventas_row(page, f"Cliente Fiado {MARKER}")
        evidence["ventasFinal"] = {
            "mixto": ventas_mixed,
            "digital": ventas_digital,
            "fiadoFinal": ventas_fiado_final,
        }
        ventas_mixed_demo_masked = "Cobrado" not in ventas_mixed["rowText"]
        ventas_digital_demo_masked = "Pendiente de cobro" not in ventas_digital["rowText"]
        ventas_fiado_demo_masked = "Saldado" not in ventas_fiado_final["rowText"]
        evidence["ventasDemoMasking"] = {
            "mixedHasCobrado": not ventas_mixed_demo_masked,
            "digitalHasPendiente": not ventas_digital_demo_masked,
            "fiadoHasSaldadoBadge": not ventas_fiado_demo_masked,
        }
        check(
            "Ventas mixto: Saldo vivo 30.00 visible",
            "Saldo vivo" in ventas_mixed["rowText"] and "30.00" in ventas_mixed["rowText"],
            ventas_mixed["rowText"],
        )
        check(
            "Ventas digital: Falta cobrar 80.00 visible",
            "Falta cobrar" in ventas_digital["rowText"] and "80.00" in ventas_digital["rowText"],
            ventas_digital["rowText"],
        )
        check(
            "Ventas fiado final: Fiado saldado y sin Saldo vivo",
            "Fiado saldado" in ventas_fiado_final["rowText"]
            and "Saldo vivo" not in ventas_fiado_final["rowText"],
            ventas_fiado_final["rowText"],
        )

        evidence["console"] = console
        check(
            "Consola sin pageerror",
            not [line for line in console if line.startswith("pageerror")],
            console,
        )
        browser.close()

    evidence["finishedAt"] = datetime.now().isoformat()
    evidence["checksSummary"] = {
        "total": len(checks),
        "pass": len([c for c in checks if c["ok"]]),
        "fail": len([c for c in checks if not c["ok"]]),
    }
    (OUT / f"{PREFIX}-ui.json").write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    lines = [
        f"RUN {RUN} Â· MARKER {MARKER} Â· BASE {BASE}",
        f"{evidence['checksSummary']['pass']}/{evidence['checksSummary']['total']} PASS",
        "",
    ]
    for item in checks:
        lines.append(("PASS " if item["ok"] else "FAIL ") + item["name"])
        if not item["ok"] and item["detail"] is not None:
            lines.append("     " + json.dumps(item["detail"], ensure_ascii=False)[:2000])
    lines.append("")
    lines.append("CASH BASE: " + json.dumps(evidence["baseline"]["cash"], ensure_ascii=False))
    for step in evidence["steps"]:
        if step.get("cashAfter"):
            lines.append(f"CASH {step['id']}: " + json.dumps(step["cashAfter"], ensure_ascii=False))
    (OUT / f"{PREFIX}-ui.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\n{evidence['checksSummary']}")
    print(OUT / f"{PREFIX}-ui.json")
    return 0 if evidence["checksSummary"]["fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
