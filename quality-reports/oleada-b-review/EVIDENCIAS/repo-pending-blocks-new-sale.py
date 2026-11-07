import json
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
orders = json.load(urllib.request.urlopen(BASE + "/api/orders?limit=100"))["orders"]
pending = next(o for o in orders if o["status"] == "payment_pending" and (o["totalCents"] - o["paidCents"] - o["creditCents"]) > 0)
print("pending", pending["id"])

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
        pending["id"],
    )
    page.goto(BASE + "/caja", wait_until="networkidle")
    page.wait_for_timeout(700)
    check("pending order auto-opens payment view", page.locator("#mc-caja-payment-title").is_visible(), "")
    actions = page.evaluate("""() => [...document.querySelectorAll('main button, main a')].map(e => (e.textContent||'').trim()).filter(Boolean)""")
    print("payment actions", actions)
    check("payment view has no Nueva venta action", not any("Nueva venta" in a for a in actions), str(actions))
    check("payment view has no Descartar action", not any("Descartar" in a for a in actions), str(actions))

    page.locator('a.mc-caja-clear[href="/ventas"]').click()
    page.wait_for_url("**/ventas", timeout=15000)
    page.wait_for_timeout(400)
    page.locator("a.mc-ventas-new").click()
    page.wait_for_url("**/caja", timeout=15000)
    page.wait_for_timeout(700)
    check("Nueva venta from history returns to payment view (not composer)",
          page.locator("#mc-caja-payment-title").is_visible() and not page.locator("#mc-caja-new-description").is_visible(),
          page.url)
    body = page.locator("body").inner_text()
    check("pending order still blocks new sale", "Falta cobrar" in body, "")
    page.screenshot(path=str(HERE / "repo-pending-blocks-new-sale.png"), full_page=True)
    b.close()

payload = {"pending": pending["id"], "results": results, "failed": sum(1 for r in results if not r["ok"])}
(HERE / "repo-pending-blocks-new-sale.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print("failed", payload["failed"])
