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
    add.get_by_label("Producto o servicio").fill("Prueba mixto")
    add.get_by_label("Cantidad").fill("1")
    add.get_by_label("Precio unitario").fill("100")
    add.get_by_role("button", name="Agregar", exact=True).click()
    page.wait_for_timeout(200)
    page.get_by_role("button", name="Mixto", exact=True).click()
    page.wait_for_timeout(100)
    page.locator('label:has-text("Efectivo recibido") input').fill("40")
    page.locator('label:has-text("Monto a fiado") input').fill("30")
    page.wait_for_timeout(300)

    hints = page.locator(".mc-caja-hint").all_inner_texts()
    split = page.locator(".mc-caja-split").inner_text() if page.locator(".mc-caja-split").count() else ""
    confirm = page.locator(".mc-caja-confirm").inner_text()
    digital = page.locator(".mc-caja-digital-note").all_inner_texts()
    print("hints", json.dumps(hints, ensure_ascii=False))
    print("split", split.replace("\n", " | "))
    print("confirm", confirm)
    print("digital", json.dumps(digital, ensure_ascii=False))
    page.screenshot(path=str(HERE / "repo-mixto-hint.png"), full_page=True)
    (HERE / "repo-mixto-hint.json").write_text(json.dumps({
        "hints": hints, "split": split, "confirm": confirm, "digital": digital,
        "badHint": any("El total cambió" in h for h in hints),
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    b.close()
