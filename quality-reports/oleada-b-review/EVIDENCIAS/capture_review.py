#!/usr/bin/env python3
"""Capturas de la revisión adversarial de Oleada B (solo evidencia)."""
from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
OUT = ROOT / "quality-reports" / "oleada-b-review" / "EVIDENCIAS" / "capturas"
OUT.mkdir(parents=True, exist_ok=True)
VIEWPORTS = [
    ("1448x1086", 1448, 1086),
    ("1366x768", 1366, 768),
    ("1280x800", 1280, 800),
    ("768x1024", 768, 1024),
    ("390x844", 390, 844),
    ("320x640", 320, 640),
]
counter = {"n": 0}


def reset(page):
    counter["n"] += 1
    page.request.post(
        BASE + "/api/demo/reset",
        headers={"x-forwarded-for": f"198.51.100.{counter['n'] % 180 + 40}"},
    )
    page.goto(BASE + "/inicio", wait_until="domcontentloaded")
    page.evaluate(
        "localStorage.removeItem('mercado-cero:caja-draft:v2');"
        "localStorage.removeItem('mercado-cero:caja-pending:v2');"
        "localStorage.removeItem('mercado-cero:caja-request:v2')"
    )


def add(page, description, quantity, price):
    add_form = page.locator(".mc-caja-add")
    add_form.get_by_label("Producto o servicio").fill(description)
    add_form.get_by_label("Cantidad").fill(quantity)
    add_form.get_by_label("Precio unitario").fill(price)
    add_form.get_by_role("button", name="Agregar", exact=True).click()
    page.wait_for_timeout(120)


def shot(page, name):
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=False)


def main():
    manifest = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for label, width, height in VIEWPORTS:
            page = browser.new_page(viewport={"width": width, "height": height}, locale="es-MX")
            page.set_default_timeout(20_000)
            reset(page)
            page.set_viewport_size({"width": width, "height": height})
            page.goto(BASE + "/inicio", wait_until="networkidle")
            page.wait_for_timeout(300)
            shot(page, f"inicio-{label}")
            manifest.append(f"inicio-{label}.png")

            reset(page)
            page.set_viewport_size({"width": width, "height": height})
            page.goto(BASE + "/caja", wait_until="networkidle")
            page.wait_for_timeout(300)
            shot(page, f"caja-vacia-{label}")
            manifest.append(f"caja-vacia-{label}.png")

            add(page, "Quesadilla", "2", "35")
            add(page, "Agua de horchata", "1", "20")
            page.get_by_label("Efectivo recibido").fill("100")
            page.wait_for_timeout(200)
            shot(page, f"caja-conceptos-{label}")
            manifest.append(f"caja-conceptos-{label}.png")

            page.get_by_role("button", name="Digital", exact=True).click()
            page.wait_for_timeout(200)
            shot(page, f"caja-metodo-digital-{label}")
            manifest.append(f"caja-metodo-digital-{label}.png")

            reset(page)
            page.set_viewport_size({"width": width, "height": height})
            page.goto(BASE + "/caja", wait_until="networkidle")
            page.wait_for_timeout(300)
            add(page, "Quesadilla", "2", "35")
            page.get_by_label("Efectivo recibido").fill("100")
            page.locator(".mc-caja-confirm").click()
            page.wait_for_timeout(700)
            shot(page, f"caja-efectivo-resultado-{label}")
            manifest.append(f"caja-efectivo-resultado-{label}.png")

            reset(page)
            page.set_viewport_size({"width": width, "height": height})
            page.goto(BASE + "/caja", wait_until="networkidle")
            page.wait_for_timeout(300)
            add(page, "Cobro digital", "1", "50")
            page.get_by_role("button", name="Digital", exact=True).click()
            page.locator(".mc-caja-confirm").click()
            page.wait_for_timeout(600)
            page.get_by_role("button", name="Generar link").click()
            page.wait_for_timeout(700)
            shot(page, f"caja-digital-pendiente-{label}")
            manifest.append(f"caja-digital-pendiente-{label}.png")

            reset(page)
            page.set_viewport_size({"width": width, "height": height})
            page.goto(BASE + "/caja", wait_until="networkidle")
            page.wait_for_timeout(300)
            add(page, "Pedido fiado", "1", "100")
            page.get_by_role("button", name="Fiado", exact=True).click()
            page.get_by_label("¿Quién queda a deber?").fill("Cliente B")
            page.locator(".mc-caja-confirm").click()
            page.wait_for_timeout(700)
            shot(page, f"caja-fiado-resultado-{label}")
            manifest.append(f"caja-fiado-resultado-{label}.png")

            page.goto(BASE + "/ventas", wait_until="networkidle")
            page.wait_for_timeout(300)
            shot(page, f"ventas-{label}")
            manifest.append(f"ventas-{label}.png")

            page.close()

        # 200% de texto en Caja con conceptos.
        for label, width, height in [("390x844", 390, 844), ("320x640", 320, 640)]:
            page = browser.new_page(viewport={"width": width, "height": height}, locale="es-MX")
            reset(page)
            page.goto(BASE + "/caja", wait_until="networkidle")
            page.wait_for_timeout(300)
            add(page, "Quesadilla", "2", "35")
            add(page, "Agua", "1", "20")
            page.get_by_label("Efectivo recibido").fill("100")
            page.evaluate("document.documentElement.style.fontSize='32px'")
            page.wait_for_timeout(300)
            shot(page, f"caja-conceptos-200-{label}")
            manifest.append(f"caja-conceptos-200-{label}.png")
            page.close()
        browser.close()
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(manifest)} capturas en {OUT}")


if __name__ == "__main__":
    main()
