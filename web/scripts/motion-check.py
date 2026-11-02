#!/usr/bin/env python3
"""Comprueba el motion del mostrador: rápido, con causa y con reduced-motion.

Uso (servidor ya levantado):
  $env:MOTION_BASE_URL="http://localhost:3000"
  python scripts/motion-check.py

No toca la DB ni el código. Escribe harness/evidence/motion-check.json.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.environ.get("MOTION_BASE_URL", "http://localhost:3000").rstrip("/")
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "harness" / "evidence" / "motion-check.json"
SHOTS = ROOT / "harness" / "evidence" / "motion"
results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' - ' + detail) if detail else ''}")


def git_value(*args: str) -> str:
    try:
        return subprocess.check_output(
            ["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return ""


def seconds(value: str) -> float:
    value = value.strip()
    if value.endswith("ms"):
        return float(value[:-2]) / 1000
    if value.endswith("s"):
        return float(value[:-1])
    return 0.0


def read_motion(page) -> dict:
    return page.evaluate(
        """() => {
          const active = [...document.querySelectorAll('.tab-panel')].find(
            (el) => !el.hasAttribute('hidden')
          );
          const heading = active ? active.querySelector('h1') : null;
          const item = active ? active.querySelector('.motion-list > *') : null;
          const progress = document.querySelector('.scroll-progress');
          const read = (el) => {
            if (!el) return null;
            const s = getComputedStyle(el);
            return {
              name: s.animationName,
              duration: s.animationDuration,
              delay: s.animationDelay,
              timeline: s.animationTimeline,
              opacity: s.opacity,
              transform: s.transform,
            };
          };
          return { panel: read(active), heading: read(heading), item: read(item), progress: read(progress) };
        }"""
    )


def scale_x(transform: str) -> float:
    match = re.match(r"matrix\(([^,]+),", transform or "")
    return float(match.group(1)) if match else 0.0


def main() -> int:
    # Se captura antes de escribir capturas/JSON; si no, el propio reporte
    # aparecería como árbol sucio.
    start_code = {
        "commit": git_value("rev-parse", "HEAD"),
        "branch": git_value("rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": bool(git_value("status", "--porcelain")),
    }
    SHOTS.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        desktop = browser.new_context(viewport={"width": 1280, "height": 800}, locale="es-MX")
        page = desktop.new_page()
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(BASE, wait_until="networkidle", timeout=60000)
        page.wait_for_function("document.body.innerText.includes('Hoy $')", timeout=20000)
        page.wait_for_timeout(250)

        home = read_motion(page)
        check(
            "el tab activo entra en 160 ms",
            home["panel"] is not None
            and home["panel"]["name"] == "tab-panel-in"
            and seconds(home["panel"]["duration"]) <= 0.3,
            json.dumps(home["panel"], ensure_ascii=False),
        )
        check(
            "el encabezado hace un reveal corto",
            home["heading"] is not None
            and home["heading"]["name"] == "heading-in"
            and seconds(home["heading"]["duration"]) <= 0.3,
            json.dumps(home["heading"], ensure_ascii=False),
        )
        check(
            "la lista entra con stagger acotado",
            home["item"] is not None
            and home["item"]["name"] == "list-item-in"
            and seconds(home["item"]["duration"]) <= 0.3,
            json.dumps(home["item"], ensure_ascii=False),
        )
        page.screenshot(path=str(SHOTS / "1280-home.png"))

        page.evaluate(
            """() => {
              const btn = [...document.querySelectorAll('aside button')]
                .find(el => (el.innerText || '').trim() === 'Fiado');
              btn?.click();
            }"""
        )
        page.wait_for_timeout(80)
        fiado = read_motion(page)
        check(
            "cambiar de tab no espera: hay animación en curso a 80 ms",
            fiado["panel"] is not None and float(fiado["panel"]["opacity"]) < 1,
            f"opacity={fiado['panel']['opacity'] if fiado['panel'] else 'sin panel'}",
        )
        check(
            "el cambio de tab conserva la misma velocidad",
            fiado["panel"]["name"] == "tab-panel-in"
            and seconds(fiado["panel"]["duration"]) <= 0.3,
        )
        wipe = page.evaluate(
            """() => {
              const el = document.querySelector('.tab-wipe');
              if (!el) return null;
              const s = getComputedStyle(el);
              return { name: s.animationName, duration: s.animationDuration };
            }"""
        )
        check(
            "el barrido de papel cruza en 300 ms",
            wipe is not None
            and wipe["name"] == "tab-wipe"
            and seconds(wipe["duration"]) <= 0.35,
            json.dumps(wipe, ensure_ascii=False),
        )
        page.screenshot(path=str(SHOTS / "1280-fiado.png"))

        page.locator("button:visible", has_text="Caja").first.click()
        page.wait_for_timeout(250)
        page.get_by_role("button", name="Verificar comprobante", exact=True).first.click()
        page.wait_for_selector("[role=dialog]", timeout=8000)
        page.wait_for_timeout(50)
        sheet = page.evaluate(
            """() => {
              const panel = document.querySelector('[role=dialog]');
              const backdrop = document.querySelector('.sheet-backdrop');
              const read = (el) => {
                if (!el) return null;
                const s = getComputedStyle(el);
                return { name: s.animationName, duration: s.animationDuration, opacity: s.opacity };
              };
              return { panel: read(panel), backdrop: read(backdrop) };
            }"""
        )
        check(
            "la hoja entra en 220 ms",
            sheet["panel"] is not None
            and sheet["panel"]["name"] == "sheet-in"
            and seconds(sheet["panel"]["duration"]) <= 0.3,
            json.dumps(sheet["panel"], ensure_ascii=False),
        )
        check(
            "el fondo de la hoja entra en 140 ms",
            sheet["backdrop"] is not None
            and sheet["backdrop"]["name"] == "sheet-backdrop-in"
            and seconds(sheet["backdrop"]["duration"]) <= 0.2,
            json.dumps(sheet["backdrop"], ensure_ascii=False),
        )
        page.screenshot(path=str(SHOTS / "1280-sheet.png"))
        page.keyboard.press("Escape")
        desktop.close()

        mobile = browser.new_context(
            viewport={"width": 360, "height": 800},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        page = mobile.new_page()
        page.goto(BASE, wait_until="networkidle", timeout=60000)
        page.wait_for_function("document.body.innerText.includes('Hoy $')", timeout=20000)
        page.wait_for_timeout(250)
        page.screenshot(path=str(SHOTS / "360-home.png"))
        marker = page.evaluate(
            """() => {
              const el = document.querySelector('.tab-marker');
              if (!el) return null;
              const s = getComputedStyle(el);
              return { name: s.animationName, duration: s.animationDuration };
            }"""
        )
        check(
            "el marcador del tab entra en 180 ms",
            marker is not None
            and marker["name"] == "tab-marker-in"
            and seconds(marker["duration"]) <= 0.2,
            json.dumps(marker, ensure_ascii=False),
        )
        page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
        page.wait_for_timeout(600)
        bottom = read_motion(page)
        check(
            "el scroll trigger llega al final de la veta",
            bottom["progress"] is not None
            and bottom["progress"]["timeline"].startswith("scroll(")
            and scale_x(bottom["progress"]["transform"]) > 0.9,
            json.dumps(bottom["progress"], ensure_ascii=False),
        )

        # Barrido: dura 300 ms, intercepta clics y la nav sigue por encima.
        nav = page.locator('nav[aria-label="Navegación inferior"]')
        nav.get_by_role("button", name="Fiado", exact=True).click()
        page.wait_for_timeout(500)
        abono = page.get_by_role("button", name="Registrar abono").first
        abono.scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        abono_box = abono.bounding_box()
        nav.get_by_role("button", name="Caja", exact=True).click()
        page.wait_for_timeout(500)
        # El barrido real dura 300 ms (comprobado arriba). Para que el clic de
        # prueba caiga con el papel encima, lo alargamos durante este caso.
        page.add_style_tag(content=".tab-wipe { animation-duration: 800ms !important; }")
        nav.get_by_role("button", name="Fiado", exact=True).click()
        center_x = abono_box["x"] + abono_box["width"] / 2
        center_y = abono_box["y"] + abono_box["height"] / 2
        page.wait_for_function(
            """([x]) => {
              const el = document.querySelector('.tab-wipe');
              if (!el) return false;
              const r = el.getBoundingClientRect();
              return r.left <= x && r.right >= x;
            }""",
            arg=[center_x],
            timeout=3000,
        )
        wipe_state = page.evaluate(
            """() => {
              const el = document.querySelector('.tab-wipe');
              if (!el) return null;
              const s = getComputedStyle(el);
              return { duration: s.animationDuration, pointerEvents: s.pointerEvents, zIndex: s.zIndex };
            }"""
        )
        check(
            "el wipe intercepta clics mientras existe",
            wipe_state is not None and wipe_state["pointerEvents"] == "auto",
            json.dumps(wipe_state, ensure_ascii=False),
        )
        if abono_box:
            page.mouse.click(abono_box["x"] + abono_box["width"] / 2, abono_box["y"] + abono_box["height"] / 2)
        page.wait_for_timeout(400)
        sheet_after_wipe = page.locator('[role="dialog"]').count()
        check(
            "un clic durante el wipe no abre una hoja",
            sheet_after_wipe == 0,
            f"{sheet_after_wipe} hoja(s)",
        )
        page.wait_for_timeout(500)
        check(
            "el wipe desaparece aunque no llegue animationend (timeout de seguridad)",
            page.locator(".tab-wipe").count() == 0,
        )

        page.get_by_role("button", name="Tareas (Pendientes)", exact=True).click()
        page.wait_for_timeout(300)
        pending = read_motion(page)
        check(
            "Pendientes también hace el reveal de su título",
            pending["heading"] is not None and pending["heading"]["name"] == "heading-in",
        )
        page.screenshot(path=str(SHOTS / "360-pendientes.png"))
        check(
            "sin overflow horizontal a 360 px",
            page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
        )
        mobile.close()

        reduced = browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="es-MX",
            reduced_motion="reduce",
        )
        page = reduced.new_page()
        page.goto(BASE, wait_until="networkidle", timeout=60000)
        page.wait_for_function("document.body.innerText.includes('Hoy $')", timeout=20000)
        page.wait_for_timeout(250)
        calm = read_motion(page)
        check(
            "reduced motion deja el contenido visible y sin espera",
            calm["panel"] is not None
            and seconds(calm["panel"]["duration"]) <= 0.01
            and seconds(calm["heading"]["duration"]) <= 0.01
            and float(calm["heading"]["opacity"]) == 1,
            json.dumps(calm["panel"], ensure_ascii=False),
        )
        check(
            "reduced motion apaga la veta de scroll",
            calm["progress"] is not None and calm["progress"]["name"] == "none",
        )
        reduced.close()
        browser.close()

    check("sin errores de consola", not errors, " · ".join(errors[:4]))
    passed = sum(1 for item in results if item["ok"])
    failed = len(results) - passed
    report = {
        "baseUrl": BASE,
        "code": start_code,
        "passed": passed,
        "failed": failed,
        "results": results,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{passed} PASS · {failed} FAIL · {OUT}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
