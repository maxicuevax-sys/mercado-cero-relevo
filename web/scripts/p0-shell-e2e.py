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

BASE = os.environ.get(
    "P0_BASE_URL",
    os.environ.get("RUNTIME_BASE_URL", os.environ.get("BASE_URL", "http://localhost:3101")),
).rstrip("/")
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
            ? sr.top < innerHeight && sr.bottom > 0 && sr.top >= 0 &&
              (!tabVisible || sr.bottom <= tr.top + 1)
            : null;
          return {
            headerRatio: header ? header.getBoundingClientRect().height / innerHeight : null,
            saleTop: sr ? Math.round(sr.top) : null,
            saleVisible,
            saleFullyAboveTabBar: sr && tr ? sr.top >= 0 && sr.bottom > 0 && sr.bottom <= tr.top + 1 : null,
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


def scroll_top(page) -> int:
    return page.evaluate(
        """() => {
          const main = document.getElementById('main');
          const scroller = main && /(auto|scroll)/.test(getComputedStyle(main).overflowY);
          return Math.round(scroller ? main.scrollTop : window.scrollY);
        }"""
    )


def scroll_to(page, value: int) -> None:
    page.evaluate(
        """(value) => {
          const main = document.getElementById('main');
          if (main && /(auto|scroll)/.test(getComputedStyle(main).overflowY)) {
            main.scrollTop = value;
          } else {
            window.scrollTo(0, value);
          }
        }""",
        value,
    )


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

        page.get_by_role("button", name="Reintentar").first.click()
        page.wait_for_timeout(1200)
        check(
            "Reintentar con el fallo activo no duplica ni entra en bucle",
            len(dashboard_calls) == first_count + 1,
            f"{len(dashboard_calls)} llamadas",
        )
        page.wait_for_timeout(2200)
        check("sigue sin bucle tras reintentar", len(dashboard_calls) == first_count + 1)

        page.unroute("**/api/dashboard", fail_dashboard)
        page.get_by_role("button", name="Reintentar").first.click()
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
        page.get_by_role("button", name="Reintentar").first.click()
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
        goal_contribution_payloads: list[dict] = []

        def reject_goal_contribution(route):
            goal_contribution_payloads.append(route.request.post_data_json or {})
            route.fulfill(status=500, content_type="text/plain", body="fallo simulado")

        page.route("**/api/goals/*/contribute", reject_goal_contribution)
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
        check(
            "GoalCard envía una llave goal_ estable",
            bool(goal_contribution_payloads)
            and str(goal_contribution_payloads[0].get("requestId", "")).startswith("goal_"),
            json.dumps(goal_contribution_payloads[:1], ensure_ascii=False),
        )
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

        # 360/200: la acción de venta no queda debajo de la tab bar.
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
        caja_action = page.evaluate(
            """() => {
              const tab = document.querySelector('nav[aria-label="Navegación inferior"]').getBoundingClientRect();
              const el = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('Interpretar'));
              const inp = document.querySelector('#sale-text');
              const r = el ? el.getBoundingClientRect() : null;
              const ir = inp ? inp.getBoundingClientRect() : null;
              return {
                found: Boolean(el),
                top: r ? Math.round(r.top) : null,
                bottom: r ? Math.round(r.bottom) : null,
                inputBottom: ir ? Math.round(ir.bottom) : null,
                tabTop: Math.round(tab.top),
                above: r ? r.bottom <= tab.top + 1 && r.top >= 0 && r.bottom > 0 : false,
                inputAbove: ir ? ir.bottom <= tab.top + 1 && ir.top >= 0 && ir.bottom > 0 : false,
              };
            }"""
        )
        check(
            "caja-360-200: Interpretar completo por encima de la tab bar",
            bool(caja_action["found"] and caja_action["above"]),
            f"bottom {caja_action['bottom']} <= tab {caja_action['tabTop']}",
        )
        check(
            "caja-360-200: campo de venta por encima de la tab bar",
            bool(caja_action["inputAbove"]),
            f"bottom {caja_action['inputBottom']} <= tab {caja_action['tabTop']}",
        )
        home_actions = page.evaluate(
            """() => {
              const tab = document.querySelector('nav[aria-label="Navegación inferior"]').getBoundingClientRect();
              const main = document.getElementById('main').getBoundingClientRect();
              const texts = ['Verificar comprobante', 'Quesadillas $90', 'Juan pagó $50'];
              const out = [];
              for (const text of texts) {
                const el = [...document.querySelectorAll('button')].find(b => ((b.innerText || '').includes(text)) || (b.getAttribute('aria-label') || '').includes(text));
                if (!el) { out.push({text, found: false, covered: false}); continue; }
                const r = el.getBoundingClientRect();
                const clippedBottom = Math.min(r.bottom, main.bottom);
                const covered = r.top < tab.top && clippedBottom > tab.top && r.top < innerHeight && r.bottom > 0;
                out.push({text, found: true, top: Math.round(r.top), bottom: Math.round(r.bottom),
                          clippedBottom: Math.round(clippedBottom), tabTop: Math.round(tab.top), covered});
              }
              return out;
            }"""
        )
        check(
            "home-360-200: acciones de Caja fuera del chrome fijo",
            all(item["covered"] is False for item in home_actions),
            str(home_actions),
        )
        page.screenshot(path=str(OUT / "e2e-caja-360-text200.png"))
        context.close()

        # Corte: Base inicial normal y Actualizar corte al 200%.
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
        page.locator('nav[aria-label="Navegación inferior"]').get_by_role(
            "button", name="Corte", exact=True
        ).click()
        page.wait_for_timeout(700)
        corte_normal = page.evaluate(
            """() => {
              const tab = document.querySelector('nav[aria-label="Navegación inferior"]').getBoundingClientRect();
              const main = document.getElementById('main').getBoundingClientRect();
              const el = document.querySelector('#corte-opening');
              const r = el ? el.getBoundingClientRect() : null;
              const clippedBottom = r ? Math.min(r.bottom, main.bottom) : null;
              return {
                found: Boolean(el),
                top: r ? Math.round(r.top) : null,
                bottom: r ? Math.round(r.bottom) : null,
                clippedBottom: clippedBottom === null ? null : Math.round(clippedBottom),
                tabTop: Math.round(tab.top),
                covered: Boolean(r && r.top < tab.top && clippedBottom > tab.top && r.bottom > 0),
              };
            }"""
        )
        check(
            "corte-360: Base inicial fuera del chrome fijo",
            bool(corte_normal["found"] and not corte_normal["covered"]),
            str(corte_normal),
        )
        text200(page)
        corte_200 = page.evaluate(
            """() => {
              const tab = document.querySelector('nav[aria-label="Navegación inferior"]').getBoundingClientRect();
              const main = document.getElementById('main').getBoundingClientRect();
              const el = [...document.querySelectorAll('button')].find(b => ((b.innerText || '').trim() === 'Actualizar corte') || (b.getAttribute('aria-label') || '').includes('Actualizar corte'));
              const r = el ? el.getBoundingClientRect() : null;
              const clippedBottom = r ? Math.min(r.bottom, main.bottom) : null;
              return {
                found: Boolean(el),
                top: r ? Math.round(r.top) : null,
                bottom: r ? Math.round(r.bottom) : null,
                clippedBottom: clippedBottom === null ? null : Math.round(clippedBottom),
                tabTop: Math.round(tab.top),
                covered: Boolean(r && r.top < tab.top && clippedBottom > tab.top && r.bottom > 0),
              };
            }"""
        )
        check(
            "corte-360-200: Actualizar corte fuera del chrome fijo",
            bool(corte_200["found"] and not corte_200["covered"]),
            str(corte_200),
        )
        page.screenshot(path=str(OUT / "e2e-corte-360-text200.png"))
        context.close()

        # 768/200: Registrar abono del primer fiado, completo sobre la tab bar.
        context = browser.new_context(viewport={"width": 768, "height": 1024}, locale="es-MX")
        page = context.new_page()
        page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("h1:has-text('Caja')", timeout=30000)
        page.wait_for_timeout(900)
        page.locator("button:visible", has_text="Fiado").first.click()
        page.wait_for_timeout(700)
        text200(page)
        fiado_action = page.evaluate(
            """() => {
              const tab = document.querySelector('nav[aria-label="Navegación inferior"]').getBoundingClientRect();
              const el = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('Registrar abono'));
              const r = el ? el.getBoundingClientRect() : null;
              return {
                found: Boolean(el),
                top: r ? Math.round(r.top) : null,
                bottom: r ? Math.round(r.bottom) : null,
                tabTop: Math.round(tab.top),
                above: r ? r.bottom <= tab.top + 1 && r.top >= 0 && r.bottom > 0 : false,
              };
            }"""
        )
        check(
            "fiado-768-200: Registrar abono completo por encima de la tab bar",
            bool(fiado_action["found"] and fiado_action["above"]),
            f"bottom {fiado_action['bottom']} <= tab {fiado_action['tabTop']}",
        )
        page.screenshot(path=str(OUT / "e2e-fiado-768-text200.png"))
        context.close()

        # Teclado: skip link, foco en main, tab bar antes de main y scroll/foco
        # al volver a un tab con posición guardada.
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
        page.keyboard.press("Tab")
        first_focus = page.evaluate("document.activeElement?.innerText?.trim()")
        check("teclado: primer Tab es el skip link", first_focus == "Saltar al contenido", str(first_focus))
        page.keyboard.press("Enter")
        page.wait_for_timeout(300)
        skip_state = page.evaluate(
            """() => {
              const el = document.activeElement;
              const main = document.getElementById('main');
              return {
                id: el?.id,
                tag: el?.tagName,
                isMain: el === main,
                tabIndex: main?.getAttribute('tabindex'),
                scrollY: Math.round(scrollY),
              };
            }"""
        )
        check(
            "teclado: el skip link enfoca main#main",
            bool(skip_state["isMain"] and skip_state["tabIndex"] == "-1"),
            str(skip_state),
        )
        dom_order = page.evaluate(
            """() => {
              const nav = document.querySelector('nav[aria-label="Navegación inferior"]');
              const main = document.querySelector('main#main');
              return Boolean(nav && main && (nav.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING));
            }"""
        )
        check("teclado: la tab bar va antes de main en el DOM", dom_order)

        scroll_to(page, 800)
        page.wait_for_timeout(200)
        nav = page.locator('nav[aria-label="Navegación inferior"]')
        nav.get_by_role("button", name="Fiado", exact=True).click()
        page.wait_for_timeout(700)
        nav.get_by_role("button", name="Caja", exact=True).click()
        page.wait_for_timeout(700)
        pointer_return = {
            "scrollY": scroll_top(page),
            "active": page.evaluate(
                "document.activeElement?.getAttribute('aria-label') || document.activeElement?.innerText?.trim()"
            ),
        }
        check(
            "puntero: volver a Caja conserva el scroll guardado",
            abs(pointer_return["scrollY"] - 800) <= 4,
            str(pointer_return),
        )

        # Activación por teclado: vuelve al top y enfoca el título visible.
        nav.get_by_role("button", name="Fiado", exact=True).click()
        page.wait_for_timeout(700)
        nav.get_by_role("button", name="Caja", exact=True).focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(700)
        keyboard_return = page.evaluate(
            """() => {
              const el = document.activeElement;
              const r = el?.getBoundingClientRect();
              const tab = document.querySelector('nav[aria-label="Navegación inferior"]').getBoundingClientRect();
              const header = document.querySelector('header').getBoundingClientRect();
              const main = document.getElementById('main');
              const scroller = main && /(auto|scroll)/.test(getComputedStyle(main).overflowY);
              const s = el ? getComputedStyle(el) : null;
              return {
                id: el?.id,
                top: r ? Math.round(r.top) : null,
                bottom: r ? Math.round(r.bottom) : null,
                headerBottom: Math.round(header.bottom),
                tabTop: Math.round(tab.top),
                scrollY: Math.round(scroller ? main.scrollTop : window.scrollY),
                visible: Boolean(r && r.top >= header.bottom - 1 && r.bottom <= tab.top + 1),
                outlineWidth: s ? s.outlineWidth : null,
                outlineStyle: s ? s.outlineStyle : null,
                clipPath: s ? s.clipPath : null,
              };
            }"""
        )
        check(
            "teclado: volver a Caja sube al top y enfoca el título",
            keyboard_return["id"] == "caja-heading" and keyboard_return["scrollY"] == 0,
            str(keyboard_return),
        )
        check(
            "teclado: el título enfocado queda visible entre header y tab bar",
            bool(keyboard_return["visible"]),
            str(keyboard_return),
        )
        check(
            "teclado: el anillo del título no queda recortado por heading-in",
            keyboard_return["outlineStyle"] != "none"
            and float((keyboard_return["outlineWidth"] or "0px").replace("px", "")) >= 3
            and (
                keyboard_return["clipPath"] in ("none", "auto")
                or "-12px" in (keyboard_return["clipPath"] or "")
            ),
            str(keyboard_return),
        )
        page.screenshot(path=str(OUT / "e2e-focus-return-360.png"))
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
        check(
            "home-1280-200: sidebar conserva los cinco destinos",
            sidebar == ["Caja", "Fiado", "Corte", "Meta", "Pendientes"],
            str(sidebar),
        )
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
                actionVisibleAboveTabBar: br ? br.top >= 0 && br.bottom > 0 && br.bottom <= tab.top + 1 : false,
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

        # Checkout público: el radio sr-only proyecta el foco en la tarjeta.
        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.request.post(f"{BASE}/api/demo/reset")
        dashboard = context.request.get(f"{BASE}/api/dashboard").json()
        pending = next(
            (order for order in dashboard["orders"] if order["status"] == "payment_pending"),
            None,
        )
        check("checkout: hay un cobro pendiente", pending is not None)
        if pending:
            page.goto(f"{BASE}/pay/{pending['id']}", wait_until="domcontentloaded", timeout=45000)
            page.wait_for_selector("text=¿Cómo quieres pagar?", timeout=20000)
            page.locator('input[type="radio"]').first.focus()
            checkout_focus = page.evaluate(
                """() => {
                  const label = document.querySelector('.checkout-method');
                  const input = document.querySelector('input[type="radio"]');
                  const s = label ? getComputedStyle(label) : null;
                  return {
                    focused: document.activeElement === input,
                    outlineStyle: s ? s.outlineStyle : null,
                    outlineWidth: s ? s.outlineWidth : null,
                    outlineOffset: s ? s.outlineOffset : null,
                    border: s ? s.borderTopColor : null,
                  };
                }"""
            )
            check(
                "checkout: el radio enfocado dibuja anillo visible",
                bool(
                    checkout_focus["focused"]
                    and checkout_focus["outlineStyle"] != "none"
                    and float((checkout_focus["outlineWidth"] or "0px").replace("px", "")) >= 2
                ),
                str(checkout_focus),
            )
            page.screenshot(path=str(OUT / "e2e-checkout-radio-focus-360.png"))
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
