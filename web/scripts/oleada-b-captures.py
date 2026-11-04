#!/usr/bin/env python3
"""Capturas deterministas de Oleada B (Caja y Ventas)."""
from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
OUT = Path(os.environ.get("OLEADA_B_OUT", ROOT / "quality-reports" / "oleada-b" / "capturas"))
OUT.mkdir(parents=True, exist_ok=True)


def clear(page: "Page") -> None:
    page.goto(BASE + "/inicio", wait_until="domcontentloaded")
    page.evaluate(
        "localStorage.removeItem('mercado-cero:caja-draft:v2');"
        "localStorage.removeItem('mercado-cero:caja-pending:v2');"
        "localStorage.removeItem('mercado-cero:caja-request:v2')"
    )


def reset(page: "Page") -> None:
    page.request.post(BASE + "/api/demo/reset")
    clear(page)
    page.goto(BASE + "/caja", wait_until="networkidle")
    page.wait_for_timeout(350)


def add(page: "Page", description: str, quantity: str, price: str) -> None:
    add_form = page.locator(".mc-caja-add")
    add_form.get_by_label("Producto o servicio").fill(description)
    add_form.get_by_label("Cantidad").fill(quantity)
    add_form.get_by_label("Precio unitario").fill(price)
    add_form.get_by_role("button", name="Agregar", exact=True).click()
    page.wait_for_timeout(120)


def shot(page: "Page", name: str) -> None:
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
    print(name)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1448, "height": 1086}, locale="es-MX")

        # Vacía en los cuatro viewports.
        for name, width, height in [
            ("1448x1086", 1448, 1086),
            ("1366x768", 1366, 768),
            ("390x844", 390, 844),
            ("320x640", 320, 640),
        ]:
            reset(page)
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(250)
            shot(page, f"caja-vacia-{name}")

        # Venta en curso y método de pago.
        reset(page)
        add(page, "Quesadilla", "2", "35")
        add(page, "Agua de horchata", "1", "20")
        page.get_by_label("Efectivo recibido").fill("100")
        for name, width, height in [
            ("1448x1086", 1448, 1086),
            ("1366x768", 1366, 768),
            ("390x844", 390, 844),
            ("320x640", 320, 640),
        ]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(250)
            shot(page, f"caja-venta-en-curso-{name}")

        page.set_viewport_size({"width": 1448, "height": 1086})
        page.get_by_role("button", name="Digital", exact=True).click()
        page.wait_for_timeout(200)
        shot(page, "caja-metodo-digital-1448x1086")
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(200)
        shot(page, "caja-metodo-digital-390x844")

        # Resultado en efectivo.
        reset(page)
        add(page, "Quesadilla", "2", "35")
        page.get_by_label("Efectivo recibido").fill("100")
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(700)
        for name, width, height in [("1448x1086", 1448, 1086), ("390x844", 390, 844)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(200)
            shot(page, f"caja-efectivo-resultado-{name}")

        # Fiado.
        reset(page)
        add(page, "Pedido fiado", "1", "100")
        page.get_by_role("button", name="Fiado", exact=True).click()
        page.get_by_label("¿Quién queda a deber?").fill("Cliente B")
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(700)
        shot(page, "caja-fiado-resultado-1448x1086")
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(200)
        shot(page, "caja-fiado-resultado-390x844")

        # Digital pendiente.
        reset(page)
        add(page, "Cobro digital", "1", "50")
        page.get_by_role("button", name="Digital", exact=True).click()
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(600)
        page.get_by_role("button", name="Generar link").click()
        page.wait_for_timeout(700)
        for name, width, height in [("1448x1086", 1448, 1086), ("390x844", 390, 844)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(200)
            shot(page, f"caja-digital-pendiente-{name}")

        # Historial con ventas deterministas.
        reset(page)
        add(page, "Venta efectivo", "1", "80")
        page.get_by_label("Efectivo recibido").fill("80")
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(600)
        page.get_by_role("button", name="Nueva venta").click()
        add(page, "Venta fiado", "1", "120")
        page.get_by_role("button", name="Fiado", exact=True).click()
        page.get_by_label("¿Quién queda a deber?").fill("Cliente C")
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(600)
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(400)
        for name, width, height in [
            ("1448x1086", 1448, 1086),
            ("1366x768", 1366, 768),
            ("390x844", 390, 844),
            ("320x640", 320, 640),
        ]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(250)
            shot(page, f"ventas-{name}")

        browser.close()


if __name__ == "__main__":
    main()
