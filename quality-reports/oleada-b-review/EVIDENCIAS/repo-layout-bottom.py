from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    m = b.new_page(viewport={"width": 390, "height": 844})
    m.goto(BASE + "/caja", wait_until="networkidle")
    m.wait_for_timeout(300)
    m.evaluate("localStorage.clear()")
    m.reload(wait_until="networkidle")
    m.wait_for_timeout(300)
    for sel in [".mc-caja-confirm", ".mc-caja-clear"]:
        el = m.locator(sel)
        el.scroll_into_view_if_needed()
        m.wait_for_timeout(250)
        box = el.bounding_box()
        hit = m.evaluate(
            """(box) => {
                const cx = box.x + box.width / 2;
                const cy = box.y + box.height / 2;
                const e = document.elementFromPoint(cx, cy);
                return {tag: e?.tagName, cls: e?.className, text: (e?.textContent||'').slice(0,80)};
            }""",
            box,
        )
        print(sel, "box", box, "hit", hit)
    # scroll to very bottom and inspect bottom padding vs fixed bars
    m.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    m.wait_for_timeout(250)
    print("bottom scrollY", m.evaluate("window.scrollY"), "innerHeight", m.evaluate("innerHeight"))
    print("body bottom pad", m.evaluate("getComputedStyle(document.querySelector('.mc-caja')).paddingBottom"))
    print("nav box", m.locator("nav.mc-mobile-nav").bounding_box())
    print("paybar box", m.locator(".mc-caja-paybar").bounding_box() if m.locator(".mc-caja-paybar").count() else None)
    m.screenshot(path=r"C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero\quality-reports\oleada-b-review\EVIDENCIAS\repo-caja-mobile-bottom.png")
    b.close()
