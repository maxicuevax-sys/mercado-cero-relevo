from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.on("framenavigated", lambda f: print("NAV", f.url))
    page.on("request", lambda r: print("REQ", r.method, r.url) if "/fiados" in r.url or "tab=fiado" in r.url else None)
    page.on("response", lambda r: print("RESP", r.status, r.url) if "/fiados" in r.url or "tab=fiado" in r.url else None)
    page.on("console", lambda m: print("CONSOLE", m.type, m.text))
    page.goto(BASE + "/caja", wait_until="networkidle")
    link = page.locator('aside.inicio-sidebar a[href="/fiados"]')
    print("count", link.count(), "visible", link.first.is_visible(), "href", link.first.get_attribute("href"))
    link.first.click()
    page.wait_for_timeout(3000)
    print("URL after click", page.url)
    print("has new shell", page.locator("#caja-main").count())
    print("has legacy sale-text", page.locator("#sale-text").count())
    print("has fiado heading", page.locator("#fiado-heading").count())
    page.goto(BASE + "/fiados", wait_until="networkidle")
    page.wait_for_timeout(1000)
    print("URL after direct goto", page.url)
    print("direct legacy sale-text", page.locator("#sale-text").count(), "fiado heading", page.locator("#fiado-heading").count())
    b.close()
