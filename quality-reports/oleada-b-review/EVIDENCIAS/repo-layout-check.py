from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1280, "height": 1000})
    page.goto(BASE + "/ventas", wait_until="networkidle")
    page.wait_for_timeout(300)
    items = page.locator("aside.inicio-sidebar nav a").all_inner_texts()
    hrefs = page.locator("aside.inicio-sidebar nav a").evaluate_all("els => els.map(e => e.getAttribute('href'))")
    print("ventas sidebar", items, hrefs)
    page.screenshot(path=r"C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero\quality-reports\oleada-b-review\EVIDENCIAS\repo-ventas-sidebar-check.png")

    m = b.new_page(viewport={"width": 390, "height": 844})
    m.goto(BASE + "/caja", wait_until="networkidle")
    m.wait_for_timeout(300)
    # Clear the injected drafts so the add form sits near the end of the page.
    m.evaluate("localStorage.clear()")
    m.reload(wait_until="networkidle")
    m.wait_for_timeout(300)
    add = m.locator(".mc-caja-add")
    add.scroll_into_view_if_needed()
    m.wait_for_timeout(200)
    box = add.bounding_box()
    hit = m.evaluate(
        """(box) => {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            const el = document.elementFromPoint(cx, cy);
            return {tag: el?.tagName, cls: el?.className, text: (el?.textContent||'').slice(0,60)};
        }""",
        box,
    )
    print("add box", box, "elementFromPoint", hit)
    confirm = m.locator(".mc-caja-confirm")
    print("confirm visible", confirm.is_visible(), "box", confirm.bounding_box())
    # Check the bottom-most actionable control can be hit.
    add_btn = m.get_by_role("button", name="Agregar", exact=True)
    add_btn.scroll_into_view_if_needed()
    m.wait_for_timeout(200)
    b2 = add_btn.bounding_box()
    hit2 = m.evaluate(
        """(box) => {
            const cx = box.x + box.width / 2;
            const cy = box.y + box.height / 2;
            const el = document.elementFromPoint(cx, cy);
            return {tag: el?.tagName, cls: el?.className, text: (el?.textContent||'').slice(0,60)};
        }""",
        b2,
    )
    print("agregar box", b2, "elementFromPoint", hit2)
    m.screenshot(path=r"C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero\quality-reports\oleada-b-review\EVIDENCIAS\repo-caja-mobile-scrolled.png")
    b.close()
