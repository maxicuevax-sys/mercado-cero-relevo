#!/usr/bin/env python3
"""Cuarta sonda: error de red, reintento y medida del alta en 390."""
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
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="es-MX")
        page = ctx.new_page()

        clean(page)
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(300)
        data["add390"] = page.evaluate(
            """() => {
              const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Agregar'));
              const r = btn.getBoundingClientRect();
              const nav = document.querySelector('nav');
              const nr = nav ? nav.getBoundingClientRect() : null;
              return {
                addTop: Math.round(r.top), addBottom: Math.round(r.bottom),
                navTop: nr ? Math.round(nr.top) : null,
                coveredByNav: nr ? r.bottom > nr.top : null,
                viewport: innerHeight,
                scrollHeight: document.documentElement.scrollHeight,
              };
            }"""
        )
        page.screenshot(path=str(OUT / "onboarding-caja-390-alta-oculta.png"))

        # Error de red en el POST (desplazar el alta para poder pulsar Agregar).
        page.locator(".mc-caja-add").scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        page.locator(".mc-caja-add").get_by_label("Producto o servicio").fill("Error de red")
        page.locator(".mc-caja-add").get_by_label("Precio unitario").fill("70")
        page.get_by_role("button", name="Agregar", exact=True).click()
        page.get_by_label("Efectivo recibido").fill("70")
        page.wait_for_timeout(200)

        failed = {"count": 0}

        def handler(route):
            if route.request.method == "POST" and not failed["count"]:
                failed["count"] += 1
                route.abort()
            else:
                route.continue_()

        page.route("**/api/orders", handler)
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(1200)
        data["networkError"] = {
            "main": page.locator("#caja-main").inner_text(),
            "button": page.locator(".mc-caja-confirm").inner_text(),
            "disabled": page.locator(".mc-caja-confirm").is_disabled(),
            "lines": page.locator(".mc-caja-count").inner_text(),
        }
        page.screenshot(path=str(OUT / "onboarding-caja-error-red.png"))

        # Reintento (la ruta ya deja pasar).
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(1200)
        data["retry"] = {
            "h1": page.locator("h1").inner_text(),
            "main": page.locator("#caja-main").inner_text()[:800],
        }
        page.screenshot(path=str(OUT / "onboarding-caja-reintento-resultado.png"))

        (OUT / "onboarding-probe4.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps(data, ensure_ascii=False, indent=2)[:4000])
        browser.close()


if __name__ == "__main__":
    main()
