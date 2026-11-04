import json
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
CASES = {
    "missing_fields": {"lines": [{"id": "bad"}]},
    "lines_not_objects": {"lines": ["bad"]},
    "invalid_method": {"lines": [{"id": "ok", "description": "Cafe", "quantity": "1", "price": "10"}], "method": "bitcoin"},
}
results = []

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for name, draft in CASES.items():
        page = b.new_page(viewport={"width": 390, "height": 844})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/inicio", wait_until="domcontentloaded")
        page.evaluate("(d) => localStorage.setItem('mercado-cero:caja-draft:v2', JSON.stringify(d))", draft)
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(600)
        rendered = page.locator("#caja-title").is_visible()
        new_desc = page.locator("#mc-caja-new-description").is_visible()
        body = page.locator("body").inner_text()[:120].replace("\n", " | ")
        row = {
            "case": name,
            "renderedTitle": rendered,
            "composerVisible": new_desc,
            "pageErrors": errors,
            "bodyStart": body,
        }
        results.append(row)
        print(json.dumps(row, ensure_ascii=False))
        page.screenshot(path=str(HERE / f"repo-bad-draft-{name}.png"), full_page=True)
        page.close()
    b.close()

(HERE / "repo-bad-draft.json").write_text(json.dumps({"results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
