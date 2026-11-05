#!/usr/bin/env python3
"""Gate de integración de Inicio compacto sobre B.1.

Uso (servidor aislado ya levantado):
  $env:BASE_URL="http://127.0.0.1:3340"
  python scripts/inicio-compact-gate.py

Comprueba los seis viewports de la operación, texto al 200 %, foco de ruta,
axe, CTA, Pendientes, sugerencia y ausencia de overflow. Solo hace GET: no
ejecuta POST, demo/reset ni pagos. No debe apuntarse a la base principal.
"""
from __future__ import annotations

import datetime
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("BASE_URL", "").rstrip("/")
AXE = ROOT / "web" / "node_modules" / "axe-core" / "axe.min.js"
OUT = Path(
    os.environ.get(
        "INICIO_COMPACT_OUT",
        ROOT / "quality-reports" / "codex-inicio-vnext" / "evidencia",
    )
)
VIEWPORTS = [(1448, 1086), (1366, 768), (1280, 800), (768, 1024), (390, 844), (320, 640)]
ZOOM_VIEWPORTS = [(1280, 800), (768, 1024), (390, 844), (320, 640)]
RESULTS: list[dict] = []


def check(name: str, ok: bool, detail: object = "") -> None:
    RESULTS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f" — {detail}" if detail != "" else ""))


def get_json(path: str) -> dict:
    with urllib.request.urlopen(BASE + path, timeout=30) as response:
        return json.load(response)


def money(cents: int) -> str:
    return "${:,.2f}".format(cents / 100)


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


def measure(page, viewport_height: int, scroll_bottom: bool = False) -> dict:
    if scroll_bottom:
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(200)
    return page.evaluate(
        """(vh) => {
          const rect = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width),
                    h: Math.round(r.height), right: Math.round(r.right),
                    bottom: Math.round(r.bottom), sw: el.scrollWidth, cw: el.clientWidth};
          };
          const one = (s) => rect(document.querySelector(s));
          const visible = (el) => {
            const s = getComputedStyle(el);
            return s.display !== "none" && s.visibility !== "hidden";
          };
          return {
            vh,
            sw: document.documentElement.scrollWidth,
            cw: document.documentElement.clientWidth,
            kpis: [...document.querySelectorAll(".inicio-kpi")].map(rect),
            values: [...document.querySelectorAll(".inicio-kpi__value")].map((e) => e.textContent.trim()),
            cta: one(".inicio-hero__cta"),
            suggestionCta: one(".inicio-suggestion__cta"),
            pending: one(".inicio-pending"),
            pendingTitle: document.querySelector(".inicio-pending h2")?.textContent.trim() || "",
            suggestion: one(".inicio-suggestion"),
            hero: one(".inicio-hero"),
            h1: one("#inicio-title"),
            picado: one(".inicio-picado"),
            picadoVisible: (() => {
              const el = document.querySelector(".inicio-picado");
              return !!el && visible(el);
            })(),
            nav: one(".mc-mobile-nav"),
            navVisible: (() => {
              const el = document.querySelector(".mc-mobile-nav");
              return !!el && visible(el);
            })(),
            sidebarVisible: (() => {
              const el = document.querySelector(".inicio-sidebar");
              return !!el && visible(el);
            })(),
            overflow: [...document.querySelectorAll("main *")]
              .filter((el) => el.scrollWidth > el.clientWidth + 2 && !el.classList.contains("sr-only"))
              .map((el) => el.className || el.tagName)
              .slice(0, 8),
            fonts: [...document.fonts]
              .filter((f) => f.status === "loaded")
              .map((f) => f.family),
          };
        }""",
        viewport_height,
    )


