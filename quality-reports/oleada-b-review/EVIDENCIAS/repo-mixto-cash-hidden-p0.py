import json
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
orders = json.load(urllib.request.urlopen(BASE + "/api/orders?limit=300"))["orders"]
order = next(o for o in orders if o["paidCents"] > 0 and o["creditCents"] == 0 and (o["totalCents"] - o["paidCents"] - o["creditCents"]) > 0)
print("mixed cash+digital", order["id"], order["status"], order["totalCents"], order["paidCents"])

results = []


def check(name, ok, detail=""):
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + ((" - " + detail) if detail else ""))


with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1280, "height": 1000})
    page.goto(BASE + "/inicio", wait_until="domcontentloaded")
    page.evaluate(
        "(id) => localStorage.setItem('mercado-cero:caja-pending:v2', JSON.stringify({orderIds: [id]}))",
        order["id"],
    )
    page.goto(BASE + "/caja", wait_until="networkidle")
    page.wait_for_timeout(900)
    text = page.locator("#mc-caja-payment-title").locator("xpath=ancestor::section[1]").inner_text()
    print(text)
    check("mixed cash+digital opens payment panel", page.locator("#mc-caja-payment-title").is_visible(), "")
    check("panel shows the $40 due", "Falta cobrar" in text and "$40.00" in text, "")
    check("panel does NOT show received $60", "Recibiste" not in text and "$60.00" not in text, text[:400])
    check("panel says no money received yet", "El dinero aún no se considera recibido" in text, "")
    page.screenshot(path=str(HERE / "repo-mixto-cash-hidden-p0.png"), full_page=True)
    b.close()

payload = {"order": order["id"], "results": results, "failed": sum(1 for r in results if not r["ok"])}
(HERE / "repo-mixto-cash-hidden-p0.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print("failed", payload["failed"])
