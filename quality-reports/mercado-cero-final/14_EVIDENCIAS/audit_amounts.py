from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(r"C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero")
OUT = ROOT / "quality-reports" / "mercado-cero-final" / "14_EVIDENCIAS" / "montos"
BASE = os.environ.get("BASE_URL", "http://localhost:3100")
OUT.mkdir(parents=True, exist_ok=True)

CASES = [
    ("1448", 1448, 1086, None),
    ("1366", 1366, 768, None),
    ("1281", 1281, 900, None),
    ("1280", 1280, 900, None),
    ("1200", 1200, 900, None),
    ("1101", 1101, 900, None),
    ("390", 390, 844, None),
    ("320", 320, 640, None),
    ("390-xlarge", 390, 844, "xlarge"),
    ("1448-xlarge", 1448, 1086, "xlarge"),
]


def main() -> None:
    rows = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, width, height, size in CASES:
            context = browser.new_context(viewport={"width": width, "height": height}, locale="es-MX")
            page = context.new_page()
            page.goto(BASE + "/inicio", wait_until="networkidle")
            if size:
                page.evaluate("(s) => { localStorage.setItem('mercado-cero:text-size', s); }", size)
                page.reload(wait_until="networkidle")
            page.evaluate("document.fonts.ready.then(() => true)")
            page.wait_for_timeout(400)
            page.evaluate(
                """() => {
                  document.querySelectorAll('.inicio-kpi__value').forEach((el, i) => {
                    el.textContent = i === 3 ? '100%' : '$1,245.00';
                  });
                }"""
            )
            page.wait_for_timeout(100)
            data = page.evaluate(
                """() => Array.from(document.querySelectorAll('.inicio-kpi__value')).map((el) => {
                  const r = el.getBoundingClientRect();
                  const p = el.parentElement.getBoundingClientRect();
                  return {text: el.textContent, w: Math.round(r.width), h: Math.round(r.height), cardW: Math.round(p.width), overflow: el.scrollWidth > el.clientWidth + 1, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth};
                })"""
            )
            rows.append({"case": name, "viewport": [width, height], "textSize": size or "normal", "kpis": data})
            page.screenshot(path=str(OUT / f"montos-{name}.png"), full_page=False)
            context.close()
        browser.close()
    (OUT / "resumen.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    for row in rows:
        print(row["case"], row["textSize"], [(k["text"], k["overflow"], k["scrollWidth"], k["clientWidth"]) for k in row["kpis"]])


if __name__ == "__main__":
    main()
