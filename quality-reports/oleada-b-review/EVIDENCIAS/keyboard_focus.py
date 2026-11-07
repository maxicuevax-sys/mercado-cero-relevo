#!/usr/bin/env python3
"""Teclado, foco y landmarks para la revisión de Oleada B."""
from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
OUT = Path(__file__).resolve().parent


def visible(page, selector: str) -> int:
    return page.evaluate(
        """(sel) => [...document.querySelectorAll(sel)].filter((e) => {
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
        }).length""",
        selector,
    )


def main():
    result = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844}, locale="es-MX")
        page.request.post(BASE + "/api/demo/reset")
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(300)
        page.keyboard.press("Tab")
        result["skip_first"] = page.evaluate("document.activeElement?.innerText")
        page.keyboard.press("Enter")
        result["skip_target"] = page.evaluate("document.activeElement?.id")
        result["landmarks_caja"] = {
            "main": visible(page, "main"),
            "skip": visible(page, ".inicio-skip"),
            "nav": visible(page, "nav"),
            "current": visible(page, "[aria-current='page']"),
        }
        # Añadir un renglón y borrarlo: el foco no debe caer en body.
        add = page.locator(".mc-caja-add")
        add.get_by_label("Producto o servicio").fill("Foco revisión")
        add.get_by_label("Cantidad").fill("1")
        add.get_by_label("Precio unitario").fill("50")
        add.get_by_role("button", name="Agregar", exact=True).click()
        page.wait_for_timeout(250)
        result["focus_after_add"] = page.evaluate(
            "({tag:document.activeElement?.tagName,id:document.activeElement?.id})"
        )
        page.locator(".mc-caja-line").first.get_by_role("button", name="Quitar Foco revisión").click()
        page.wait_for_timeout(250)
        result["focus_after_remove"] = page.evaluate(
            "({tag:document.activeElement?.tagName,id:document.activeElement?.id})"
        )
        # Cobro efectivo y foco del resultado.
        add.get_by_label("Producto o servicio").fill("Resultado foco")
        add.get_by_label("Cantidad").fill("1")
        add.get_by_label("Precio unitario").fill("30")
        add.get_by_role("button", name="Agregar", exact=True).click()
        page.wait_for_timeout(200)
        page.get_by_label("Efectivo recibido").fill("30")
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(700)
        result["focus_after_result"] = page.evaluate(
            "({tag:document.activeElement?.tagName,id:document.activeElement?.id,text:document.activeElement?.innerText?.slice(0,40)})"
        )
        # Ventas: pager y detalles.
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(300)
        result["landmarks_ventas"] = {
            "main": visible(page, "main"),
            "skip": visible(page, ".inicio-skip"),
            "nav": visible(page, "nav"),
            "current": visible(page, "[aria-current='page']"),
        }
        result["pager"] = page.locator(".mc-ventas-pager a, .mc-ventas-pager span").all_inner_texts()
        if page.locator(".mc-ventas-row summary").count():
            page.locator(".mc-ventas-row summary").first.click()
            result["details_open"] = page.locator(".mc-ventas-row__details li").count()
        # Foco bajo paybar: método Mixto a 390.
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(250)
        add = page.locator(".mc-caja-add")
        add.get_by_label("Producto o servicio").fill("Paybar foco")
        add.get_by_label("Cantidad").fill("1")
        add.get_by_label("Precio unitario").fill("50")
        add.get_by_role("button", name="Agregar", exact=True).click()
        page.wait_for_timeout(250)
        page.get_by_role("button", name="Mixto", exact=True).focus()
        page.wait_for_timeout(300)
        result["paybar_focus"] = page.evaluate(
            """() => { const r=document.activeElement.getBoundingClientRect(); const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return {top:r.top,bottom:r.bottom,hit:hit?.className||hit?.tagName,paybar:document.querySelector('.mc-caja-paybar')?.getBoundingClientRect().top}; }"""
        )
        browser.close()
    (OUT / "keyboard-focus.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
