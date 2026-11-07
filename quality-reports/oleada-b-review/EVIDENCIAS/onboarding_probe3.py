#!/usr/bin/env python3
"""Tercera sonda: Inicio, posiciones del primer campo y Caja 390."""
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


def shot(page, name: str) -> None:
    page.screenshot(path=str(OUT / f"onboarding-{name}.png"))
    print("shot", name)


def main() -> None:
    data: dict = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1448, "height": 1086}, locale="es-MX")
        page = ctx.new_page()

        page.goto(BASE + "/inicio", wait_until="networkidle")
        page.wait_for_timeout(300)
        data["inicio1448"] = {
            "text": page.locator("#inicio-main").inner_text(),
            "headings": [h.inner_text() for h in page.locator("h1,h2,h3").all() if h.is_visible()],
            "links": [a.inner_text() for a in page.locator("a").all() if a.is_visible()],
        }
        shot(page, "inicio-1448")

        page.set_viewport_size({"width": 320, "height": 640})
        page.goto(BASE + "/inicio", wait_until="networkidle")
        page.wait_for_timeout(300)
        shot(page, "inicio-320")

        # Caja 320: posicion del primer campo y del alta.
        clean(page)
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(300)
        data["caja320"] = page.evaluate(
            """() => {
              const el = document.getElementById('mc-caja-new-description');
              const add = document.querySelector('.mc-caja-add');
              const r = el.getBoundingClientRect();
              const a = add.getBoundingClientRect();
              return {
                viewport: {w: innerWidth, h: innerHeight},
                firstFieldTop: Math.round(r.top),
                firstFieldVisible: r.top >= 0 && r.bottom <= innerHeight,
                addFormTop: Math.round(a.top),
                addFormVisible: a.top >= 0 && a.bottom <= innerHeight,
                bodyScrollHeight: document.documentElement.scrollHeight,
                scrollY: scrollY,
              };
            }"""
        )
        shot(page, "caja-320-primer-viewport")
        page.evaluate("window.scrollTo(0, document.getElementById('mc-caja-new-description').getBoundingClientRect().top + scrollY - 120)")
        page.wait_for_timeout(250)
        shot(page, "caja-320-scroll-alta")

        # Caja 390: primer viewport.
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(300)
        shot(page, "caja-390-primer-viewport")

        # Ventas 320: posicion de la primera fila.
        page.set_viewport_size({"width": 320, "height": 640})
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(300)
        data["ventas320"] = page.evaluate(
            """() => {
              const row = document.querySelector('.mc-ventas-row');
              const r = row ? row.getBoundingClientRect() : null;
              return {
                viewport: {w: innerWidth, h: innerHeight},
                firstRowTop: r ? Math.round(r.top) : null,
                firstRowVisible: r ? r.top >= 0 && r.bottom <= innerHeight : null,
                bodyScrollHeight: document.documentElement.scrollHeight,
              };
            }"""
        )

        (OUT / "onboarding-probe3.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps(data, ensure_ascii=False, indent=2)[:3000])
        browser.close()


if __name__ == "__main__":
    main()