def main() -> int:
    if not BASE:
        print("Falta BASE_URL. Ejemplo: http://127.0.0.1:3340", file=sys.stderr)
        return 2
    if not AXE.exists():
        print(f"Falta axe-core: {AXE}", file=sys.stderr)
        return 2
    OUT.mkdir(parents=True, exist_ok=True)

    dashboard = get_json("/api/dashboard")
    health = get_json("/api/health")
    summary = dashboard["summary"]
    expected = [
        money(summary["salesCents"]),
        money(summary["cashCents"] + summary["verifiedDigitalCents"]),
        money(dashboard["pendingCentsTotal"]),
    ]
    demo = bool(dashboard.get("demoMode"))

    mutations: list[str] = []
    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ------------------------------------------------------------------
        # Seis viewports de la operación.
        # ------------------------------------------------------------------
        for width, height in VIEWPORTS:
            context = browser.new_context(
                viewport={"width": width, "height": height}, locale="es-MX"
            )
            page = context.new_page()
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on(
                "request",
                lambda request: mutations.append(request.url)
                if request.method not in ("GET", "HEAD") and "/api/" in request.url
                else None,
            )
            page.goto(BASE + "/inicio", wait_until="domcontentloaded")
            page.locator(".inicio-kpi").first.wait_for()
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(500)

            data = measure(page, height)
            data["axe"] = axe(page)
            (OUT / f"inicio-{width}.json").write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            page.screenshot(path=str(OUT / f"inicio-{width}.png"), full_page=True)
            page.screenshot(path=str(OUT / f"inicio-{width}-viewport.png"))

            check(f"{width}: sin scroll horizontal", data["sw"] == data["cw"], f'{data["sw"]}/{data["cw"]}')
            check(f"{width}: cuatro KPI", len(data["kpis"]) == 4, len(data["kpis"]))
            check(
                f"{width}: importes desde la API real",
                data["values"][:3] == expected,
                f'{data["values"][:3]} esperado {expected}',
            )
            check(
                f"{width}: meta en porcentaje",
                bool(re.fullmatch(r"\d+%", data["values"][3] if len(data["values"]) > 3 else "")),
                data["values"][3] if len(data["values"]) > 3 else "",
            )
            check(
                f"{width}: Pendientes visible",
                data["pending"] is not None and data["pendingTitle"] == "Pendientes",
                data["pendingTitle"],
            )
            check(
                f"{width}: sugerencia y su CTA dentro del documento",
                data["suggestion"] is not None
                and data["suggestionCta"] is not None
                and data["suggestionCta"]["right"] <= width,
                data["suggestionCta"],
            )
            check(
                f"{width}: CTA Nueva venta en la primera pantalla",
                data["cta"] is not None and data["cta"]["bottom"] <= height,
                data["cta"],
            )

            rows = len({kpi["y"] for kpi in data["kpis"]})
            expected_rows = 1 if width >= 1280 else 2
            check(f"{width}: KPI en {expected_rows} fila(s)", rows == expected_rows, rows)

            limit = 175 if width >= 768 else 160
            tallest = max((kpi["h"] for kpi in data["kpis"]), default=999)
            check(f"{width}: KPI compactos (≤{limit} px)", tallest <= limit, f"{tallest} px")

            if width >= 1024:
                check(f"{width}: sidebar visible y mobile nav oculto", data["sidebarVisible"] and not data["navVisible"])
            else:
                check(f"{width}: mobile nav visible y sidebar oculto", data["navVisible"] and not data["sidebarVisible"])

            if data["picadoVisible"]:
                check(
                    f"{width}: papel picado no invade el saludo",
                    data["h1"] is not None
                    and data["picado"]["x"] >= data["h1"]["right"]
                    and data["picado"]["right"] <= width,
                    f'h1={data["h1"]} picado={data["picado"]}',
                )
            else:
                check(f"{width}: papel picado oculto sin invadir", True)

            check(f"{width}: axe 0 violaciones", len(data["axe"]) == 0, data["axe"])
            check(f"{width}: fuentes Hearth/Alder cargadas", len(data["fonts"]) >= 2, data["fonts"])

            if width < 1024:
                bottom = measure(page, height, scroll_bottom=True)
                check(
                    f"{width}: sugerencia no queda bajo la barra inferior",
                    bottom["suggestion"] is not None
                    and bottom["nav"] is not None
                    and bottom["suggestion"]["bottom"] <= bottom["nav"]["y"],
                    f'sugerencia={bottom["suggestion"]} nav={bottom["nav"]}',
                )
            context.close()

        # ------------------------------------------------------------------
        # Foco de ruta y orden de tabulación.
        # ------------------------------------------------------------------
        context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="es-MX")
        page = context.new_page()
        page.goto(BASE + "/inicio", wait_until="domcontentloaded")
        page.locator(".inicio-kpi").first.wait_for()
        page.wait_for_timeout(400)
        page.keyboard.press("Tab")
        check(
            "Foco: primer Tab llega al skip link",
            "Saltar al contenido" in (page.evaluate("document.activeElement?.innerText") or ""),
            page.evaluate("document.activeElement?.innerText"),
        )
        page.keyboard.press("Enter")
        page.wait_for_timeout(150)
        check(
            "Foco: skip link enfoca el main",
            page.evaluate("document.activeElement?.id") == "inicio-main",
            page.evaluate("document.activeElement?.id"),
        )
        page.get_by_role("link", name="Caja", exact=True).first.click()
        page.wait_for_timeout(500)
        page.get_by_role("link", name="Inicio", exact=True).first.click()
        page.wait_for_timeout(600)
        active = page.evaluate(
            "({id: document.activeElement?.id, tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim().slice(0, 30)})"
        )
        check("Foco: al volver a Inicio enfoca el h1", active["id"] == "inicio-title", active)
        page.keyboard.press("Tab")
        check(
            "Foco: el siguiente Tab entra al CTA Registrar",
            "Registrar" in (page.evaluate("document.activeElement?.innerText") or ""),
            page.evaluate("document.activeElement?.innerText"),
        )
        page.screenshot(path=str(OUT / "foco-inicio-1280.png"))
        context.close()

        # ------------------------------------------------------------------
        # Texto al 200 % (reflow real, no zoom de página).
        # ------------------------------------------------------------------
        for width, height in ZOOM_VIEWPORTS:
            context = browser.new_context(
                viewport={"width": width, "height": height}, locale="es-MX"
            )
            page = context.new_page()
            page.goto(BASE + "/inicio", wait_until="domcontentloaded")
            page.locator(".inicio-kpi").first.wait_for()
            page.evaluate("document.fonts.ready")
            page.evaluate("document.documentElement.style.fontSize='32px'")
            page.wait_for_timeout(500)
            data = measure(page, height)
            data["axe"] = axe(page)
            (OUT / f"zoom200-{width}.json").write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            page.screenshot(path=str(OUT / f"zoom200-{width}.png"), full_page=True)
            check(f"200% {width}: sin scroll horizontal", data["sw"] == data["cw"], f'{data["sw"]}/{data["cw"]}')
            check(f"200% {width}: cuatro KPI", len(data["kpis"]) == 4, len(data["kpis"]))
            check(
                f"200% {width}: importes sin recorte interno",
                all(kpi["sw"] <= kpi["cw"] + 2 for kpi in data["kpis"]),
                [f'{k["sw"]}/{k["cw"]}' for k in data["kpis"]],
            )
            check(f"200% {width}: axe 0 violaciones", len(data["axe"]) == 0, data["axe"])

            page.locator(".inicio-hero__cta").evaluate(
                "el => el.scrollIntoView({block: 'center'})"
            )
            page.wait_for_timeout(200)
            cta = page.locator(".inicio-hero__cta").bounding_box()
            nav_top = page.evaluate(
                "() => { const n = document.querySelector('.mc-mobile-nav'); const s = n && getComputedStyle(n); return n && s.display !== 'none' ? n.getBoundingClientRect().top : null; }"
            )
            check(
                f"200% {width}: CTA Nueva venta accesible",
                bool(cta)
                and cta["y"] >= 0
                and cta["y"] + cta["height"] <= height
                and (nav_top is None or cta["y"] + cta["height"] <= nav_top),
                f"cta={cta} navTop={nav_top}",
            )
            page.locator(".inicio-suggestion__cta").evaluate(
                "el => el.scrollIntoView({block: 'center'})"
            )
            page.wait_for_timeout(200)
            suggestion_cta = page.locator(".inicio-suggestion__cta").bounding_box()
            nav_top = page.evaluate(
                "() => { const n = document.querySelector('.mc-mobile-nav'); const s = n && getComputedStyle(n); return n && s.display !== 'none' ? n.getBoundingClientRect().top : null; }"
            )
            check(
                f"200% {width}: CTA de sugerencia accesible",
                bool(suggestion_cta)
                and suggestion_cta["y"] >= 0
                and suggestion_cta["y"] + suggestion_cta["height"] <= height
                and (nav_top is None or suggestion_cta["y"] + suggestion_cta["height"] <= nav_top),
                f"cta={suggestion_cta} navTop={nav_top}",
            )
            context.close()

        browser.close()

    check("Sin errores de página", not errors, errors[:3])
    check("Sin POST a /api durante el gate", not mutations, mutations[:3])

    report = {
        "base": BASE,
        "buildSha": health.get("buildSha"),
        "gitSha": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "demoMode": demo,
        "expected": expected,
        "checks": RESULTS,
        "pass": sum(1 for r in RESULTS if r["ok"]),
        "fail": sum(1 for r in RESULTS if not r["ok"]),
    }
    (OUT / "results.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        f"INICIO COMPACTO GATE — {report['pass']} PASS · {report['fail']} FAIL"
    )
    return 0 if report["fail"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
