#!/usr/bin/env python3
"""Smoke de Oleada A: shell compartido, fuentes, navegación y rutas alias.

Uso:
  $env:BASE_URL="http://localhost:3100"
  python scripts/oleada-a-smoke.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
AXE = WEB / "node_modules" / "axe-core" / "axe.min.js"
OUT = Path(os.environ.get("OLEADA_A_OUT", ROOT / "demo" / "oleada-a"))
OUT.mkdir(parents=True, exist_ok=True)
RESULTS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")


def axe(page) -> list[dict]:
    page.add_script_tag(content=AXE.read_text(encoding="utf-8"))
    return page.evaluate(
        """async () => {
          const r = await axe.run(document, {
            runOnly: {type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"]},
            resultTypes: ["violations"],
          });
          return r.violations.map((v) => ({id: v.id, impact: v.impact, nodes: v.nodes.length}));
        }"""
    )


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1448, "height": 1086}, locale="es-MX")
        page = context.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        page.goto(BASE + "/inicio", wait_until="networkidle")
        page.wait_for_timeout(500)
        check("Inicio responde y muestra el saludo", page.locator("h1").first.is_visible(), page.locator("h1").first.inner_text())
        check("Cuatro KPI", page.locator(".inicio-kpi").count() == 4)
        boxes = page.evaluate(
            """() => Array.from(document.querySelectorAll('.inicio-kpi')).map((e) => {
              const r = e.getBoundingClientRect();
              return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width)};
            })"""
        )
        check("KPI en una fila a 1448", len({b["y"] for b in boxes}) == 1 and len({b["x"] for b in boxes}) == 4, json.dumps(boxes))
        check("Hero, Pendientes y Sugerencia presentes", all(page.locator(s).count() == 1 for s in [".inicio-hero", ".inicio-pending", ".inicio-suggestion"]))
        check(
            "Hearth y Alder cargadas",
            page.evaluate("() => document.fonts.check('600 52px Hearth') && document.fonts.check('400 18px Alder')"),
        )
        check(
            "H1 usa Hearth y body usa Alder",
            page.evaluate(
                """() => {
                  const h = getComputedStyle(document.querySelector('h1')).fontFamily;
                  const b = getComputedStyle(document.body).fontFamily;
                  return h.toLowerCase().includes('hearth') && b.toLowerCase().includes('alder');
                }"""
            ),
        )
        check("Main enfocable y único", page.locator("main#inicio-main").count() == 1)
        page.keyboard.press("Tab")
        check("Skip link primero", "Saltar al contenido" in page.evaluate("document.activeElement?.innerText || ''"))
        page.keyboard.press("Enter")
        check("Skip link enfoca main", page.evaluate("document.activeElement?.id") == "inicio-main")
        check("Inicio activo en sidebar", page.locator(".inicio-sidebar [aria-current='page']").inner_text().strip() == "Inicio")
        hrefs = page.evaluate("Array.from(document.querySelectorAll('.inicio-sidebar .inicio-nav__item')).map((a) => a.getAttribute('href'))")
        check(
            "Sidebar solo destinos reales y sin duplicados",
            hrefs == ["/inicio", "/ventas", "/fiados", "/corte", "/metas", "/pendientes", "/?ayuda=1", "/?ayuda=1#ajustes"]
            and len(set(hrefs)) == len(hrefs),
            json.dumps(hrefs),
        )
        check("Sidebar visible y mobile nav oculto a 1448", page.evaluate("getComputedStyle(document.querySelector('.inicio-sidebar')).display !== 'none' && getComputedStyle(document.querySelector('.mc-mobile-nav')).display === 'none'"))
        check("axe 0 a 1448", len(axe(page)) == 0)
        page.screenshot(path=str(OUT / "inicio-1448.png"), full_page=False)

        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(400)
        check("Sidebar oculto a 390", page.evaluate("getComputedStyle(document.querySelector('.inicio-sidebar')).display === 'none'"))
        check("Mobile nav visible a 390", page.evaluate("getComputedStyle(document.querySelector('.mc-mobile-nav')).display !== 'none'"))
        items = page.locator(".mc-mobile-nav__item")
        check("Mobile nav tiene 5 accesos", items.count() == 5, str(items.count()))
        heights = page.evaluate("Array.from(document.querySelectorAll('.mc-mobile-nav__item')).map(e => Math.round(e.getBoundingClientRect().height))")
        check("Targets mobile >=48", all(h >= 48 for h in heights), json.dumps(heights))
        cta = page.locator(".inicio-hero__cta").bounding_box()
        check("CTA visible a 390", bool(cta and cta["y"] + cta["height"] <= 844), json.dumps(cta))
        check("Sin overflow a 390", page.evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth"))
        page.locator(".mc-mobile-nav__more summary").click()
        page.wait_for_timeout(150)
        links = page.evaluate("Array.from(document.querySelectorAll('.mc-mobile-nav__panel a')).map(e => Math.round(e.getBoundingClientRect().height))")
        check("Más abre y sus targets >=48", len(links) >= 4 and all(h >= 48 for h in links), json.dumps(links))
        page.screenshot(path=str(OUT / "inicio-390-mas.png"), full_page=False)
        page.keyboard.press("Escape")
        page.wait_for_timeout(100)
        check(
            "Escape cierra Más y devuelve el foco",
            page.evaluate("document.querySelector('.mc-mobile-nav__more').open === false && document.activeElement?.tagName === 'SUMMARY'"),
        )
        check("axe 0 a 390", len(axe(page)) == 0)

        page.set_viewport_size({"width": 320, "height": 640})
        page.wait_for_timeout(400)
        check("Sin overflow a 320", page.evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth"))
        cta320 = page.locator(".inicio-hero__cta").bounding_box()
        check("CTA visible a 320", bool(cta320 and cta320["y"] + cta320["height"] <= 640), json.dumps(cta320))
        page.screenshot(path=str(OUT / "inicio-320.png"), full_page=False)

        aliases = {
            "/ventas": "tab=caja",
            "/fiados": "tab=fiado",
            "/corte": "tab=corte",
            "/metas": "tab=meta",
            "/pendientes": "tab=pendientes",
        }
        for path, target in aliases.items():
            page.goto(BASE + path, wait_until="networkidle")
            check(f"{path} conserva compatibilidad", target in page.url, page.url)

        page.goto(BASE + "/ventas?ayuda=1", wait_until="networkidle")
        check(
            "/ventas conserva ayuda=1",
            "tab=caja" in page.url and "ayuda=1" in page.url,
            page.url,
        )

        raw = page.request.get(BASE + "/ventas?ayuda=1", max_redirects=0)
        location = raw.headers.get("location", "")
        check(
            "/ventas responde 307 sin JavaScript",
            raw.status == 307 and "tab=caja" in location and "ayuda=1" in location,
            f"{raw.status} {location}",
        )

        caja = page.goto(BASE + "/caja", wait_until="domcontentloaded")
        check("/caja sigue reservada (404 honesto)", bool(caja and caja.status == 404), str(caja.status if caja else "?"))

        page.goto(BASE + "/?ayuda=1#ajustes", wait_until="networkidle")
        page.wait_for_timeout(600)
        check("Ayuda y ajustes abre", page.locator("[role=dialog] h2", has_text="Ayuda y ajustes").count() == 1)
        check("sin errores de página", len(errors) == 0, json.dumps(errors[:3]))

        context.close()
        browser.close()

    failed = [r for r in RESULTS if not r["ok"]]
    print(f"\nOLEADA A SMOKE — {len(RESULTS) - len(failed)} PASS · {len(failed)} FAIL")
    (OUT / "oleada-a-smoke.json").write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
