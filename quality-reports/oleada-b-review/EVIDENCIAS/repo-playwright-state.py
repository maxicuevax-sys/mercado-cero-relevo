#!/usr/bin/env python3
"""Read-only route + client-state audit for Oleada B.

Does not POST orders and does not reset the demo database. It only:
- opens existing pages,
- writes browser localStorage drafts (client-only),
- inspects rendered DOM/nav.

Outputs repo-playwright-state.json and screenshots in this folder.
"""
from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
OUT = HERE / "repo-playwright-state.json"
SHOTS = HERE

NEW_DRAFT = {
    "lines": [
        {
            "id": "line_audit_new",
            "description": "Cafe nuevo",
            "quantity": "2",
            "price": "35.50",
        }
    ],
    "cashInput": "",
    "creditInput": "",
    "customerName": "",
    "method": "cash",
}
LEGACY_DRAFT = {
    "version": 1,
    "items": [
        {
            "id": "draft_audit_legacy",
            "description": "Quesadilla legacy",
            "quantity": 1,
            "unitPriceCents": 4500,
        }
    ],
    "cashCents": 0,
    "creditCents": 0,
    "customerName": "",
    "textInput": "",
    "transcript": "",
    "updatedAt": "2026-11-04T10:00:00.000Z",
}

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + ((" - " + detail) if detail else ""))


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 1000}, locale="es-MX")
        page = ctx.new_page()
        page.set_default_timeout(15_000)
        page_errors: list[str] = []
        console_errors: list[str] = []
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))
        page.on(
            "console",
            lambda msg: console_errors.append(msg.text) if msg.type == "error" else None,
        )

        # Seed both independent drafts from the client side.
        page.goto(BASE + "/inicio", wait_until="domcontentloaded")
        page.evaluate(
            """([newDraft, legacyDraft]) => {
                localStorage.setItem('mercado-cero:caja-draft:v2', JSON.stringify(newDraft));
                localStorage.setItem('mercado-cero:draft:v1', JSON.stringify(legacyDraft));
            }""",
            [NEW_DRAFT, LEGACY_DRAFT],
        )

        # --- /caja renders and restores only v2 draft ---
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(300)
        new_desc = page.locator("#line-description-line_audit_new")
        check("/caja title", page.locator("#caja-title").inner_text().strip() == "Nueva venta",
              page.locator("#caja-title").inner_text().strip())
        check("/caja restores v2 draft", new_desc.count() == 1 and new_desc.input_value() == "Cafe nuevo",
              new_desc.input_value() if new_desc.count() else "missing")
        check("/caja total from v2 draft", "71.00" in page.locator(".mc-caja-total").inner_text(),
              page.locator(".mc-caja-total").inner_text())
        check("/caja does not render legacy v1 item",
              page.evaluate("""() => [...document.querySelectorAll('input')].every((i) => i.value !== 'Quesadilla legacy')"""), "")
        nav = {
            label: page.locator("aside.inicio-sidebar nav a", has_text=label).first.get_attribute("href")
            for label in ["Inicio", "Caja", "Ventas", "Fiados", "Corte", "Metas", "Pendientes"]
        }
        check("sidebar Caja -> /caja", nav.get("Caja") == "/caja", str(nav))
        check("sidebar Ventas -> /ventas", nav.get("Ventas") == "/ventas", str(nav))
        check("sidebar Fiados -> /fiados", nav.get("Fiados") == "/fiados", str(nav))
        check("active Caja has aria-current",
              page.locator('aside.inicio-sidebar nav a[aria-current="page"]').first.get_attribute("href") == "/caja",
              "")
        page.screenshot(path=str(SHOTS / "repo-caja-desktop.png"), full_page=True)

        # --- legacy root restores only v1 draft ---
        page.goto(BASE + "/", wait_until="networkidle")
        page.wait_for_timeout(300)
        legacy_desc = page.locator("#draft-description-draft_audit_legacy")
        check("/ renders legacy composer", page.locator("#sale-text").count() == 1, "")
        check("/ restores v1 draft", legacy_desc.count() == 1 and legacy_desc.input_value() == "Quesadilla legacy",
              legacy_desc.input_value() if legacy_desc.count() else "missing")
        check("/ does not render v2 item",
              page.evaluate("""() => [...document.querySelectorAll('input')].every((i) => i.value !== 'Cafe nuevo')"""), "")
        page.screenshot(path=str(SHOTS / "repo-root-legacy-desktop.png"), full_page=True)

        # Both keys survive side by side.
        keys = page.evaluate(
            """() => ({
                v2: localStorage.getItem('mercado-cero:caja-draft:v2'),
                v1: localStorage.getItem('mercado-cero:draft:v1'),
                req2: localStorage.getItem('mercado-cero:caja-request:v2'),
                req1: localStorage.getItem('mercado-cero:sale-request:v1'),
            })"""
        )
        check("two draft keys coexist", bool(keys["v1"]) and bool(keys["v2"]), "")

        # --- /ventas is history-only, no payment recovery action ---
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("/ventas title", page.locator("#ventas-title").inner_text().strip() == "Ventas",
              page.locator("#ventas-title").inner_text().strip())
        check("/ventas has Nueva venta -> /caja",
              page.locator('a.mc-ventas-new').get_attribute("href") == "/caja", "")
        body_text = page.locator("main").inner_text()
        action_texts = page.evaluate(
            """() => [...document.querySelectorAll('main button, main a')]
                .map((el) => (el.textContent || '').trim())
                .filter((t) => /cobrar|pagar|generar link|generar qr|actualizar estado/i.test(t))"""
        )
        check("/ventas exposes no cobro action", len(action_texts) == 0, str(action_texts))
        check("/ventas mentions pendientes/por cobrar", "por cobrar" in body_text.lower() or "pendiente" in body_text.lower(), "")
        page.screenshot(path=str(SHOTS / "repo-ventas-desktop.png"), full_page=True)

        # --- cross-shell nav: /fiados leaves new shell for legacy tab ---
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.locator("aside.inicio-sidebar nav a", has_text="Fiados").first.click()
        page.wait_for_url("**/?tab=fiado**", timeout=15_000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(300)
        check("/fiados final URL is legacy tab", "tab=fiado" in page.url, page.url)
        check("/fiados renders legacy heading", page.locator("#fiado-heading").is_visible(), "")
        check("/fiados replaces new sidebar",
              not page.locator("aside.inicio-sidebar").is_visible(), "")
        check("/fiados new caja composer is not visible",
              not page.locator("#mc-caja-new-description").is_visible(), "")
        check("v2 draft survives legacy detour",
              page.evaluate("localStorage.getItem('mercado-cero:caja-draft:v2')") is not None, "")
        page.screenshot(path=str(SHOTS / "repo-fiados-legacy.png"), full_page=True)

        # --- /?tab=ventas silently falls back to legacy caja ---
        page.goto(BASE + "/?tab=ventas", wait_until="networkidle")
        page.wait_for_timeout(300)
        check("/?tab=ventas falls back to legacy caja",
              page.locator("#sale-text").count() == 1 and "tab=ventas" in page.url, page.url)

        # --- mobile nav still exposes Caja/Ventas ---
        mobile = ctx.new_page()
        mobile.set_viewport_size({"width": 390, "height": 844})
        mobile.goto(BASE + "/caja", wait_until="networkidle")
        mobile.wait_for_timeout(300)
        check("mobile nav has Caja and Ventas",
              mobile.locator("nav.mc-mobile-nav a", has_text="Caja").count() == 1
              and mobile.locator("nav.mc-mobile-nav a", has_text="Ventas").count() == 1, "")
        mobile.screenshot(path=str(SHOTS / "repo-caja-mobile.png"), full_page=True)

        check("no pageerror on audited routes", len(page_errors) == 0, " | ".join(page_errors[:3]))
        check("no console errors on audited routes", len(console_errors) == 0, " | ".join(console_errors[:3]))

        browser.close()

    payload = {
        "base": BASE,
        "results": results,
        "passed": sum(1 for r in results if r["ok"]),
        "failed": sum(1 for r in results if not r["ok"]),
        "pageErrors": page_errors,
        "consoleErrors": console_errors,
        "storageSeen": {
            "v1": bool(keys.get("v1")),
            "v2": bool(keys.get("v2")),
        },
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{payload['passed']} passed, {payload['failed']} failed -> {OUT}")
    return 0 if payload["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
