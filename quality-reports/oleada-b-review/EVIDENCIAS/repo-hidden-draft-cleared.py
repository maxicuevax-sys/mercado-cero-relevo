import json
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
orders = json.load(urllib.request.urlopen(BASE + "/api/orders?limit=50"))["orders"]
paid = next(o for o in orders if o["status"] == "paid")
draft = {"lines": [{"id": "line_hidden", "description": "Cafe oculto", "quantity": "1", "price": "25"}],
         "cashInput": "", "creditInput": "", "customerName": "", "method": "cash"}
results = []


def check(name, ok, detail=""):
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + ((" - " + detail) if detail else ""))


with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1280, "height": 1000})
    page.goto(BASE + "/inicio", wait_until="domcontentloaded")
    page.evaluate(
        """([d, id]) => {
            localStorage.setItem('mercado-cero:caja-draft:v2', JSON.stringify(d));
            localStorage.setItem('mercado-cero:caja-pending:v2', JSON.stringify({orderIds: [id]}));
        }""",
        [draft, paid["id"]],
    )
    page.goto(BASE + "/caja", wait_until="networkidle")
    page.wait_for_timeout(800)
    check("restored result view hides the draft", page.locator("#mc-caja-result-title").is_visible()
          and not page.locator("#line-description-line_hidden").is_visible(), "")
    page.get_by_role("button", name="Nueva venta", exact=True).click()
    page.wait_for_timeout(500)
    stored = page.evaluate("localStorage.getItem('mercado-cero:caja-draft:v2')")
    check("Nueva venta silently clears hidden draft", stored is None, str(stored))
    check("composer is empty", page.locator(".mc-caja-line").count() == 0, "")
    page.screenshot(path=str(HERE / "repo-hidden-draft-cleared.png"), full_page=True)
    b.close()

payload = {"paidOrder": paid["id"], "results": results, "failed": sum(1 for r in results if not r["ok"])}
(HERE / "repo-hidden-draft-cleared.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print("failed", payload["failed"])
