#!/usr/bin/env python3
"""Quinta sonda: persistencia del cambio y copy de recarga."""
from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
OUT = Path(__file__).resolve().parent
KEYS = [
    "mercado-cero:caja-draft:v2",
    "mercado-cero:caja-pending:v2",
    "mercado-cero:caja-request:v2",
]


def clean(page) -> None:
    page.goto(BASE + "/inicio", wait_until="domcontentloaded")
    page.evaluate("(keys) => keys.forEach((k) => localStorage.removeItem(k))", KEYS)


def main() -> None:
    data: dict = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1448, "height": 1086}, locale="es-MX")
        clean(page)
        page.goto(BASE + "/caja", wait_until="networkidle")
        add = page.locator(".mc-caja-add")
        add.get_by_label("Producto o servicio").fill("Venta con cambio")
        add.get_by_label("Precio unitario").fill("70")
        add.get_by_role("button", name="Agregar", exact=True).click()
        page.get_by_label("Efectivo recibido").fill("100")
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(900)
        data["beforeReload"] = {
            "h1": page.locator("h1").inner_text(),
            "main": page.locator("#caja-main").inner_text(),
        }
        page.screenshot(path=str(OUT / "onboarding-caja-cambio-antes-recarga.png"))
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(500)
        data["afterReload"] = {
            "h1": page.locator("h1").inner_text(),
            "main": page.locator("#caja-main").inner_text(),
        }
        page.screenshot(path=str(OUT / "onboarding-caja-cambio-despues-recarga.png"))
        (OUT / "onboarding-probe5.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps(data, ensure_ascii=False, indent=2)[:2500])
        browser.close()


if __name__ == "__main__":
    main()
