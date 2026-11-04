#!/usr/bin/env python3
"""Segunda sonda: mixto, borrador, paginacion, ayuda y parser.

Solo lectura de producto. Crea ventas demo para observar estados.
"""
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


def text(page, selector="#caja-main, #ventas-main, #main") -> str:
    return page.locator(selector).first.inner_text()


def shot(page, name: str) -> None:
    page.screenshot(path=str(OUT / f"onboarding-{name}.png"))
    print("shot", name)


def add(page, desc: str, price: str, qty: str = "1") -> None:
    form = page.locator(".mc-caja-add")
    form.get_by_label("Producto o servicio").fill(desc)
    form.get_by_label("Cantidad").fill(qty)
    form.get_by_label("Precio unitario").fill(price)
    form.get_by_role("button", name="Agregar", exact=True).click()
    page.wait_for_timeout(180)


def main() -> None:
    result: dict = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1448, "height": 1086}, locale="es-MX")
        page = ctx.new_page()
        dialog_seen = []
        page.on("dialog", lambda d: (dialog_seen.append(d.message), d.dismiss()))

        # 1. Mixto efectivo + digital: la copy del panel de cobro.
        clean(page)
        page.goto(BASE + "/caja", wait_until="networkidle")
        add(page, "Venta mixta digital", "100")
        page.get_by_role("button", name="Mixto", exact=True).click()
        page.get_by_label("Efectivo recibido").fill("60")
        page.wait_for_timeout(200)
        pre = {
            "confirm": page.locator(".mc-caja-confirm").inner_text(),
            "confirmDisabled": page.locator(".mc-caja-confirm").is_disabled(),
            "main": text(page),
        }
        shot(page, "caja-mixto-efectivo-digital-formulario")
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(900)
        post = {
            "url": page.url,
            "h1": page.locator("h1").inner_text(),
            "main": text(page),
            "shot": "onboarding-caja-mixto-efectivo-digital-panel.png",
        }
        shot(page, "caja-mixto-efectivo-digital-panel")
        result["mixtoDigital"] = {"pre": pre, "post": post}

        # 2. Empezar otra venta desde cero (vía storage, porque la UI no ofrece salida).
        clean(page)
        page.goto(BASE + "/caja", wait_until="networkidle")
        add(page, "Venta mixta fiado", "100")
        page.get_by_role("button", name="Mixto", exact=True).click()
        page.get_by_label("Efectivo recibido").fill("60")
        page.get_by_label("Monto a fiado").fill("40")
        page.get_by_label("¿Quién queda a deber?").fill("Juan")
        page.wait_for_timeout(200)
        pre2 = {
            "confirm": page.locator(".mc-caja-confirm").inner_text(),
            "split": page.locator(".mc-caja-split").inner_text() if page.locator(".mc-caja-split").count() else None,
            "main": text(page),
        }
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(900)
        post2 = {
            "h1": page.locator("h1").inner_text(),
            "h2": page.locator("h2").first.inner_text(),
            "main": text(page),
        }
        shot(page, "caja-mixto-efectivo-fiado-resultado")
        result["mixtoFiado"] = {"pre": pre2, "post": post2}

        # 3. Borrador recuperado.
        clean(page)
        page.goto(BASE + "/caja", wait_until="networkidle")
        add(page, "Borrador", "50")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(400)
        draft = {
            "main": text(page),
            "buttons": [b.inner_text() for b in page.locator("button").all() if b.is_visible()],
            "shot": "onboarding-caja-borrador-recuperado.png",
        }
        shot(page, "caja-borrador-recuperado")
        page.get_by_role("button", name="Empezar de nuevo").click()
        page.wait_for_timeout(300)
        draft["afterDiscard"] = {
            "main": text(page)[:600],
            "dialogSeen": list(dialog_seen),
        }
        result["draft"] = draft

        # 4. Paginacion / ventas.
        page.goto(BASE + "/ventas?page=2", wait_until="networkidle")
        page.wait_for_timeout(250)
        p2 = {"url": page.url, "main": text(page)}
        shot(page, "ventas-pagina-2")
        page.goto(BASE + "/ventas?page=99", wait_until="networkidle")
        page.wait_for_timeout(250)
        p99 = {"url": page.url, "main": text(page)}
        result["pagination"] = {"page2": p2, "page99": p99}

        # 5. Ayuda desde la caja nueva.
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.locator("a", has_text="Ayuda").first.click()
        page.wait_for_timeout(900)
        help_info = {
            "url": page.url,
            "title": page.title(),
            "main": page.locator("body").inner_text()[:1200],
        }
        shot(page, "ayuda-desde-caja")
        result["help"] = help_info

        # 6. Redirecciones de modulos no migrados.
        redirects = {}
        for label in ["Fiados", "Corte", "Metas", "Pendientes"]:
            page.goto(BASE + "/caja", wait_until="networkidle")
            page.locator("a", has_text=label).first.click()
            page.wait_for_timeout(700)
            redirects[label] = {"url": page.url, "h1": page.locator("h1").first.inner_text() if page.locator("h1").count() else None}
        result["redirects"] = redirects

        # 7. Demo: simular pago del pendiente que quedó de la primera venta mixta.
        clean(page)
        page.goto(BASE + "/caja", wait_until="networkidle")
        add(page, "Demo digital", "50")
        page.get_by_role("button", name="Digital", exact=True).click()
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(800)
        page.get_by_role("button", name="Simular CoDi").click()
        page.wait_for_timeout(900)
        demo = {"h1": page.locator("h1").inner_text(), "main": text(page)}
        shot(page, "caja-resultado-demo")
        result["demo"] = demo

        # 8. Parser de dinero/cantidad, en un contexto limpio.
        parser = {}
        for name, price, qty in [
            ("mil_coma", "1,000", "1"),
            ("mil_doscientos_coma", "1,234.50", "1"),
            ("dos_coma_cinco", "2,5", "1"),
            ("medio_slash", "35", "1/2"),
            ("cantidad_1000", "1", "1000"),
        ]:
            clean(page)
            page.goto(BASE + "/caja", wait_until="networkidle")
            page.wait_for_timeout(150)
            form = page.locator(".mc-caja-add")
            form.get_by_label("Producto o servicio").fill("Prueba")
            form.get_by_label("Cantidad").fill(qty)
            form.get_by_label("Precio unitario").fill(price)
            form.get_by_role("button", name="Agregar", exact=True).click()
            page.wait_for_timeout(250)
            parser[name] = {
                "total": page.locator(".mc-caja-total").first.inner_text() if page.locator(".mc-caja-total").count() else None,
                "lines": page.locator(".mc-caja-count").inner_text(),
                "error": page.locator(".mc-caja-field-error, .mc-caja-alert").all_inner_texts(),
            }
        result["parser"] = parser

        # 9. Ventas 390 y fila visible.
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(250)
        shot(page, "ventas-390")
        result["ventas390"] = text(page)[:800]

        (OUT / "onboarding-probe2.json").write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps({k: list(v) if isinstance(v, dict) else v for k, v in result.items()}, ensure_ascii=False, indent=2)[:2000])
        browser.close()


if __name__ == "__main__":
    main()
