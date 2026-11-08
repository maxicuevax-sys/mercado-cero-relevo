#!/usr/bin/env python3
"""Capturas y smoke de /movimientos (carril CODI-MOVEMENTS).

Uso:
    BASE_URL=http://127.0.0.1:3105 python reports/RELEVO/codi-movements/capture.py

Las rutas de detalle se resuelven desde la base demo/staged del servidor de
evidencia; si un id no existe, la captura se marca como fallo sin inventar
datos. Escribe PNGs + captures/smoke.json.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE / "captures"
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3105").rstrip("/")

VIEWPORTS = [("390x693", 390, 693), ("1448x1086", 1448, 1086)]

ROUTES = [
    ("listado-todos", "/movimientos"),
    ("listado-pendientes", "/movimientos?filtro=pendientes"),
    ("listado-pagados", "/movimientos?filtro=pagados"),
    ("detalle-creada", "/movimientos/ord_5c3c119cd1e946a99903"),
    ("detalle-link", "/movimientos/demo_hist_pending_ord_44e3a29878b047a2a846"),
    ("detalle-qr", "/movimientos/ord_f9feec5678a1400e9a86"),
    ("detalle-vencida", "/movimientos/ord_24020334a41d407ba901"),
    ("detalle-demo", "/movimientos/demo_hist_4_ord_6a9091556aeb4dfdb768"),
    ("detalle-cancelada", "/movimientos/ord_7eb5247aaba6484b8ff1"),
]

# Capturas adicionales desplazadas al bloque que importa (QR, dinero, filas).
SCROLL_ROUTES = [
    ("listado-todos-390-scroll", "/movimientos", "390x693", 390, 693, ".mc-mov-list__title"),
    ("listado-pagados-1448-scroll", "/movimientos?filtro=pagados", "1448x1086", 1448, 1086, ".mc-mov-items"),
    ("detalle-qr-390-scroll", "/movimientos/ord_f9feec5678a1400e9a86", "390x693", 390, 693, ".mc-mvd-qr"),
    ("detalle-qr-1448-scroll", "/movimientos/ord_f9feec5678a1400e9a86", "1448x1086", 1448, 1086, ".mc-mvd-qr"),
    ("detalle-vencida-390-scroll", "/movimientos/ord_24020334a41d407ba901", "390x693", 390, 693, ".mc-mvd-qr"),
    ("detalle-demo-390-scroll", "/movimientos/demo_hist_4_ord_6a9091556aeb4dfdb768", "390x693", 390, 693, ".mc-mvd-card--money"),
    ("detalle-demo-1448-scroll", "/movimientos/demo_hist_4_ord_6a9091556aeb4dfdb768", "1448x1086", 1448, 1086, ".mc-mvd-card--money"),
]


def shot(page, name: str) -> str:
    target = OUT / f"{name}.png"
    page.screenshot(path=str(target), full_page=False)
    return target.name


def main() -> None:
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(locale="es-MX")
        page = ctx.new_page()

        for label, path in ROUTES:
            for vp_name, width, height in VIEWPORTS:
                errors: list[str] = []
                page.set_viewport_size({"width": width, "height": height})

                def on_console(msg, bucket=errors):
                    if msg.type == "error":
                        bucket.append(msg.text[:300])

                def on_pageerror(err, bucket=errors):
                    bucket.append(f"pageerror: {str(err)[:300]}")

                page.on("console", on_console)
                page.on("pageerror", on_pageerror)
                status = None
                try:
                    resp = page.goto(BASE + path, wait_until="networkidle", timeout=30000)
                    status = resp.status if resp else None
                    page.wait_for_timeout(300)
                    page.evaluate(
                        "document.activeElement && document.activeElement.blur()"
                    )
                    page.wait_for_timeout(80)
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

        for label, path, vp_name, width, height, selector in SCROLL_ROUTES:
            errors = []
            page.set_viewport_size({"width": width, "height": height})

            def on_console(msg, bucket=errors):
                if msg.type == "error":
                    bucket.append(msg.text[:300])

            def on_pageerror(err, bucket=errors):
                bucket.append(f"pageerror: {str(err)[:300]}")

            page.on("console", on_console)
            page.on("pageerror", on_pageerror)
            status = None
            try:
                resp = page.goto(BASE + path, wait_until="networkidle", timeout=30000)
                status = resp.status if resp else None
                page.locator(selector).first.scroll_into_view_if_needed()
                page.wait_for_timeout(300)
                page.evaluate(
                    "document.activeElement && document.activeElement.blur()"
                )
                page.wait_for_timeout(80)
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
        "captures": len(results),
        "failures": [
            r for r in results if r.get("status") not in (200, 404) or r.get("error")
        ],
        "consoleErrors": [r for r in results if r.get("consoleErrors")],
        "results": results,
    }
    (OUT / "smoke.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({k: payload[k] for k in ("base", "captures")}, indent=2))
    print(
        f"failures={len(payload['failures'])} "
        f"consoleErrors={len(payload['consoleErrors'])}"
    )
    for item in payload["failures"]:
        print(
            "FAIL",
            item.get("route"),
            item.get("viewport"),
            item.get("status"),
            item.get("error"),
        )
    for item in payload["consoleErrors"]:
        print(
            "CONSOLE",
            item.get("route"),
            item.get("viewport"),
            item["consoleErrors"][:2],
        )


if __name__ == "__main__":
    main()
