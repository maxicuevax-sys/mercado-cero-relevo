"""Read-only UI regression proof. Run from web/ against BASE_URL.

Uses the real text parser; microphone permission is deliberately denied.
Does not prove physical audio capture or provider transcription.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3317")
OUT = Path("../harness/evidence/exact-parity")
OUT.mkdir(parents=True, exist_ok=True)
checks = []


def check(name, condition):
    checks.append({"name": name, "pass": bool(condition)})
    assert condition, name


with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in [1448, 390, 320]:
        context = browser.new_context(viewport={"width": width, "height": 1086 if width == 1448 else 844})
        page = context.new_page()
        errors = []
        mutations = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        def block_financial(route):
            if route.request.method != "GET":
                mutations.append(route.request.url)
                route.abort()
            else:
                route.continue_()

        page.route("**/api/orders**", block_financial)
        for screen in ["ventas", "caja"]:
            page.goto(f"{BASE}/{screen}")
            page.wait_for_load_state("networkidle")
            page.locator("h1").wait_for()
            check(f"{screen}/{width}: no overflow", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
            if screen == "caja":
                mic = page.get_by_role("button", name="Dictar venta", exact=True)
                box = mic.bounding_box()
                check(f"caja/{width}: mic visible and enabled", mic.is_enabled() and box["y"] + box["height"] < 844)
                check(f"caja/{width}: mic target", box["width"] >= 48 and box["height"] >= 48)
                chips = page.locator(".mc-sale-voice__phrases button")
                positions = [round(chips.nth(i).bounding_box()["y"]) for i in range(3)]
                check(f"caja/{width}: phrases on one row", len(set(positions)) == 1)
            page.screenshot(path=str(OUT / f"{screen}-{width}.png"), full_page=True)
            page.add_style_tag(content="html { font-size: 200% !important; }")
            check(f"{screen}/{width}: text200 no overflow", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
            page.screenshot(path=str(OUT / f"{screen}-{width}-text200.png"), full_page=True)
        page.goto(f"{BASE}/caja")
        page.wait_for_load_state("networkidle")
        mic = page.get_by_role("button", name="Dictar venta", exact=True)
        mic.wait_for()
        page.evaluate("() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; }")
        mic.click()
        page.get_by_role("alert").filter(has_text="No se concedió permiso").wait_for()
        check(f"caja/{width}: denied permission leaves mic available", mic.is_enabled())
        page.get_by_role("button", name="Quesadilla", exact=True).click()
        text = page.get_by_role("textbox", name="Describe lo que vendiste")
        check(f"caja/{width}: phrase prefills and focuses", text.input_value() == "2 quesadillas de 35 pesos" and text.evaluate("el => el === document.activeElement"))
        check(f"caja/{width}: phrase does not add to ticket", page.locator(".mc-caja-count").inner_text() == "0 conceptos")
        page.get_by_role("button", name="Interpretar", exact=True).click()
        page.get_by_role("heading", name="Revisa lo que entendí").wait_for()
        check(f"caja/{width}: parser proposal requires confirmation", page.locator(".mc-caja-count").inner_text() == "0 conceptos")
        page.get_by_role("button", name="Añadir al ticket", exact=True).click()
        check(f"caja/{width}: explicit addition updates ticket", page.locator(".mc-caja-count").inner_text() == "1 concepto")
        check(f"caja/{width}: no order mutation", not mutations)
        check(f"caja/{width}: no JavaScript error", not errors)
        context.close()
    browser.close()

(OUT / "ui-checks.json").write_text(json.dumps({"base": BASE, "checks": checks, "audioE2E": "not verified"}, indent=2), encoding="utf-8")
print(f"PARITY UI: {len(checks)} PASS / 0 FAIL; real audio not verified")
