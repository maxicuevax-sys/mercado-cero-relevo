#!/usr/bin/env python3
"""Smoke funcional de Oleada B: /caja nueva y /ventas real.

Uso:
  $env:BASE_URL="http://localhost:3100"
  python scripts/oleada-b-smoke.py

No modifica el motor: crea ventas por las mismas APIs que usa la app.
"""
from __future__ import annotations

import json
import os
import random
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
OUT = Path(os.environ.get("OLEADA_B_OUT", ROOT / "quality-reports" / "oleada-b" / "capturas"))
OUT.mkdir(parents=True, exist_ok=True)
RESULTS: list[dict] = []
_reset = 0
_reset_base = random.randint(1, 120)


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")


def reset(page) -> None:
    global _reset
    _reset += 1
    response = page.request.post(
        f"{BASE}/api/demo/reset",
        headers={
            "x-forwarded-for": f"198.51.100.{((_reset + _reset_base) % 200) + 1}"
        },
    )
    assert response.ok, response.text()
    page.goto(BASE + "/inicio", wait_until="domcontentloaded")
    page.evaluate("localStorage.removeItem('mercado-cero:caja-draft:v2'); localStorage.removeItem('mercado-cero:caja-pending:v2'); localStorage.removeItem('mercado-cero:caja-request:v2')")
    page.goto(BASE + "/caja", wait_until="domcontentloaded")
    page.wait_for_timeout(600)


def add_item(page, description: str, quantity: str, price: str) -> None:
    add = page.locator(".mc-caja-add")
    add.get_by_label("Producto o servicio").fill(description)
    add.get_by_label("Cantidad").fill(quantity)
    add.get_by_label("Precio unitario").fill(price)
    add.get_by_role("button", name="Agregar", exact=True).click()
    page.wait_for_timeout(80)


def total_text(page) -> str:
    return page.locator(".mc-caja-total").inner_text()


def confirm(page) -> None:
    page.locator(".mc-caja-confirm").click()


def orders(page) -> list[dict]:
    response = page.request.get(f"{BASE}/api/orders")
    assert response.ok, response.text()
    return response.json()["orders"]


