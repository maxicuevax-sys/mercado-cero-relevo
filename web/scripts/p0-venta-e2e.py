#!/usr/bin/env python3
"""E2E reproducible del carril P0 · venta durable.

Requisitos:
  pip install playwright
  python -m playwright install chromium

Uso:
  # terminal 1, desde web/
  $env:PORT="3101"
  $env:DATABASE_PATH="C:\\ruta\\temporal\\p0.db"
  $env:DEMO_MODE="true"
  npm start

  # terminal 2, desde web/
  python scripts/p0-venta-e2e.py
  # o: $env:P0_BASE_URL="http://localhost:3101"; python scripts/p0-venta-e2e.py

El script reinicia la demo antes de cada caso. No toca la base del repo
principal ni el servidor de :3000 si se apunta a :3101. Escribe el resultado
en harness/evidence/p0-venta-e2e.json.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.environ.get("P0_BASE_URL", "http://localhost:3101").rstrip("/")
DRAFT_KEY = "mercado-cero:draft:v1"
PENDING_KEY = "mercado-cero:pending-order:v1"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "harness" / "evidence" / "p0-venta-e2e.json"


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


def short_order(order_id: str) -> str:
    return order_id[-4:].upper()

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' · ' + detail) if detail else ''}")


def note(name: str, detail: str = "") -> None:
    results.append({"name": name, "ok": None, "detail": detail})
    print(f"KNOWN  {name}{(' · ' + detail) if detail else ''}")


def order_ids(page) -> set[str]:
    response = page.request.get(f"{BASE}/api/orders")
    assert response.ok, response.text()
    return {order["id"] for order in response.json()["orders"]}


def orders(page) -> list[dict]:
    response = page.request.get(f"{BASE}/api/orders")
    assert response.ok, response.text()
    return response.json()["orders"]


def new_orders(page, before: set[str]) -> list[dict]:
    return [order for order in orders(page) if order["id"] not in before]


def summary(page) -> dict:
    response = page.request.get(f"{BASE}/api/dashboard")
    assert response.ok, response.text()
    return response.json()["summary"]


def reset(page) -> None:
    response = page.request.post(f"{BASE}/api/demo/reset")
    assert response.ok, f"demo/reset falló: {response.status} {response.text()}"
    page.goto(BASE, wait_until="networkidle")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")


def add_item(page, description: str, quantity: float, price: float) -> None:
    page.get_by_role("button", name="Agregar producto", exact=True).click()
    page.get_by_role("textbox", name="Producto").last.fill(description)
    page.get_by_role("spinbutton", name="Cantidad").last.fill(str(quantity))
    page.get_by_role("textbox", name="Precio unitario").last.fill(str(price))


def close_dialog(page) -> None:
    dialog = page.get_by_role("dialog")
    if dialog.count():
        dialog.get_by_role("button", name="Cerrar", exact=True).first.click()


def stored_draft(page) -> dict | None:
    return page.evaluate(f"JSON.parse(localStorage.getItem('{DRAFT_KEY}') || 'null')")


def main() -> int:
    started_at = datetime.now(timezone.utc)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1000})
        page = context.new_page()

        # 0 · Parser caído: la venta manual sigue disponible.
        reset(page)
        page.route(
            "**/api/voice/parse",
            lambda route: route.fulfill(
                status=500,
                content_type="application/json",
                body=json.dumps({"error": "La IA no está disponible."}),
            ),
        )
        page.get_by_role("button", name="Dos quesadillas de 35 y un agua de 20").click()
        expect(page.get_by_text("La IA no está disponible.")).to_be_visible()
        page.get_by_role("button", name="Escribir productos").click()
        expect(page.get_by_role("textbox", name="Producto")).to_have_count(1)
        check(
            "con el parser en 500 se puede escribir un producto a mano",
            page.get_by_role("textbox", name="Producto").count() == 1,
        )
        page.get_by_role("button", name="Limpiar").click()
        page.get_by_role("button", name="Sí, limpiar").click()
        page.unroute("**/api/voice/parse")

        # 1 · Borrar todos los ítems limpia dinero, cliente, banner y confirmación.
        reset(page)
        add_item(page, "Viejo", 1, 90)
        page.get_by_label("Efectivo recibido en pesos").fill("100")
        page.get_by_label("Monto a fiado en pesos").fill("10")
        page.get_by_label("Nombre del cliente para el fiado").fill("Cliente viejo")
        page.get_by_role("button", name="Limpiar").click()
        expect(page.get_by_text("¿Descartar la venta sin confirmar?")).to_be_visible()
        page.get_by_role("button", name="Quitar producto").click()
        expect(page.get_by_role("textbox", name="Producto")).to_have_count(0)
        page.get_by_role("button", name="Agregar producto", exact=True).click()
        expect(page.get_by_role("textbox", name="Producto")).to_have_count(1)
        page.wait_for_function(f"localStorage.getItem('{DRAFT_KEY}') !== null")
        cash_value = page.get_by_label("Efectivo recibido en pesos").input_value()
        credit_value = page.get_by_label("Monto a fiado en pesos").input_value()
        draft = stored_draft(page)
        check("borrar el último ítem limpia efectivo", cash_value == "", cash_value)
        check("borrar el último ítem limpia fiado", credit_value == "", credit_value)
        check(
            "borrar el último ítem limpia cliente",
            page.get_by_label("Nombre del cliente para el fiado").count() == 0,
        )
        check(
            "borrar el último ítem cancela la confirmación de Limpiar",
            page.get_by_text("¿Descartar la venta sin confirmar?").count() == 0,
        )
        check(
            "el draft nuevo no guarda dinero sin ítems",
            bool(draft)
            and draft["cashCents"] == 0
            and draft["creditCents"] == 0
            and draft["customerName"] == "",
            json.dumps(draft, ensure_ascii=False) if draft else "sin draft",
        )

        # 2 · Un parseo nuevo hace obsoleto el banner de recuperación.
        reset(page)
        add_item(page, "Recuperada", 1, 50)
        page.wait_for_function(f"localStorage.getItem('{DRAFT_KEY}') !== null")
        page.reload(wait_until="networkidle")
        expect(page.get_by_text(re.compile(r"Recuperé tu venta de las \d{2}:\d{2}"))).to_be_visible()
        page.get_by_label("Escribe la venta").fill("Dos quesadillas de 35 y un agua de 20")
        page.get_by_role("button", name="Interpretar").click()
        expect(page.get_by_text("Escuché $90.00. ¿Confirmas?")).to_be_visible()
        check(
            "un parseo nuevo oculta el banner de recuperación",
            page.get_by_text(re.compile(r"Recuperé tu venta")).count() == 0,
        )
        check(
            "el parseo nuevo conserva su venta",
            page.get_by_role("textbox", name="Producto").count() == 2
            and "90.00" in page.locator("#confirmar").inner_text(),
        )
        check(
            "Descartar ya no está disponible sobre la venta nueva",
            page.get_by_role("button", name=re.compile("^Descartar")).count() == 0,
        )

        # 2b · El banner también desaparece si el borrador recuperado queda sin ítems.
        reset(page)
        add_item(page, "Recuperada sin ítems", 1, 50)
        page.wait_for_function(f"localStorage.getItem('{DRAFT_KEY}') !== null")
        page.reload(wait_until="networkidle")
        expect(page.get_by_text(re.compile(r"Recuperé tu venta de las \d{2}:\d{2}"))).to_be_visible()
        page.get_by_role("button", name="Quitar producto").click()
        expect(page.get_by_role("textbox", name="Producto")).to_have_count(0)
        check(
            "quedar sin ítems oculta el banner y elimina el draft pagable",
            page.get_by_text(re.compile(r"Recuperé tu venta")).count() == 0
            and page.evaluate(f"localStorage.getItem('{DRAFT_KEY}')") is None,
        )

        # 2c · "Continuar venta" mantiene el draft y oculta el banner.
        reset(page)
        add_item(page, "Continuar borrador", 1, 25)
        page.wait_for_function(f"localStorage.getItem('{DRAFT_KEY}') !== null")
        page.reload(wait_until="networkidle")
        expect(page.get_by_text(re.compile(r"Recuperé tu venta de las \d{2}:\d{2}"))).to_be_visible()
        check(
            "el banner del draft usa Descartar borrador",
            page.get_by_role("button", name="Descartar el borrador de venta").count() == 1,
        )
        page.get_by_role("button", name="Continuar la venta recuperada").click()
        page.wait_for_timeout(120)
        check(
            "Continuar venta conserva el draft y oculta el banner",
            page.get_by_text(re.compile(r"Recuperé tu venta")).count() == 0
            and page.get_by_role("textbox", name="Producto").input_value() == "Continuar borrador"
            and page.evaluate(f"localStorage.getItem('{DRAFT_KEY}')") is not None,
        )
        page.reload(wait_until="networkidle")
        check(
            "Continuar venta oculta el banner solo en la sesión; el draft sigue",
            page.get_by_text(re.compile(r"Recuperé tu venta de las \d{2}:\d{2}")).count() == 1
            and page.get_by_role("textbox", name="Producto").input_value() == "Continuar borrador"
            and page.evaluate(f"localStorage.getItem('{DRAFT_KEY}')") is not None,
        )

        # 2d · "Descartar borrador" intacto borra; editado no borra.
        reset(page)
        add_item(page, "Borrador intacto", 1, 15)
        page.wait_for_function(f"localStorage.getItem('{DRAFT_KEY}') !== null")
        page.reload(wait_until="networkidle")
        expect(page.get_by_text(re.compile(r"Recuperé tu venta de las \d{2}:\d{2}"))).to_be_visible()
        page.get_by_role("button", name="Descartar el borrador de venta").click()
        page.wait_for_timeout(120)
        check(
            "Descartar borrador intacto borra el draft y el storage",
            page.get_by_role("textbox", name="Producto").count() == 0
            and page.get_by_text(re.compile(r"Recuperé tu venta")).count() == 0
            and page.evaluate(f"localStorage.getItem('{DRAFT_KEY}')") is None,
        )

        reset(page)
        add_item(page, "Borrador editable", 1, 15)
        page.wait_for_function(f"localStorage.getItem('{DRAFT_KEY}') !== null")
        page.reload(wait_until="networkidle")
        expect(page.get_by_text(re.compile(r"Recuperé tu venta de las \d{2}:\d{2}"))).to_be_visible()
        page.get_by_role("textbox", name="Producto").fill("Borrador editado")
        page.wait_for_function(
            f"JSON.parse(localStorage.getItem('{DRAFT_KEY}')).items[0].description === 'Borrador editado'"
        )
        check(
            "editar el draft no oculta el banner antes de decidir",
            page.get_by_text(re.compile(r"Recuperé tu venta")).count() == 1,
        )
        page.get_by_role("button", name="Descartar el borrador de venta").click()
        page.wait_for_timeout(120)
        edited = page.evaluate(f"JSON.parse(localStorage.getItem('{DRAFT_KEY}') || 'null')")
        check(
            "Descartar borrador editado no borra la edición",
            page.get_by_text(re.compile(r"Recuperé tu venta")).count() == 0
            and page.get_by_role("textbox", name="Producto").input_value() == "Borrador editado"
            and bool(edited)
            and edited["items"][0]["description"] == "Borrador editado",
        )

        # 3 · El cambio se conserva después de confirmar.
        reset(page)
        add_item(page, "Cambio efectivo", 1, 90)
        page.get_by_label("Efectivo recibido en pesos").fill("100")
        before = order_ids(page)
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        expect(page.get_by_role("dialog")).to_contain_text("Cambio $10.00")
        created = new_orders(page, before)
        check(
            "efectivo $100 sobre $90 conserva cambio $10",
            len(created) == 1
            and created[0]["paidCents"] == 9000
            and created[0]["status"] == "paid",
            f"orden={created[0]['id'] if created else 'ninguna'}",
        )
        close_dialog(page)

        add_item(page, "Cambio fiado", 1, 90)
        page.get_by_label("Efectivo recibido en pesos").fill("100")
        page.get_by_label("Monto a fiado en pesos").fill("30")
        page.get_by_label("Nombre del cliente para el fiado").fill("Cambio")
        before = order_ids(page)
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        expect(page.get_by_role("dialog")).to_contain_text("Cambio $40.00")
        created = new_orders(page, before)
        check(
            "efectivo $100 con $30 fiado conserva cambio $40",
            len(created) == 1
            and created[0]["paidCents"] == 6000
            and created[0]["creditCents"] == 3000,
            f"orden={created[0]['id'] if created else 'ninguna'}",
        )
        close_dialog(page)

        # 3b · P0: teclear dinero no reformatea el texto en cada tecla.
        reset(page)
        page.get_by_role("button", name="Agregar producto", exact=True).click()
        page.get_by_role("textbox", name="Producto").last.fill("Tecleo P0")
        page.get_by_role("spinbutton", name="Cantidad").last.fill("2")
        price = page.get_by_role("textbox", name="Precio unitario").last
        price.click()
        price.press("Control+a")
        price.press_sequentially("35", delay=80)
        check(
            "precio 35 conserva el texto crudo mientras se teclea",
            price.input_value() == "35",
            price.input_value(),
        )
        cash = page.get_by_label("Efectivo recibido en pesos")
        cash.click()
        check(
            "precio se formatea a 35.00 solo al salir",
            price.input_value() == "35.00",
            price.input_value(),
        )
        cash.press_sequentially("100", delay=80)
        check(
            "efectivo 100 conserva el texto crudo mientras se teclea",
            cash.input_value() == "100",
            cash.input_value(),
        )
        credit = page.get_by_label("Monto a fiado en pesos")
        credit.click()
        check(
            "efectivo se formatea a 100.00 solo al salir",
            cash.input_value() == "100.00",
            cash.input_value(),
        )
        credit.press_sequentially("40", delay=80)
        check(
            "fiado 40 conserva el texto crudo mientras se teclea",
            credit.input_value() == "40",
            credit.input_value(),
        )
        page.get_by_label("Nombre del cliente para el fiado").fill("Tecleo")
        check(
            "fiado se formatea a 40.00 solo al salir",
            credit.input_value() == "40.00",
            credit.input_value(),
        )
        expect(page.get_by_text("Cambio $70.00")).to_be_visible()
        check(
            "efectivo 100 + fiado 40 sobre 35 × 2 deja cambio 70",
            "$70.00" in page.locator("#cash-change").inner_text(),
            page.locator("#cash-change").inner_text().replace("\n", " · "),
        )
        before = order_ids(page)
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        expect(page.get_by_role("dialog")).to_contain_text("Cambio $70.00")
        typed = new_orders(page, before)
        check(
            "la venta tecleada guarda precio 3500, efectivo 3000 y fiado 4000",
            len(typed) == 1
            and typed[0]["items"][0]["unitPriceCents"] == 3500
            and typed[0]["items"][0]["quantity"] == 2
            and typed[0]["totalCents"] == 7000
            and typed[0]["paidCents"] == 3000
            and typed[0]["creditCents"] == 4000,
            json.dumps(typed[0], ensure_ascii=False) if typed else "sin orden",
        )
        close_dialog(page)

        # 4 · Foco después de "Sí, limpiar".
        reset(page)
        add_item(page, "Foco", 1, 10)
        page.get_by_role("button", name="Limpiar").click()
        page.get_by_role("button", name="Sí, limpiar").click()
        page.wait_for_timeout(120)
        focused = page.evaluate("document.activeElement && document.activeElement.id")
        check("Sí, limpiar enfoca Agregar producto", focused == "draft-add-empty", str(focused))

        # 5 · P0-B: activeOrderId + Continuar/Descartar, sin auto-abrir ni duplicar.
        reset(page)
        add_item(page, "Pendiente", 1, 90)
        page.get_by_label("Efectivo recibido en pesos").fill("30")
        before = order_ids(page)
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        created = new_orders(page, before)
        assert len(created) == 1, created
        pending_id = created[0]["id"]
        check("la venta con saldo digital queda confirmada", created[0]["status"] == "confirmed")
        close_dialog(page)
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()
        stored_pending = page.evaluate(f"JSON.parse(localStorage.getItem('{PENDING_KEY}') || 'null')")
        check(
            "el pendiente se guarda en localStorage",
            bool(stored_pending) and stored_pending.get("orderId") == pending_id,
            json.dumps(stored_pending, ensure_ascii=False) if stored_pending else "sin clave",
        )
        check(
            "el aviso del pendiente usa Descartar aviso",
            page.get_by_role("button", name="Descartar el aviso de cobro pendiente").count() == 1,
        )
        before_reload = order_ids(page)
        page.reload(wait_until="networkidle")
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()
        check(
            "recargar muestra el aviso sin abrir el cobro solo",
            page.get_by_role("dialog").count() == 0,
        )
        page.get_by_role("button", name="Continuar el cobro pendiente").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        expect(page.get_by_role("dialog")).to_contain_text("$60.00")
        expect(page.get_by_role("dialog")).to_contain_text(f"Pedido {short_order(pending_id)}")
        check(
            "Continuar reabre el mismo pendiente sin duplicar",
            order_ids(page) == before_reload
            and pending_id in before_reload
            and f"Pedido {short_order(pending_id)}"
            in page.get_by_role("dialog").inner_text(),
            f"pedido={short_order(pending_id)}",
        )
        close_dialog(page)
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()
        page.get_by_role("button", name="Descartar el aviso de cobro pendiente").click()
        page.wait_for_timeout(120)
        focused = page.evaluate("document.activeElement && document.activeElement.id")
        check(
            "Descartar el aviso no borra la orden y enfoca Caja",
            page.get_by_text("Tienes un cobro pendiente").count() == 0
            and page.evaluate(f"localStorage.getItem('{PENDING_KEY}')") is None
            and any(order["id"] == pending_id for order in orders(page))
            and focused == "caja-heading",
            f"foco={focused}",
        )
        page.reload(wait_until="networkidle")
        check(
            "el aviso descartado no reaparece al recargar",
            page.get_by_text("Tienes un cobro pendiente").count() == 0,
        )

        # 5b · Un pendiente ajeno sobrevive a crear y abrir otra orden pagada.
        reset(page)
        add_item(page, "Pendiente ajeno", 1, 90)
        page.get_by_label("Efectivo recibido en pesos").fill("30")
        before = order_ids(page)
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        created = new_orders(page, before)
        assert len(created) == 1, created
        pending_id = created[0]["id"]
        close_dialog(page)
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()

        add_item(page, "Venta pagada", 1, 10)
        page.get_by_label("Efectivo recibido en pesos").fill("10")
        before = order_ids(page)
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        expect(page.get_by_role("dialog")).to_contain_text("Efectivo recibido")
        paid_created = new_orders(page, before)
        stored_after = page.evaluate(
            f"JSON.parse(localStorage.getItem('{PENDING_KEY}') || 'null')"
        )
        check(
            "crear otra venta pagada no borra el pendiente ajeno",
            len(paid_created) == 1
            and paid_created[0]["id"] != pending_id
            and bool(stored_after)
            and stored_after.get("orderId") == pending_id,
            json.dumps(stored_after, ensure_ascii=False) if stored_after else "sin clave",
        )
        close_dialog(page)
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()
        page.get_by_role("button", name=re.compile("Venta pagada")).first.click()
        expect(page.get_by_role("dialog")).to_be_visible()
        close_dialog(page)
        page.wait_for_timeout(120)
        stored_after_open = page.evaluate(
            f"JSON.parse(localStorage.getItem('{PENDING_KEY}') || 'null')"
        )
        check(
            "abrir y cerrar otra orden pagada conserva el aviso",
            page.get_by_text("Tienes un cobro pendiente de $60.00").count() == 1
            and bool(stored_after_open)
            and stored_after_open.get("orderId") == pending_id,
            json.dumps(stored_after_open, ensure_ascii=False)
            if stored_after_open
            else "sin clave",
        )
        page.reload(wait_until="networkidle")
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()
        page.get_by_role("button", name="Continuar el cobro pendiente").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        expect(page.get_by_role("dialog")).to_contain_text("$60.00")
        expect(page.get_by_role("dialog")).to_contain_text(f"Pedido {short_order(pending_id)}")
        check(
            "Continuar cobro muestra el Pedido #### correcto",
            f"Pedido {short_order(pending_id)}" in page.get_by_role("dialog").inner_text(),
            f"pedido={short_order(pending_id)}",
        )
        page.get_by_role("button", name="Link de pago").click()
        expect(page.get_by_role("button", name="Simular CoDi")).to_be_visible()
        page.get_by_role("button", name="Simular CoDi").click()
        expect(page.get_by_text("Pago mixto")).to_be_visible()
        page.wait_for_timeout(600)
        paid_pending = next(order for order in orders(page) if order["id"] == pending_id)
        check(
            "pagar el pendiente lo borra del aviso",
            paid_pending["status"] == "demo_paid"
            and page.evaluate(f"localStorage.getItem('{PENDING_KEY}')") is None
            and page.get_by_text("Tienes un cobro pendiente").count() == 0,
        )
        close_dialog(page)

        # 5c · El pendiente sobrevive a una orden fulfilled ajena (crédito completo).
        reset(page)
        add_item(page, "Pendiente ante fiado", 1, 90)
        page.get_by_label("Efectivo recibido en pesos").fill("30")
        before = order_ids(page)
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        created = new_orders(page, before)
        assert len(created) == 1, created
        pending_id = created[0]["id"]
        close_dialog(page)
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()

        add_item(page, "Fiado ajeno", 1, 20)
        page.get_by_label("Monto a fiado en pesos").fill("20")
        page.get_by_label("Nombre del cliente para el fiado").fill("Cliente fiado")
        before = order_ids(page)
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        fulfilled_created = new_orders(page, before)
        assert len(fulfilled_created) == 1, fulfilled_created
        check(
            "la venta de crédito completo queda fulfilled",
            fulfilled_created[0]["status"] == "fulfilled"
            and fulfilled_created[0]["creditCents"] == 2000,
        )
        close_dialog(page)
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()
        stored_fulfilled = page.evaluate(
            f"JSON.parse(localStorage.getItem('{PENDING_KEY}') || 'null')"
        )
        check(
            "crear una orden fulfilled ajena no borra el pendiente",
            bool(stored_fulfilled) and stored_fulfilled.get("orderId") == pending_id,
            json.dumps(stored_fulfilled, ensure_ascii=False)
            if stored_fulfilled
            else "sin clave",
        )

        page.get_by_role("button", name=re.compile("Fiado ajeno")).first.click()
        expect(page.get_by_role("dialog")).to_be_visible()
        close_dialog(page)
        page.wait_for_timeout(120)
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()
        stored_open_fulfilled = page.evaluate(
            f"JSON.parse(localStorage.getItem('{PENDING_KEY}') || 'null')"
        )
        check(
            "abrir y cerrar la orden fulfilled ajena conserva el pendiente",
            bool(stored_open_fulfilled)
            and stored_open_fulfilled.get("orderId") == pending_id,
        )
        page.reload(wait_until="networkidle")
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()

        # 6 · Venta mixta con saldo digital: hueco conocido de P0-C/E, no de este carril.
        reset(page)
        add_item(page, "Mixta", 1, 90)
        page.get_by_label("Efectivo recibido en pesos").fill("30")
        page.get_by_label("Monto a fiado en pesos").fill("20")
        page.get_by_label("Nombre del cliente para el fiado").fill("Ana")
        before = order_ids(page)
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        created = new_orders(page, before)
        assert len(created) == 1, created
        mixed = created[0]
        check(
            "la orden mixta conserva $30 efectivo, $20 fiado y $40 digitales",
            mixed["paidCents"] == 3000
            and mixed["creditCents"] == 2000
            and mixed["totalCents"] - mixed["paidCents"] - mixed["creditCents"] == 4000,
        )
        # El cobro del remanente digital se cubre en p0-integracion-e2e.py (P0-5):
        # PaymentPanel muestra Link/QR/demo y termina en “Pago mixto”.
        close_dialog(page)

        # 7 · 51 ítems: sin truncamiento silencioso.
        reset(page)
        items = [
            {
                "id": f"bulk_{index}",
                "description": f"Producto {index}",
                "quantity": 1,
                "unitPriceCents": 100,
            }
            for index in range(51)
        ]
        payload = {
            "version": 1,
            "items": items,
            "cashCents": 0,
            "creditCents": 0,
            "customerName": "",
            "textInput": "",
            "transcript": "",
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
        page.evaluate(
            "([key, value]) => localStorage.setItem(key, value)",
            [DRAFT_KEY, json.dumps(payload)],
        )
        page.reload(wait_until="networkidle")
        expect(page.get_by_text(re.compile(r"Recuperé tu venta"))).to_be_visible()
        check(
            "51 ítems se restauran sin truncar",
            page.get_by_role("textbox", name="Producto").count() == 51,
            f"contador={page.get_by_role('textbox', name='Producto').count()}",
        )

        # 8 · aria-invalid solo en el campo que corresponde.
        reset(page)
        page.get_by_role("button", name="Agregar producto", exact=True).click()
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_text("Escribe el producto. El precio debe ser mayor a cero.")).to_be_visible()
        description_invalid = page.get_by_role("textbox", name="Producto").get_attribute(
            "aria-invalid"
        )
        quantity_invalid = page.get_by_role("spinbutton", name="Cantidad").get_attribute(
            "aria-invalid"
        )
        price_invalid = page.get_by_role("textbox", name="Precio unitario").get_attribute(
            "aria-invalid"
        )
        check(
            "aria-invalid marca solo la descripción inválida",
            description_invalid == "true"
            and quantity_invalid != "true"
            and price_invalid != "true",
            f"desc={description_invalid} qty={quantity_invalid} price={price_invalid}",
        )
        page.get_by_role("textbox", name="Producto").fill("Solo precio")
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_text("El precio debe ser mayor a cero.")).to_be_visible()
        price_invalid = page.get_by_role("textbox", name="Precio unitario").get_attribute(
            "aria-invalid"
        )
        check(
            "aria-invalid marca solo el precio inválido",
            price_invalid == "true",
            f"price={price_invalid}",
        )
        page.wait_for_timeout(120)
        focused = page.evaluate("document.activeElement && document.activeElement.id")
        check(
            "precio 0 enfoca el campo de precio",
            str(focused).startswith("draft-price-"),
            f"foco={focused}",
        )

        # 8b · Cantidad 0 restaurada: error, foco y sin POST.
        reset(page)
        quantity_payload = {
            "version": 1,
            "items": [
                {
                    "id": "cantidad_cero",
                    "description": "Cantidad cero",
                    "quantity": 0,
                    "unitPriceCents": 5000,
                }
            ],
            "cashCents": 0,
            "creditCents": 0,
            "customerName": "",
            "textInput": "",
            "transcript": "",
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
        page.evaluate(
            "([key, value]) => localStorage.setItem(key, value)",
            [DRAFT_KEY, json.dumps(quantity_payload)],
        )
        page.reload(wait_until="networkidle")
        expect(page.get_by_text(re.compile(r"Recuperé tu venta"))).to_be_visible()
        quantity_posts: list[str] = []
        page.on(
            "request",
            lambda request: quantity_posts.append(request.url)
            if request.method == "POST"
            and "/api/orders" in request.url
            and "/pay" not in request.url
            else None,
        )
        page.get_by_role("button", name="Confirmar venta").click()
        expect(page.get_by_text("La cantidad debe ser mayor a cero.")).to_be_visible()
        page.wait_for_timeout(120)
        focused = page.evaluate("document.activeElement && document.activeElement.id")
        check(
            "cantidad 0 restaurada enfoca cantidad y no envía POST",
            focused == "draft-quantity-cantidad_cero" and quantity_posts == [],
            f"foco={focused} posts={quantity_posts}",
        )

        # 8c · Banners de ayer y de varios días.
        reset(page)
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).replace(microsecond=0)
        yesterday_payload = {
            "version": 1,
            "items": [
                {
                    "id": "ayer",
                    "description": "Ayer",
                    "quantity": 1,
                    "unitPriceCents": 5000,
                }
            ],
            "cashCents": 0,
            "creditCents": 0,
            "customerName": "",
            "textInput": "",
            "transcript": "",
            "updatedAt": yesterday.isoformat(),
        }
        page.evaluate(
            "([key, value]) => localStorage.setItem(key, value)",
            [DRAFT_KEY, json.dumps(yesterday_payload)],
        )
        page.reload(wait_until="networkidle")
        check(
            "un draft de ayer muestra 'ayer' y la hora",
            page.get_by_text(re.compile(r"Recuperé tu venta de ayer a las \d{2}:\d{2}")).count()
            == 1,
        )
        page.get_by_role("button", name="Descartar el borrador de venta").click()
        page.wait_for_timeout(120)

        old_payload = dict(yesterday_payload)
        old_payload["items"] = [
            {
                "id": "viejo",
                "description": "Viejo",
                "quantity": 1,
                "unitPriceCents": 5000,
            }
        ]
        old_payload["updatedAt"] = (
            datetime.now(timezone.utc) - timedelta(days=3)
        ).replace(microsecond=0).isoformat()
        page.evaluate(
            "([key, value]) => localStorage.setItem(key, value)",
            [DRAFT_KEY, json.dumps(old_payload)],
        )
        page.reload(wait_until="networkidle")
        check(
            "un draft de varios días muestra la fecha",
            page.get_by_text(re.compile(r"Recuperé tu venta del \d{2}/\d{2} a las \d{2}:\d{2}")).count()
            == 1,
        )
        page.get_by_role("button", name="Descartar el borrador de venta").click()
        page.wait_for_timeout(120)

        # 9 · JSON corrupto se elimina y no bloquea la caja.
        reset(page)
        page.evaluate(f"localStorage.setItem('{DRAFT_KEY}', '{{corrupto')")
        page.reload(wait_until="networkidle")
        check(
            "un draft corrupto se elimina",
            page.evaluate(f"localStorage.getItem('{DRAFT_KEY}')") is None
            and page.get_by_text(re.compile(r"Recuperé tu venta")).count() == 0,
        )

        # 10 · Reiniciar demo limpia draft y pendiente.
        reset(page)
        add_item(page, "Antes de demo", 1, 10)
        page.get_by_role("button", name="Modo demo").first.click()
        page.get_by_role("button", name="Reiniciar datos de demo").click()
        with page.expect_response(
            lambda response: "/api/demo/reset" in response.url
            and response.request.method == "POST"
        ):
            page.get_by_role("button", name="Sí, reiniciar").click()
        page.wait_for_timeout(400)
        check(
            "reiniciar demo limpia el borrador",
            page.get_by_role("textbox", name="Producto").count() == 0
            and page.evaluate(f"localStorage.getItem('{DRAFT_KEY}')") is None
            and page.evaluate(f"localStorage.getItem('{PENDING_KEY}')") is None,
        )

        browser.close()

    passed = sum(1 for item in results if item["ok"] is True)
    failed = sum(1 for item in results if item["ok"] is False)
    known = sum(1 for item in results if item["ok"] is None)
    summary = {"pass": passed, "fail": failed, "known": known, "total": len(results)}
    try:
        next_version = json.loads(
            (ROOT / "web" / "package.json").read_text(encoding="utf-8")
        )["dependencies"]["next"]
    except Exception:
        next_version = "desconocida"
    payload = {
        "schemaVersion": 1,
        "suite": "p0-venta-e2e",
        "baseUrl": BASE,
        "command": "python web/scripts/p0-venta-e2e.py",
        "requires": [
            "pip install playwright",
            "python -m playwright install chromium",
            "servidor aislado en P0_BASE_URL (por defecto http://localhost:3101)",
        ],
        "code": {
            "commit": git_value("rev-parse", "HEAD"),
            "branch": git_value("rev-parse", "--abbrev-ref", "HEAD"),
            "dirty": bool(git_value("status", "--porcelain")),
        },
        "build": {
            "next": next_version,
            "command": "npm run build",
        },
        "startedAt": started_at.isoformat(),
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "results": results,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nP0 VENTA E2E · {passed} PASS · {failed} FAIL · {known} KNOWN")
    print(f"EVIDENCIA {OUT}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
