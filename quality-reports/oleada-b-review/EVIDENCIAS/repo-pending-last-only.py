import json
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
orders = json.load(urllib.request.urlopen(BASE + "/api/orders?limit=100"))["orders"]
pending = [o for o in orders if o["status"] == "payment_pending" and (o["totalCents"] - o["paidCents"] - o["creditCents"]) > 0]
assert len(pending) >= 2, pending
first, last = pending[1], pending[0]
print("first", first["id"], "last", last["id"])

results = []


def check(name, ok, detail=""):
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + ((" - " + detail) if detail else ""))


with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1280, "height": 1000})
    page.goto(BASE + "/inicio", wait_until="domcontentloaded")
    page.evaluate(
        """(ids) => {
            localStorage.setItem('mercado-cero:caja-pending:v2', JSON.stringify({orderIds: ids}));
            localStorage.removeItem('mercado-cero:caja-draft:v2');
        }""",
        [first["id"], last["id"]],
    )
    page.goto(BASE + "/caja", wait_until="networkidle")
    page.wait_for_timeout(800)
    title = page.locator("#mc-caja-payment-title").inner_text() if page.locator("#mc-caja-payment-title").count() else ""
    check("restores last pending id", last["id"][-4:].upper() in title, f"title={title!r} expected={last['id'][-4:].upper()}")
    check("does not restore first pending id", first["id"][-4:].upper() not in page.locator("body").inner_text(),
          f"first={first['id'][-4:].upper()}")
    check("no list of other pending orders", page.locator("#mc-caja-payment-title").count() == 1, "")
    page.screenshot(path=str(HERE / "repo-pending-last-only.png"), full_page=True)
    b.close()

payload = {"first": first["id"], "last": last["id"], "results": results, "failed": sum(1 for r in results if not r["ok"])}
(HERE / "repo-pending-last-only.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print("failed", payload["failed"])
