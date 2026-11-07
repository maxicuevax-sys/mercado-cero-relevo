from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(r"C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero")
OUT = ROOT / "quality-reports" / "mercado-cero-final" / "14_EVIDENCIAS" / "navegacion"
BASE = os.environ.get("BASE_URL", "http://localhost:3100")
OUT.mkdir(parents=True, exist_ok=True)


def main() -> None:
    result: dict = {"base": BASE, "checks": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1448, "height": 1086}, locale="es-MX")
        page = context.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        page.goto(BASE + "/inicio", wait_until="networkidle")
        page.evaluate("document.fonts.ready.then(() => true)")
        page.wait_for_timeout(400)
        page.keyboard.press("Tab")
        first = page.evaluate(
            """() => {
              const el = document.activeElement;
              return {text: el?.innerText || "", href: el?.getAttribute("href") || "", y: el?.getBoundingClientRect().y};
            }"""
        )
        page.screenshot(path=str(OUT / "skip-link-focus-1448.png"))
        page.keyboard.press("Enter")
        page.wait_for_timeout(300)
        after_skip = page.evaluate(
            """() => {
              const el = document.activeElement;
              return {tag: el?.tagName || "", id: el?.id || "", scrollY: window.scrollY};
            }"""
        )
        result["checks"].append({"name": "primer Tab = saltar al contenido", "ok": "Saltar" in first["text"], "detail": first})
        result["checks"].append({"name": "Enter mueve foco a main", "ok": after_skip["id"] == "inicio-main", "detail": after_skip})

        page.goto(BASE + "/inicio", wait_until="networkidle")
        cta = page.locator(".inicio-hero__cta")
        cta.click()
        page.wait_for_url(BASE + "/", timeout=10_000)
        page.wait_for_load_state("networkidle")
        caja_h1 = page.locator("h1").first.inner_text() if page.locator("h1").count() else ""
        result["checks"].append(
            {"name": "CTA Registrar abre Caja", "ok": page.url.rstrip("/") == BASE and "Caja" in caja_h1, "detail": {"url": page.url, "h1": caja_h1}}
        )

        brand = page.locator("a.brand-lockup").first
        if brand.count():
            brand.click()
            page.wait_for_url(BASE + "/inicio", timeout=10_000)
            result["checks"].append(
                {"name": "marca de Caja vuelve a Inicio", "ok": page.url.endswith("/inicio"), "detail": {"url": page.url}}
            )
        else:
            result["checks"].append({"name": "marca de Caja vuelve a Inicio", "ok": False, "detail": "brand-lockup no encontrado"})

        for tab, expected in [("fiado", "Fiado"), ("corte", "Corte de caja"), ("meta", "Meta"), ("pendientes", "Pendientes")]:
            page.goto(BASE + f"/?tab={tab}", wait_until="networkidle")
            page.wait_for_timeout(500)
            active = page.locator("[aria-current='page']").all_inner_texts()
            panel = page.locator("section.tab-panel:not([hidden])").first.inner_text() if page.locator("section.tab-panel:not([hidden])").count() else ""
            ok = any(expected.lower() in value.lower() for value in active) or expected.lower() in panel.lower()
            result["checks"].append(
                {"name": f"deep link {tab}", "ok": ok, "detail": {"url": page.url, "active": active, "panel": panel[:120]}}
            )

        page.goto(BASE + "/inicio", wait_until="networkidle")
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(400)
        target = page.locator(".inicio-pending__head a").first.bounding_box()
        cta_box = page.locator(".inicio-hero__cta").first.bounding_box()
        result["checks"].append(
            {"name": "Ver todos >=48 px", "ok": bool(target and target["height"] >= 48), "detail": target}
        )
        result["checks"].append(
            {"name": "CTA visible a 390x844", "ok": bool(cta_box and cta_box["y"] + cta_box["height"] <= 844), "detail": cta_box}
        )

        page.goto(BASE + "/?ayuda=1#ajustes", wait_until="networkidle")
        page.wait_for_timeout(800)
        result["checks"].append(
            {
                "name": "Ajustes abre Ayuda y ajustes",
                "ok": page.locator("[role=dialog] h2", has_text="Ayuda y ajustes").count() > 0,
                "detail": {"dialogs": page.locator("[role=dialog]").count()},
            }
        )

        result["pageErrors"] = errors
        context.close()
        browser.close()

    (OUT / "resumen.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    for check in result["checks"]:
        print(("PASS" if check["ok"] else "FAIL"), check["name"], check.get("detail", ""))
    print("errors", errors)


if __name__ == "__main__":
    main()
