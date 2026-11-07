import json
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
HERE = Path(__file__).resolve().parent

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1280, "height": 1000})
    page.goto(BASE + "/caja", wait_until="networkidle")
    page.wait_for_timeout(300)
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(300)
    add = page.locator(".mc-caja-add")
    add.get_by_label("Producto o servicio").fill("Prueba fantasma")
    add.get_by_label("Cantidad").fill("1")
    add.get_by_label("Precio unitario").fill("100")
    add.get_by_role("button", name="Agregar", exact=True).click()
    page.wait_for_timeout(200)
    page.get_by_role("button", name="Mixto", exact=True).click()
    page.wait_for_timeout(100)
    page.locator('label:has-text("Efectivo recibido") input').fill("100")
    page.locator('label:has-text("Monto a fiado") input').fill("100")
    page.wait_for_timeout(300)
    data = {
        "change": page.locator(".mc-caja-change").inner_text() if page.locator(".mc-caja-change").count() else "",
        "split": page.locator(".mc-caja-split").inner_text() if page.locator(".mc-caja-split").count() else "",
        "confirm": page.locator(".mc-caja-confirm").inner_text(),
        "disabled": page.locator(".mc-caja-confirm").is_disabled(),
        "alert": page.locator(".mc-caja-alert").all_inner_texts(),
        "hints": page.locator(".mc-caja-hint").all_inner_texts(),
    }
    print(json.dumps(data, ensure_ascii=False, indent=2))
    page.screenshot(path=str(HERE / "repo-mixto-phantom-change.png"), full_page=True)
    (HERE / "repo-mixto-phantom-change.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    b.close()
