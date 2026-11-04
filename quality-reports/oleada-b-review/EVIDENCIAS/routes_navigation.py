#!/usr/bin/env python3
"""Rutas, navegación y continuidad para la revisión de Oleada B."""
from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
OUT = Path(__file__).resolve().parent


def main():
    result = {"routes": [], "navigation": [], "errors": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1366, "height": 768}, locale="es-MX")
        page = ctx.new_page()
        page.set_default_timeout(20_000)
        page.on("pageerror", lambda exc: result["errors"].append(str(exc)))
        page.request.post(BASE + "/api/demo/reset")

        for path in ["/inicio", "/caja", "/ventas", "/", "/?tab=caja", "/?tab=fiado", "/?tab=corte", "/?tab=meta", "/?tab=pendientes"]:
            response = page.goto(BASE + path, wait_until="domcontentloaded")
            page.wait_for_timeout(250)
            result["routes"].append({
                "path": path,
                "status": response.status if response else None,
                "url": page.url,
                "h1": page.locator("h1").first.inner_text() if page.locator("h1").count() else None,
                "shellNew": page.locator(".inicio-shell").count(),
                "shellLegacy": page.locator(".app-shell").count(),
            })

        for path, target in [("/fiados", "tab=fiado"), ("/corte", "tab=corte"), ("/metas", "tab=meta"), ("/pendientes", "tab=pendientes")]:
            raw = page.request.get(BASE + path + "?ayuda=1", max_redirects=0)
            location = raw.headers.get("location", "")
            result["navigation"].append({"alias": path, "status": raw.status, "location": location, "expected": target})

        # Back/forward y recarga.
        page.goto(BASE + "/inicio", wait_until="networkidle")
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.go_back(wait_until="networkidle")
        page.wait_for_timeout(300)
        result["navigation"].append({"case": "back_caja", "url": page.url, "h1": page.locator("h1").first.inner_text()})
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(300)
        result["navigation"].append({"case": "reload_caja", "url": page.url, "h1": page.locator("h1").first.inner_text()})

        # Borrador sobrevive a navegar a Ventas y volver.
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(250)
        add = page.locator(".mc-caja-add")
        add.get_by_label("Producto o servicio").fill("Borrador nav")
        add.get_by_label("Cantidad").fill("1")
        add.get_by_label("Precio unitario").fill("25")
        add.get_by_role("button", name="Agregar", exact=True).click()
        page.wait_for_timeout(300)
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(500)
        result["navigation"].append({
            "case": "draft_after_navigation",
            "restoreBanner": page.locator(".mc-caja-restore").count(),
            "lines": page.locator(".mc-caja-line").count(),
            "total": page.locator(".mc-caja-total").inner_text(),
        })

        # Navegación de Caja a Fiados: documenta si sale del shell nuevo.
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.locator(".inicio-nav a[href='/fiados']").click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)
        result["navigation"].append({
            "case": "caja_to_fiados",
            "url": page.url,
            "h1": page.locator("h1").first.inner_text() if page.locator("h1").count() else None,
            "shellNew": page.locator(".inicio-shell").count(),
            "shellLegacy": page.locator(".app-shell").count(),
        })

        # Pago público: usa un pedido pendiente del seed y verifica que no tenga shell.
        pending = page.request.get(BASE + "/api/orders").json()["orders"]
        pending = [o for o in pending if o["status"] in {"payment_pending", "confirmed"}]
        if pending:
            order_id = pending[0]["id"]
            response = page.goto(BASE + f"/pay/{order_id}", wait_until="domcontentloaded")
            page.wait_for_timeout(400)
            result["navigation"].append({
                "case": "public_pay",
                "status": response.status if response else None,
                "shellNew": page.locator(".inicio-shell").count(),
                "title": page.locator("h1").first.inner_text() if page.locator("h1").count() else None,
            })
        browser.close()
    (OUT / "routes-navigation.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
