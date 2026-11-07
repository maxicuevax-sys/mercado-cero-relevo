import json
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
orders = json.load(urllib.request.urlopen(BASE + "/api/orders?limit=300"))["orders"]
order = next(o for o in orders if o["paidCents"] > 0 and o["creditCents"] > 0 and o["digitalPaidCents"] == 0 and (o["totalCents"] - o["paidCents"] - o["creditCents"]) <= 0)
print("mixed cash+credit", order["id"], order["status"], order["totalCents"], order["paidCents"], order["creditCents"])

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
    title = page.locator("#mc-caja-result-title").inner_text() if page.locator("#mc-caja-result-title").count() else ""
    text = page.locator(".mc-caja-result").inner_text()
    print("TITLE:", title)
    print(text)
    check("mixed cash+credit opens result", bool(title), title)
    check("title does not claim full cash sale", "Venta cobrada en efectivo" not in title, title)
    check("facts show both cash and fiado", "Efectivo recibido" in text and "Saldo vivo fiado" in text, "")
    page.screenshot(path=str(HERE / "repo-mixto-fiado-demo-title.png"), full_page=True)
    b.close()

payload = {"order": order["id"], "title": title, "results": results, "failed": sum(1 for r in results if not r["ok"])}
(HERE / "repo-mixto-fiado-demo-title.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print("failed", payload["failed"])
