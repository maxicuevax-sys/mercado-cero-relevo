"""
P0-F · Shell 200 % y estados de error honestos.

Uso (servidor aislado ya levantado en :3101):
  $env:P0_BASE_URL="http://localhost:3101"
  python scripts/p0-shell-e2e.py

El script no arranca ni reinicia :3000. Reinicia la demo por API antes de
probar la recuperación del dashboard. Guarda capturas y JSON en
harness/evidence/p0-shell/.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.environ.get("P0_BASE_URL", "http://localhost:3101").rstrip("/")
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "harness" / "evidence" / "p0-shell"
OUT.mkdir(parents=True, exist_ok=True)

if BASE.endswith(":3000"):
    raise SystemExit("No se corre contra :3000. Usa un servidor aislado en :3101.")

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'} · {name}" + (f" · {detail}" if detail else ""))


def code_info() -> dict:
    def git(*args: str) -> str:
        try:
            return subprocess.check_output(
                ["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
            ).strip()
        except Exception:
            return ""

    return {
        "commit": git("rev-parse", "HEAD"),
        # Incluye untracked bajo web/ para no declarar limpio un árbol con código nuevo.
        "dirty": bool(git("status", "--porcelain", "--", "web")),
    }


def broken_words(page) -> list[dict]:
    return page.evaluate(
        """() => {
          const found = [];
          const seen = new Set();
          const visible = el => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none';
          };
          const re = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/g;
          for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,button,a,label,li')) {
            if (!visible(el)) continue;
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
              const text = node.textContent || '';
              re.lastIndex = 0;
              let match;
              while ((match = re.exec(text))) {
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                const tops = new Set(
                  Array.from(range.getClientRects()).filter(r => r.width > 0).map(r => Math.round(r.top))
                );
                if (tops.size > 1) {
                  const key = match[0] + '@' + Math.min(...tops);
                  if (!seen.has(key)) {
                    seen.add(key);
                    found.push({ word: match[0], text: (el.innerText || '').trim().slice(0, 50) });
                  }
                }
              }
            }
          }
          return found;
        }"""
    )


def home_metrics(page) -> dict:
    return page.evaluate(
        """() => {
          const header = document.querySelector('header');
          const sale = document.querySelector('#sale-text');
          const sr = sale ? sale.getBoundingClientRect() : null;
          const tab = document.querySelector('nav[aria-label="Navegación inferior"]');
          const tr = tab ? tab.getBoundingClientRect() : null;
          const tabVisible = Boolean(tr && tr.height > 0 && tr.top < innerHeight);
          const saleVisible = sr
            ? sr.top < innerHeight && sr.bottom > 0 && (!tabVisible || sr.bottom <= tr.top + 1)
            : null;
          return {
            headerRatio: header ? header.getBoundingClientRect().height / innerHeight : null,
            saleTop: sr ? Math.round(sr.top) : null,
            saleVisible,
            saleFullyAboveTabBar: sr && tr ? sr.bottom <= tr.top + 1 : null,
            tabBarTop: tr ? Math.round(tr.top) : null,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth,
          };
        }"""
    )


def text200(page) -> None:
    page.add_style_tag(content="html { font-size: 200% !important; }")
    page.wait_for_timeout(500)


def reset_dashboard(page) -> None:
    page.request.post(f"{BASE}/api/demo/reset")


def main() -> int:
    started = time.time()
    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        # ------------------------------------------------------------------
        # 1 · Error de /api/dashboard: estado honesto, sin bucle, con reintento.
        # ------------------------------------------------------------------
        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        reset_dashboard(page)
        dashboard_calls: list[int] = []

        def fail_dashboard(route):
            dashboard_calls.append(1)
            route.fulfill(status=500, content_type="text/plain", body="fallo simulado")

        page.route("**/api/dashboard", fail_dashboard)
        page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("text=No pudimos cargar los datos del negocio.", timeout=20000)
        page.wait_for_timeout(800)

        body = page.locator("body").inner_text()
        check("dashboard 500 muestra error persistente", "No pudimos cargar los datos del negocio." in body)
        check("dashboard 500 conserva DEMO", page.get_by_role("button", name="Demo", exact=True).count() == 1)
        check("dashboard 500 no inventa el comercio", "Antojitos de Lupita" not in body, body.split("\n")[1] if body else "")
        check("dashboard 500 no dice 'no hay ventas'", "Aún no hay ventas" not in body)
        check("dashboard 500 no dice 'sin fiados'", "Sin fiados pendientes" not in body)
        check("dashboard 500 ofrece Reintentar", page.get_by_role("button", name="Reintentar").count() == 1)
        check("Actividad distingue error de vacío", "No pudimos cargar la actividad." in body)

        first_count = len(dashboard_calls)
        check("una sola carga inicial de /api/dashboard", first_count == 1, f"{first_count} llamada(s)")
        page.wait_for_timeout(2600)
        check(
            "sin bucle de /api/dashboard",
            len(dashboard_calls) == first_count,
            f"{first_count} llamada(s) y se mantiene",
        )
        page.screenshot(path=str(OUT / "e2e-error-360.png"))

        page.locator("button:visible", has_text="Fiado").first.click()
        page.wait_for_timeout(300)
        fiado_body = page.locator("body").inner_text()
        check(
            "Fiado distingue error de vacío",
            "No pudimos cargar los fiados." in fiado_body and "Sin fiados pendientes" not in fiado_body,
        )
        page.screenshot(path=str(OUT / "e2e-error-fiado-360.png"))

        page.get_by_role("button", name="Reintentar").click()
        page.wait_for_timeout(1200)
        check(
            "Reintentar con el fallo activo no duplica ni entra en bucle",
            len(dashboard_calls) == first_count + 1,
            f"{len(dashboard_calls)} llamadas",
        )
        page.wait_for_timeout(2200)
        check("sigue sin bucle tras reintentar", len(dashboard_calls) == first_count + 1)

        page.unroute("**/api/dashboard", fail_dashboard)
        page.get_by_role("button", name="Reintentar").click()
        page.wait_for_selector("text=Antojitos de Lupita", timeout=20000)
        page.wait_for_timeout(700)
        recovered = page.locator("body").inner_text()
        check("Reintentar recupera el comercio real", "Antojitos de Lupita" in recovered)
        check("el aviso de error desaparece al recuperar", "No pudimos cargar los datos del negocio." not in recovered)
        check("la actividad vuelve a mostrar pedidos", "No pudimos cargar la actividad." not in recovered)
        activity_items = page.evaluate(
            """() => {
              const heading = [...document.querySelectorAll('h2')].find(
                el => (el.innerText || '').includes('Últimos movimientos')
              );
              const card = heading ? heading.closest('div.rounded-2xl') : null;
              return card ? card.querySelectorAll('button').length : 0;
            }"""
        )
        check("la actividad recuperada tiene pedidos reales", activity_items > 0, f"{activity_items} pedido(s)")
        page.screenshot(path=str(OUT / "e2e-error-recovered-360.png"))
        context.close()

        # ------------------------------------------------------------------
        # 1b · Fallo después de una carga buena: datos viejos + aviso.
        # ------------------------------------------------------------------
        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("text=Antojitos de Lupita", timeout=20000)
        page.wait_for_timeout(900)
        before_items = page.evaluate(
            """() => {
              const heading = [...document.querySelectorAll('h2')].find(
                el => (el.innerText || '').includes('Últimos movimientos')
              );
              const card = heading ? heading.closest('div.rounded-2xl') : null;
              return card ? card.querySelectorAll('button').length : 0;
            }"""
        )
        check("carga buena inicial con pedidos", before_items > 0, f"{before_items} pedido(s)")

        def fail_late(route):
            route.fulfill(status=500, content_type="text/plain", body="fallo simulado")

        page.route("**/api/dashboard", fail_late)
        page.get_by_role("button", name="Demo", exact=True).click()
        page.get_by_role("button", name="Reiniciar datos de demo").click()
        page.get_by_role("button", name="Sí, reiniciar").click()
        page.wait_for_selector("text=No pudimos cargar los datos del negocio.", timeout=15000)
        page.wait_for_timeout(700)
        stale_body = page.locator("body").inner_text()
        check("fallo tardío muestra aviso persistente", "No pudimos cargar los datos del negocio." in stale_body)
        check("fallo tardío explica que los datos son viejos", "Lo que ves es de la última carga." in stale_body)
        check("fallo tardío conserva el comercio de la última carga", "Antojitos de Lupita" in stale_body)
        check("fallo tardío conserva DEMO", page.get_by_role("button", name="Demo", exact=True).count() == 1)
        after_items = page.evaluate(
            """() => {
              const heading = [...document.querySelectorAll('h2')].find(
                el => (el.innerText || '').includes('Últimos movimientos')
              );
              const card = heading ? heading.closest('div.rounded-2xl') : null;
              return card ? card.querySelectorAll('button').length : 0;
            }"""
        )
        check("fallo tardío no borra la actividad vieja", after_items > 0, f"{after_items} pedido(s)")
        check("fallo tardío no muestra body crudo", "fallo simulado" not in stale_body)
        page.screenshot(path=str(OUT / "e2e-stale-dashboard-360.png"))

        page.unroute("**/api/dashboard", fail_late)
        page.get_by_role("button", name="Reintentar").click()
        page.wait_for_selector("text=Antojitos de Lupita", timeout=20000)
        page.wait_for_timeout(700)
        check(
            "reintento tardío limpia el aviso",
            "No pudimos cargar los datos del negocio." not in page.locator("body").inner_text(),
        )
        context.close()

        # ------------------------------------------------------------------
        # 2 · GoalCard: error de /api/goals no se disfraza de “sin meta”.
        # ------------------------------------------------------------------
        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.route(
            "**/api/goals",
            lambda route: route.fulfill(status=500, content_type="text/plain", body="fallo simulado"),
        )
        page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("h1:has-text('Caja')", timeout=20000)
        page.locator("button:visible", has_text="Meta").first.click()
        page.wait_for_selector("text=No pudimos cargar la meta", timeout=15000)
        meta_body = page.locator("body").inner_text()
        check("GoalCard muestra error si goal=null", "No pudimos cargar la meta" in meta_body)
        check("GoalCard no dice 'Aún no hay una meta' con error", "Aún no hay una meta" not in meta_body)
        check("GoalCard ofrece Reintentar", page.get_by_role("button", name="Reintentar").count() >= 1)
        check("GoalCard no muestra Unexpected token", "Unexpected token" not in meta_body)
        check("GoalCard no muestra el body crudo", "fallo simulado" not in meta_body)
        page.screenshot(path=str(OUT / "e2e-goal-error-360.png"))
        context.close()

        # 2b · Aportación con 500 de texto plano: mensaje propio, no el body.
        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.route(
            "**/api/goals/*/contribute",
            lambda route: route.fulfill(status=500, content_type="text/plain", body="fallo simulado"),
        )
        page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("h1:has-text('Caja')", timeout=20000)
        page.locator("button:visible", has_text="Meta").first.click()
        page.wait_for_selector("text=Mi primera sombrilla", timeout=15000)
        page.get_by_label("¿Cuánto apartaste?").fill("50")
        page.get_by_role("button", name="Apartar", exact=True).click()
        page.wait_for_selector("text=No pude aportar.", timeout=10000)
        contribute_body = page.locator("body").inner_text()
        check("GoalCard muestra 'No pude aportar' en 500", "No pude aportar." in contribute_body)
        check("GoalCard no muestra Unexpected token al aportar", "Unexpected token" not in contribute_body)
        check("GoalCard no muestra el body crudo al aportar", "fallo simulado" not in contribute_body)
        page.screenshot(path=str(OUT / "e2e-goal-contribute-error-360.png"))
        context.close()

        # ------------------------------------------------------------------
        # 3 · 200 % en las superficies del hallazgo F0.
        # ------------------------------------------------------------------
        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("h1:has-text('Caja')", timeout=30000)
        page.wait_for_timeout(900)
        text200(page)
        metrics = home_metrics(page)
        broken = broken_words(page)
        check("home-360-200: header <= 30% del viewport", (metrics["headerRatio"] or 0) <= 0.30, f"{metrics['headerRatio']:.1%}")
        check("home-360-200: campo de venta en el primer viewport", bool(metrics["saleVisible"]))
        check(
            "home-360-200: campo de venta por encima de la tab bar",
            bool(metrics["saleFullyAboveTabBar"]),
            f"sale bottom <= tab top ({metrics['tabBarTop']})",
        )
        check("home-360-200: sin palabras partidas", not broken, ", ".join(item["word"] for item in broken[:5]))
        check("home-360-200: sin overflow horizontal", metrics["scrollWidth"] <= metrics["innerWidth"] + 1)
        page.screenshot(path=str(OUT / "e2e-home-360-text200.png"))
        context.close()

        # 768/200: la tab bar inferior comparte el viewport; el campo debe estar encima.
        context = browser.new_context(viewport={"width": 768, "height": 1024}, locale="es-MX")
        page = context.new_page()
        page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("h1:has-text('Caja')", timeout=30000)
        page.wait_for_timeout(900)
        text200(page)
        metrics768 = home_metrics(page)
        broken768 = broken_words(page)
        check(
            "home-768-200: campo de venta por encima de la tab bar",
            bool(metrics768["saleVisible"] and metrics768["saleFullyAboveTabBar"]),
            f"saleTop={metrics768['saleTop']} tabTop={metrics768['tabBarTop']}",
        )
        check("home-768-200: sin palabras partidas", not broken768)
        check("home-768-200: sin overflow horizontal", metrics768["scrollWidth"] <= metrics768["innerWidth"] + 1)
        page.screenshot(path=str(OUT / "e2e-home-768-text200.png"))
        context.close()

        context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="es-MX")
        page = context.new_page()
        page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("h1:has-text('Caja')", timeout=30000)
        page.wait_for_timeout(900)
        text200(page)
        metrics1280 = home_metrics(page)
        check(
            "home-1280-200: medida registrada (campo bajo el pliegue documentado)",
            True,
            f"saleTop={metrics1280['saleTop']} viewport=800",
        )
        check("home-1280-200: sin overflow horizontal", metrics1280["scrollWidth"] <= metrics1280["innerWidth"] + 1)
        page.screenshot(path=str(OUT / "e2e-home-1280-text200.png"))
        sidebar = page.evaluate(
            """() => {
              const nav = document.querySelector('aside nav[aria-label="Navegación principal"]');
              return nav ? Array.from(nav.querySelectorAll('button')).map(b => b.innerText.trim()) : [];
            }"""
        )
        broken = broken_words(page)
        check("home-1280-200: sidebar conserva Fiado y Corte", sidebar == ["Caja", "Fiado", "Corte", "Meta"], str(sidebar))
        check("home-1280-200: sin palabras partidas", not broken, ", ".join(item["word"] for item in broken[:5]))

        page.get_by_role("button", name="Abrir guía").click()
        page.wait_for_timeout(400)
        text200(page)
        help_data = page.evaluate(
            """() => {
              const group = document.querySelector('[role="dialog"] [aria-label="Tamaño del texto"]');
              const cols = group ? getComputedStyle(group).gridTemplateColumns.split(' ').filter(Boolean).length : null;
              const speeds = document.querySelector('[role="dialog"] [aria-label="Velocidad de la voz"]');
              return { cols, hasSpeeds: Boolean(speeds) };
            }"""
        )
        broken = broken_words(page)
        check("help-1280-200: controles en 1–2 columnas", help_data["cols"] is not None and help_data["cols"] <= 2, str(help_data))
        check("help-1280-200: controles de velocidad presentes", help_data["hasSpeeds"])
        check("help-1280-200: sin palabras partidas", not broken, ", ".join(item["word"] for item in broken[:5]))
        page.screenshot(path=str(OUT / "e2e-help-1280-text200.png"))
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        context.close()

        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("h1:has-text('Caja')", timeout=30000)
        page.wait_for_timeout(900)
        page.get_by_role("button", name="Verificar comprobante", exact=True).click()
        page.wait_for_selector("text=Pega el ID de la transacción", timeout=10000)
        text200(page)
        title = page.locator('[role="dialog"] h2').inner_text()
        broken = broken_words(page)
        check("verify-360-200: título completo", "Verificar comprobante" in title, title)
        check("verify-360-200: sin palabras partidas", not broken, ", ".join(item["word"] for item in broken[:5]))
        page.screenshot(path=str(OUT / "e2e-verify-360-text200.png"))
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        context.close()

        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("h1:has-text('Caja')", timeout=30000)
        page.wait_for_timeout(900)
        page.locator("button:visible", has_text="Meta").first.click()
        page.wait_for_timeout(700)
        text200(page)
        meta_metrics = page.evaluate(
            """() => {
              const tab = document.querySelector('nav[aria-label="Navegación inferior"]').getBoundingClientRect();
              const amount = [...document.querySelectorAll('p, span')].find(el => /\\$[\\d.,]+\\s+de\\s+\\$[\\d.,]+/.test(el.innerText || ''));
              const action = [...document.querySelectorAll('button')].find(el => (el.innerText || '').trim() === 'Apartar');
              const ar = amount ? amount.getBoundingClientRect() : null;
              const br = action ? action.getBoundingClientRect() : null;
              return {
                amountVisible: ar ? ar.top < innerHeight && ar.bottom > 0 : false,
                amountText: amount ? amount.innerText.trim() : null,
                actionVisibleAboveTabBar: br ? br.top < innerHeight && br.bottom <= tab.top + 1 : false,
                actionTop: br ? Math.round(br.top) : null,
                tabTop: Math.round(tab.top),
              };
            }"""
        )
        check("meta-360-200: cifra de meta visible", bool(meta_metrics["amountVisible"]), str(meta_metrics["amountText"]))
        check(
            "meta-360-200: Apartar visible por encima de la tab bar",
            bool(meta_metrics["actionVisibleAboveTabBar"]),
            f"top {meta_metrics['actionTop']} <= tab {meta_metrics['tabTop']}",
        )
        broken = broken_words(page)
        check("meta-360-200: sin palabras partidas", not broken, ", ".join(item["word"] for item in broken[:5]))
        page.screenshot(path=str(OUT / "e2e-meta-360-text200.png"))
        context.close()

        browser.close()

    passed = sum(1 for item in results if item["ok"])
    failed = len(results) - passed
    evidence = {
        "baseUrl": BASE,
        "started": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "elapsedSeconds": round(time.time() - started, 1),
        "code": code_info(),
        "passed": passed,
        "failed": failed,
        "results": results,
    }
    path = OUT / "p0-shell-e2e.json"
    path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nRESULTADO: {passed} PASS · {failed} FAIL · {path}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