def new_orders(page, before: set[str]) -> list[dict]:
    return [order for order in orders(page) if order["id"] not in before]


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1000}, locale="es-MX")
        page = context.new_page()
        page.set_default_timeout(15_000)
        page_errors: list[str] = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        voice_requests: list[str] = []
        page.on(
            "request",
            lambda request: voice_requests.append(request.url)
            if "/api/voice" in request.url
            else None,
        )

        # A/B/C/D/E — conceptos, cantidades, eliminación y efectivo con cambio.
        reset(page)
        check("A: /caja carga sin IA ni micrófono", page.locator("#caja-title").inner_text() == "Nueva venta")
        add_item(page, "Quesadilla", "2", "35")
        check("B: dos conceptos y total 70", total_text(page) == "$70.00", total_text(page))
        add_item(page, "Agua", "1", "20")
        check("B: segundo concepto suma 90", total_text(page) == "$90.00", total_text(page))
        first = page.locator(".mc-caja-line").first
        first.get_by_label("Cantidad").fill("3")
        page.wait_for_timeout(120)
        check("C: cambiar cantidad recalcula total", total_text(page) == "$125.00", total_text(page))
        page.locator(".mc-caja-line").last.get_by_role("button", name="Quitar Agua").click()
        page.wait_for_timeout(120)
        check("D: eliminar concepto recalcula total", total_text(page) == "$105.00", total_text(page))
        page.get_by_label("Efectivo recibido").fill("120")
        check("E: cambio visible", "Cambio a devolver $15.00" in page.locator(".mc-caja-change").inner_text(), page.locator(".mc-caja-change").inner_text())
        before = {order["id"] for order in orders(page)}
        confirm(page)
        expect(page.locator(".mc-caja-result")).to_be_visible()
        created = new_orders(page, before)
        check(
            "E: efectivo registra una venta pagada con cambio",
            len(created) == 1
            and created[0]["status"] == "paid"
            and created[0]["paidCents"] == 10500,
            json.dumps({k: created[0][k] for k in ["status", "totalCents", "paidCents"]}) if created else "sin orden",
        )
        page.screenshot(path=str(OUT / "caja-efectivo-resultado-1280.png"))

        # E2 — parser de dinero: miles y decimales.
        reset(page)
        add_item(page, "Mil", "1", "1,000")
        check("E2: 1,000 se lee como mil pesos", total_text(page) == "$1,000.00", total_text(page))
        add_item(page, "Mil decimal", "1", "1,234.50")
        check("E2: 1,234.50 se lee con centavos", total_text(page) == "$2,234.50", total_text(page))

        # E3 — cantidades ambiguas no se convierten en otro número.
        reset(page)
        add_item(page, "Fracción", "1/2", "10")
        check(
            "E3: 1/2 no se convierte en 12 unidades",
            page.locator(".mc-caja-line").count() == 0
            and "cantidad" in page.locator("#mc-caja-add-error").inner_text().lower(),
            page.locator("#mc-caja-add-error").inner_text() if page.locator("#mc-caja-add-error").count() else "sin error",
        )

        # F — efectivo insuficiente bloquea.
        reset(page)
        add_item(page, "Insuficiente", "1", "90")
        page.get_by_label("Efectivo recibido").fill("50")
        check("F: efectivo insuficiente muestra faltante", "Faltan $40.00" in page.locator(".mc-caja-change").inner_text(), page.locator(".mc-caja-change").inner_text())
        check("F: confirmar deshabilitado", page.locator(".mc-caja-confirm").is_disabled())

        # F2 — cambiar de efectivo a fiado no deja cambio fantasma.
        reset(page)
        add_item(page, "Cambio método", "1", "50")
        page.get_by_label("Efectivo recibido").fill("100")
        page.get_by_role("button", name="Fiado", exact=True).click()
        page.wait_for_timeout(150)
        check(
            "F2: cambiar a fiado limpia efectivo y cambio",
            page.get_by_label("Efectivo recibido").count() == 0
            and page.locator(".mc-caja-change").count() == 0
            and page.get_by_label("Monto a fiado").input_value() == "50.00",
            page.get_by_label("Monto a fiado").input_value(),
        )

        # G — doble pulsación.
        reset(page)
        add_item(page, "Doble", "1", "30")
        page.get_by_label("Efectivo recibido").fill("30")
        before = {order["id"] for order in orders(page)}
        page.evaluate(
            """() => { const b = document.querySelector('.mc-caja-confirm'); b.click(); b.click(); }"""
        )
        expect(page.locator(".mc-caja-result")).to_be_visible()
        page.wait_for_timeout(400)
        check("G: doble pulsación crea una sola venta", len(new_orders(page, before)) == 1)

        # H — respuesta perdida y reintento con la misma llave.
        reset(page)
        add_item(page, "Reintento", "1", "40")
        page.get_by_label("Efectivo recibido").fill("40")
        before = {order["id"] for order in orders(page)}
        payloads: list[dict] = []
        attempts = {"n": 0}

        def lose_first(route):
            if route.request.method != "POST":
                route.continue_()
                return
            attempts["n"] += 1
            payloads.append(route.request.post_data_json or {})
            if attempts["n"] == 1:
                route.fetch()
                route.fulfill(
                    status=502,
                    content_type="application/json",
                    body=json.dumps({"error": "El banco tardó en responder. Reintenta."}),
                )
            else:
                route.continue_()

        page.route("**/api/orders", lose_first)
        confirm(page)
        expect(page.locator(".mc-caja-unknown")).to_contain_text("No sabemos si la venta quedó registrada")
        check("H: error posterior al commit queda visible", len(new_orders(page, before)) == 1)
        page.get_by_role("button", name="Reintentar con la misma llave").click()
        expect(page.locator(".mc-caja-result")).to_be_visible()
        page.wait_for_timeout(300)
        retried = new_orders(page, before)
        check("H: reintento no duplica y reutiliza requestId", len(retried) == 1 and payloads[0]["requestId"] == payloads[-1]["requestId"], json.dumps([x.get("requestId") for x in payloads]))
        page.unroute("**/api/orders")

        # I/L — digital pendiente y demo claramente identificado.
        reset(page)
        add_item(page, "Digital", "1", "50")
        page.get_by_role("button", name="Digital", exact=True).click()
        before = {order["id"] for order in orders(page)}
        confirm(page)
        expect(page.locator("#mc-caja-payment-title")).to_be_visible()
        check("I: digital queda pendiente, no pagado", page.locator(".mc-caja-status").inner_text().upper() in {"REGISTRADO", "PENDIENTE"}, page.locator(".mc-caja-status").inner_text())
        page.get_by_role("button", name="Generar link").click()
        page.wait_for_timeout(700)
        check("I: link de cobro generado", page.locator(".mc-caja-link code").count() == 1, page.locator(".mc-caja-link code").inner_text() if page.locator(".mc-caja-link code").count() else "sin link")
        order_id = new_orders(page, before)[0]["id"]
        page.screenshot(path=str(OUT / "caja-digital-pendiente-1280.png"))
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(800)
        check(
            "I: el cobro pendiente queda en la lista al recargar",
            page.locator("#caja-title").inner_text() == "Nueva venta"
            and page.locator(".mc-caja-pending").count() == 1
            and order_id[-4:].upper() in page.locator(".mc-caja-pending").inner_text(),
            page.locator(".mc-caja-pending").inner_text() if page.locator(".mc-caja-pending").count() else "sin lista",
        )
        page.get_by_role("button", name="Seguir cobrando").click()
        page.wait_for_timeout(300)
        check(
            "I: seguir cobrando reabre el pendiente",
            page.locator("#mc-caja-payment-title").count() == 1
            and order_id[-4:].upper() in page.locator("#mc-caja-payment-title").inner_text(),
            page.locator("#mc-caja-payment-title").inner_text() if page.locator("#mc-caja-payment-title").count() else "sin panel",
        )
        page.get_by_role("button", name="Simular tarjeta").click()
        expect(page.locator(".mc-caja-result")).to_be_visible()
        check("L: demo se identifica como simulación", "Pago demo (simulado)" in page.locator(".mc-caja-result").inner_text())
        created = new_orders(page, before)
        check("L: demo usa demo_paid", len(created) == 1 and created[0]["status"] == "demo_paid", created[0]["status"] if created else "sin orden")

        # M — fiado.
        reset(page)
        add_item(page, "Fiado", "1", "100")
        page.get_by_role("button", name="Fiado", exact=True).click()
        page.get_by_label("¿Quién queda a deber?").fill("Cliente B")
        before = {order["id"] for order in orders(page)}
        confirm(page)
        expect(page.locator(".mc-caja-result")).to_be_visible()
        created = new_orders(page, before)
        check("M: fiado crea deuda sin efectivo", len(created) == 1 and created[0]["status"] == "confirmed" and created[0]["creditCents"] == 10000 and created[0]["paidCents"] == 0, json.dumps({k: created[0][k] for k in ["status", "creditCents", "paidCents"]}) if created else "sin orden")
        check("M: el resultado no dice cobrado", "Solo el fiado es deuda" in page.locator(".mc-caja-result").inner_text())

        # M3 — un fiado saldado no se presenta como deuda viva.
        credit_id = created[0]["creditId"] if created else None
        if credit_id:
            pay = page.request.post(
                f"{BASE}/api/credits/{credit_id}/pay",
                data=json.dumps({"amountCents": 10000, "method": "cash", "requestId": "smoke_credit_settle"}),
                headers={"Content-Type": "application/json"},
            )
            check("M3: abono de fiado registrado", pay.ok, f"{pay.status}")
            page.goto(BASE + "/ventas", wait_until="networkidle")
            page.wait_for_timeout(400)
            row = page.locator(".mc-ventas-row", has_text=created[0]["id"][-4:].upper())
            check(
                "M3: historial muestra fiado saldado, no deuda viva",
                row.count() == 1
                and "Fiado saldado" in row.inner_text(),
                row.inner_text()[:200] if row.count() else "sin fila",
            )

        # M2 — venta mixta efectivo + fiado.
        reset(page)
        add_item(page, "Mixta", "1", "90")
        page.get_by_role("button", name="Mixto", exact=True).click()
        page.get_by_label("Efectivo recibido").fill("100")
        page.get_by_label("Monto a fiado").fill("30")
        page.get_by_label("¿Quién queda a deber?").fill("Juan")
        check("M2: cambio de venta mixta", "Cambio a devolver $40.00" in page.locator(".mc-caja-change").inner_text(), page.locator(".mc-caja-change").inner_text())
        before = {order["id"] for order in orders(page)}
        confirm(page)
        expect(page.locator(".mc-caja-result")).to_be_visible()
        created = new_orders(page, before)
        check(
            "M2: efectivo aplicado 60 y fiado 30",
            len(created) == 1
            and created[0]["paidCents"] == 6000
            and created[0]["creditCents"] == 3000
            and "40.00" in page.locator(".mc-caja-result").inner_text(),
            json.dumps({k: created[0][k] for k in ["paidCents", "creditCents"]}) if created else "sin orden",
        )

        # N — borrador interrumpido.
        reset(page)
        add_item(page, "Borrador", "2", "25")
        page.wait_for_timeout(250)
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(500)
        check("N: recupera borrador tras recargar", page.locator(".mc-caja-restore").count() == 1 and total_text(page) == "$50.00", total_text(page))
        page.get_by_role("button", name="Seguir").click()

        # O — nueva venta limpia.
        page.on("dialog", lambda dialog: dialog.accept())
        page.locator(".mc-caja-clear").click()
        page.wait_for_timeout(200)
        check("O: Caja queda lista para otra venta", page.locator(".mc-caja-line").count() == 0 and total_text(page) == "$0.00")

        # R — volver atrás conserva la pantalla de historial.
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.go_back(wait_until="networkidle")
        page.wait_for_timeout(300)
        check("R: atrás regresa a Ventas", page.locator("#ventas-title").inner_text() == "Ventas")

        # P — historial real.
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(300)
        rows = page.locator(".mc-ventas-row").count()
        check("P: historial lista ventas", rows > 0, str(rows))
        check("P: historial muestra pedido y estado", page.locator(".mc-ventas-row h3").count() == rows and page.locator(".mc-ventas-status").count() == rows)
        page.locator(".mc-ventas-row").first.locator("summary").click()
        check("P: historial abre conceptos", page.locator(".mc-ventas-row__details li").count() > 0)

        # Q — alias legacy con parámetros.
        page.goto(BASE + "/fiados?ayuda=1", wait_until="networkidle")
        page.wait_for_timeout(500)
        check("Q: /fiados conserva tab y ayuda", "tab=fiado" in page.url and "ayuda=1" in page.url, page.url)

        # S/T — sin voz ni IA.
        check("S/T: la venta manual no llamó a voz", len(voice_requests) == 0, json.dumps(voice_requests[:3]))
        check("sin errores de página", len(page_errors) == 0, json.dumps(page_errors[:3]))

        # Capturas base.
        reset(page)
        page.screenshot(path=str(OUT / "caja-vacia-1280.png"))
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "caja-vacia-390.png"))
        check("390 sin overflow", page.evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth"))
        page.set_viewport_size({"width": 320, "height": 640})
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "caja-vacia-320.png"))
        check("320 sin overflow", page.evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth"))
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "ventas-320.png"))
        check("ventas 320 sin overflow", page.evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth"))

        # Reflow con importe máximo y texto al 200 %.
        reset(page)
        add_item(page, "Importe máximo", "1", "1,000,000")
        for width, height in [(1448, 1086), (1366, 768), (390, 844), (320, 640)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(200)
            check(
                f"importe máximo sin overflow a {width}",
                page.evaluate(
                    "document.documentElement.scrollWidth === document.documentElement.clientWidth"
                ),
            )
        page.set_viewport_size({"width": 320, "height": 640})
        page.evaluate("document.documentElement.style.fontSize='32px'")
        page.wait_for_timeout(250)
        check(
            "importe máximo con texto 200% sin overflow a 320",
            page.evaluate(
                "document.documentElement.scrollWidth === document.documentElement.clientWidth"
            ),
        )

        context.close()
        browser.close()

    failed = [item for item in RESULTS if not item["ok"]]
    print(f"\nOLEADA B SMOKE — {len(RESULTS) - len(failed)} PASS · {len(failed)} FAIL")
    (OUT / "oleada-b-smoke.json").write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
