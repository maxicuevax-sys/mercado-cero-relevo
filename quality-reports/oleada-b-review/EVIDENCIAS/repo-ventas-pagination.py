import json
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent
results = []

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1280, "height": 1000})
    for path in ["/ventas", "/ventas?page=2", "/ventas?page=999", "/ventas?page=abc"]:
        resp = page.goto(BASE + path, wait_until="networkidle")
        page.wait_for_timeout(200)
        rows = page.locator(".mc-ventas-row").count()
        meta = page.locator(".mc-ventas-list__head p").inner_text() if page.locator(".mc-ventas-list__head p").count() else ""
        nxt = page.locator('a[rel="next"]').get_attribute("href") if page.locator('a[rel="next"]').count() else None
        results.append({"path": path, "status": resp.status if resp else None, "url": page.url, "rows": rows, "meta": meta, "next": nxt})
        print(json.dumps(results[-1], ensure_ascii=False))
    b.close()

(HERE / "repo-ventas-pagination.json").write_text(json.dumps({"results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
