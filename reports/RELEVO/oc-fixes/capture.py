#!/usr/bin/env python3
"""Smoke + capturas de las 18 rutas del carril oc-fixes.

Uso:
    python reports/RELEVO/oc-fixes/capture.py
    BASE_URL=http://localhost:3100 python reports/RELEVO/oc-fixes/capture.py

Escribe PNGs y un JSON con status/errores de consola por ruta y viewport.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent / "captures"
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")

STATIC_ROUTES = [
    ("raiz", "/"),
    ("inicio", "/inicio"),
    ("onboarding", "/onboarding"),
    ("caja", "/caja"),
    ("ayuda", "/ayuda"),
    ("ajustes", "/ajustes"),
    ("fiados", "/fiados"),
    ("fiados-nuevo", "/fiados/nuevo"),
    ("fiados-registrado", "/fiados/registrado"),
    ("corte", "/corte"),
    ("corte-historial", "/corte/historial"),
    ("metas", "/metas"),
    ("metas-nueva", "/metas/nueva"),
    ("pendientes", "/pendientes"),
    ("pendientes-nuevo", "/pendientes/nuevo"),
    ("ventas", "/ventas"),
]

VIEWPORTS = [("390x693", 390, 693), ("1448x1086", 1448, 1086)]


def first_href(page, selector: str) -> str | None:
    link = page.locator(selector).first
    try:
        if link.count() == 0:
            return None
        href = link.get_attribute("href")
        return href
    except Exception:
        return None


def discover(base_page, path: str, selector: str) -> str | None:
    try:
        base_page.goto(BASE + path, wait_until="domcontentloaded")
        base_page.wait_for_timeout(400)
        return first_href(base_page, selector)
    except Exception:
        return None


def collect_errors(page, bucket: list[str]):
    def on_console(msg):
        if msg.type == "error":
            bucket.append(msg.text[:300])

    def on_pageerror(err):
        bucket.append(f"pageerror: {str(err)[:300]}")

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)
    return on_console, on_pageerror


def shot(page, name: str) -> str:
    target = OUT / f"{name}.png"
    page.screenshot(path=str(target), full_page=True)
    return target.name


def main() -> None:
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(locale="es-MX")
        page = ctx.new_page()

        fiado_href = discover(page, "/fiados", 'a[href^="/fiados/"]:not([href$="/nuevo"])')
        venta_href = discover(page, "/ventas", 'a[href^="/ventas/"]')
        corte_href = discover(page, "/corte/historial", 'a[href^="/corte/historial/"]')

        routes = list(STATIC_ROUTES)
        if fiado_href:
            routes.append(("fiado-juan", fiado_href))
            routes.append(("fiado-abono", fiado_href.rstrip("/") + "/abono"))
        if venta_href:
            routes.append(("venta-detalle", venta_href))
        if corte_href:
            routes.append(("corte-detalle", corte_href))

        for label, path in routes:
            for vp_name, width, height in VIEWPORTS:
                errors: list[str] = []
                page.set_viewport_size({"width": width, "height": height})
                on_console, on_pageerror = collect_errors(page, errors)
                status = None
                try:
                    resp = page.goto(BASE + path, wait_until="networkidle", timeout=25000)
                    status = resp.status if resp else None
                    page.wait_for_timeout(250)
                    file_name = shot(page, f"{label}-{vp_name}")
                    results.append(
                        {
                            "route": path,
                            "label": label,
                            "viewport": vp_name,
                            "status": status,
                            "consoleErrors": errors,
                            "shot": file_name,
                        }
                    )
                except Exception as exc:  # noqa: BLE001
                    results.append(
                        {
                            "route": path,
                            "label": label,
                            "viewport": vp_name,
                            "status": status,
                            "consoleErrors": errors,
                            "error": str(exc)[:400],
                        }
                    )
                page.remove_listener("console", on_console)
                page.remove_listener("pageerror", on_pageerror)

        ctx.close()
        browser.close()

    payload = {
        "base": BASE,
        "routes": len(results),
        "failures": [
            r for r in results if (r.get("status") or 0) >= 400 or r.get("error")
        ],
        "consoleErrors": [r for r in results if r.get("consoleErrors")],
        "results": results,
    }
    (OUT / "smoke.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({k: payload[k] for k in ("base", "routes")}, indent=2))
    print(f"failures={len(payload['failures'])} consoleErrors={len(payload['consoleErrors'])}")
    for item in payload["failures"]:
        print("FAIL", item.get("route"), item.get("viewport"), item.get("status"), item.get("error"))
    for item in payload["consoleErrors"]:
        print("CONSOLE", item.get("route"), item.get("viewport"), item["consoleErrors"][:2])


if __name__ == "__main__":
    main()
