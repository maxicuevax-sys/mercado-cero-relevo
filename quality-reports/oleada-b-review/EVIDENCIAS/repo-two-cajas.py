import json
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
NEW_DRAFT = {
    "lines": [{"id": "line_audit_new", "description": "Cafe nuevo", "quantity": "2", "price": "35.50"}],
    "cashInput": "", "creditInput": "", "customerName": "", "method": "cash",
}
results = []


def check(name, ok, detail=""):
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + ((" - " + detail) if detail else ""))


with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1280, "height": 1000})
    page.goto(BASE + "/inicio", wait_until="domcontentloaded")
    page.evaluate("(d) => localStorage.setItem('mercado-cero:caja-draft:v2', JSON.stringify(d))", NEW_DRAFT)
    page.goto(BASE + "/caja", wait_until="networkidle")
    page.wait_for_timeout(300)
    check("new caja shows v2 draft", page.locator("#line-description-line_audit_new").input_value() == "Cafe nuevo")

    page.locator('aside.inicio-sidebar a[href="/fiados"]').first.click()
    page.wait_for_url("**/?tab=fiado**", timeout=15000)
    page.wait_for_timeout(500)
    check("detour reaches legacy fiado", page.locator("#fiado-heading").is_visible(), page.url)

    legacy_caja = page.locator('aside.app-sidebar button[aria-label="Caja"]')
    check("legacy sidebar exposes its own Caja", legacy_caja.count() == 1, str(legacy_caja.count()))
    legacy_caja.click()
    page.wait_for_timeout(500)
    check("legacy Caja tab does not navigate to /caja", page.url.endswith("?tab=fiado"), page.url)
    check("legacy Caja composer is visible", page.locator("#sale-text").is_visible(), "")
    check("new caja composer is not visible", not page.locator("#mc-caja-new-description").is_visible(), "")
    check("v2 draft is still stored but not shown",
          page.evaluate("localStorage.getItem('mercado-cero:caja-draft:v2')") is not None
          and not page.locator("#line-description-line_audit_new").is_visible(), "")
    page.screenshot(path=str(HERE / "repo-two-cajas.png"), full_page=True)
    b.close()

payload = {"results": results, "failed": sum(1 for r in results if not r["ok"])}
(HERE / "repo-two-cajas.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print("failed", payload["failed"])
