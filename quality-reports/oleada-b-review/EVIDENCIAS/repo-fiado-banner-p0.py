import json
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
orders = json.load(urllib.request.urlopen(BASE + "/api/orders?limit=200"))["orders"]
credit_only = next(
    o for o in orders
    if o["creditCents"] > 0 and o["paidCents"] == 0 and o["digitalPaidCents"] == 0
    and (o["totalCents"] - o["paidCents"] - o["creditCents"]) <= 0
)
print("credit-only", credit_only["id"], credit_only["status"], credit_only["totalCents"], credit_only["paidCents"], credit_only["creditCents"])

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
        credit_only["id"],
    )
    page.goto(BASE + "/caja", wait_until="networkidle")
    page.wait_for_timeout(900)
    text = page.locator(".mc-caja-result").inner_text()
    print(text)
    check("fiado result opens", page.locator("#mc-caja-result-title").is_visible(), "")
    check("banner falsely claims cash was registered",
          "el efectivo sí se registró" in text and credit_only["paidCents"] == 0, text[:300])
    check("facts show no cash received", "Efectivo recibido" not in text and "Efectivo aplicado" not in text, "")
    page.screenshot(path=str(HERE / "repo-fiado-banner-p0.png"), full_page=True)
    b.close()

payload = {"order": credit_only["id"], "results": results, "failed": sum(1 for r in results if not r["ok"])}
(HERE / "repo-fiado-banner-p0.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print("failed", payload["failed"])
