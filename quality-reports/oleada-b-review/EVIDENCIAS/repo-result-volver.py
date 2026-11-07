import json
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
orders = json.load(urllib.request.urlopen(BASE + "/api/orders?limit=50"))["orders"]
paid = next((o for o in orders if o["status"] == "paid"), None)
assert paid, "no paid order available for read-only test"
print("using paid order", paid["id"])

results = []


def check(name, ok, detail=""):
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + ((" - " + detail) if detail else ""))


with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1280, "height": 1000})
    page.goto(BASE + "/inicio", wait_until="domcontentloaded")
    page.evaluate(
        """(id) => {
            localStorage.setItem('mercado-cero:caja-pending:v2', JSON.stringify({orderIds: [id]}));
            localStorage.removeItem('mercado-cero:caja-draft:v2');
        }""",
        paid["id"],
    )
    page.goto(BASE + "/caja", wait_until="networkidle")
    page.wait_for_timeout(800)
    check("restores a result view from pending id", page.locator("#mc-caja-result-title").is_visible(),
          page.locator("#mc-caja-result-title").inner_text() if page.locator("#mc-caja-result-title").count() else "missing")
    page.locator('a.mc-caja-button--quiet[href="/caja"]').click()
    page.wait_for_timeout(800)
    check("URL stays /caja", page.url.rstrip("/").endswith("/caja"), page.url)
    check("Volver a Caja resets to composer", page.locator("#mc-caja-new-description").is_visible(),
          f"new composer={page.locator('#mc-caja-new-description').is_visible()} result={page.locator('#mc-caja-result-title').is_visible()}")
    page.screenshot(path=str(HERE / "repo-result-volver.png"), full_page=True)
    b.close()

payload = {"orderId": paid["id"], "results": results, "failed": sum(1 for r in results if not r["ok"])}
(HERE / "repo-result-volver.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print("failed", payload["failed"])
