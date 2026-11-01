#!/usr/bin/env python3
"""E2E reproducible del carril P0 · venta durable.

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
principal ni el servidor de :3000 si se apunta a :3101.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone

from playwright.sync_api import sync_playwright, expect

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.environ.get("P0_BASE_URL", "http://localhost:3101").rstrip("/")
DRAFT_KEY = "mercado-cero:draft:v1"
PENDING_KEY = "mercado-cero:pending-order:v1"

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
    page.request.post(f"{BASE}/api/demo/reset")
    page.goto(BASE, wait_until="networkidle")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")


def add_item(page, description: str, quantity: float, price: float) -> None:
    page.get_by_role("button", name="Agregar producto", exact=True).click()
    page.get_by_role("textbox", name="Producto").last.fill(description)
    page.get_by_role("spinbutton", name="Cantidad").last.fill(str(quantity))
    page.get_by_role("spinbutton", name="Precio unitario").last.fill(str(price))


def close_dialog(page) -> None:
    dialog = page.get_by_role("dialog")
    if dialog.count():
        dialog.get_by_role("button", name="Cerrar", exact=True).first.click()


def stored_draft(page) -> dict | None:
    return page.evaluate(f"JSON.parse(localStorage.getItem('{DRAFT_KEY}') || 'null')")


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1000})
        page = context.new_page()

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
            page.get_by_role("button", name="Descartar").count() == 0,
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
        check(
            "el pendiente se guarda en localStorage",
            page.evaluate(f"localStorage.getItem('{PENDING_KEY}')") is not None,
        )
        before_reload = order_ids(page)
        page.reload(wait_until="networkidle")
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()
        check(
            "recargar muestra el aviso sin abrir el cobro solo",
            page.get_by_role("dialog").count() == 0,
        )
        page.get_by_role("button", name="Continuar").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        expect(page.get_by_role("dialog")).to_contain_text("$60.00")
        check(
            "Continuar reabre el mismo pendiente sin duplicar",
            order_ids(page) == before_reload and pending_id in before_reload,
        )
        close_dialog(page)
        expect(page.get_by_text("Tienes un cobro pendiente de $60.00")).to_be_visible()
        page.get_by_role("button", name="Descartar").click()
        check(
            "Descartar el aviso no borra la orden",
            page.get_by_text("Tienes un cobro pendiente").count() == 0
            and page.evaluate(f"localStorage.getItem('{PENDING_KEY}')") is None
            and any(order["id"] == pending_id for order in orders(page)),
        )
        page.reload(wait_until="networkidle")
        check(
            "el aviso descartado no reaparece al recargar",
            page.get_by_text("Tienes un cobro pendiente").count() == 0,
        )

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
        note(
            "HUECO CONOCIDO P0-C/E: el PaymentPanel con fiado no ofrece cobrar el saldo digital",
            "La orden queda correcta; la acción de cobro del remanente no existe en esta UI.",
        )
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
        price_invalid = page.get_by_role("spinbutton", name="Precio unitario").get_attribute(
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
        price_invalid = page.get_by_role("spinbutton", name="Precio unitario").get_attribute(
            "aria-invalid"
        )
        check(
            "aria-invalid marca solo el precio inválido",
            price_invalid == "true",
            f"price={price_invalid}",
        )

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
    print(f"\nP0 VENTA E2E · {passed} PASS · {failed} FAIL · {known} KNOWN")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
