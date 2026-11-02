#!/usr/bin/env python3
"""Alto contraste: axe, foco visible y 360 px sin overflow.

Uso (servidor ya levantado):
  $env:CONTRAST_BASE_URL="http://localhost:3000"
  python scripts/a11y-contrast.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.environ.get(
    "CONTRAST_BASE_URL", os.environ.get("BASE_URL", "http://localhost:3000")
).rstrip("/")
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "harness" / "evidence" / "a11y-contrast.json"
SHOT = ROOT / "harness" / "evidence" / "a11y-contrast-360.png"
AXE = Path(r"C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\axe.min.js")
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


PLACEHOLDER_JS = """() => {
  const parse = (value) => {
    const m = String(value || '').match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map(v => parseFloat(v.trim()));
    if (p.length < 3) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a),
                               g: fg.g * fg.a + bg.g * (1 - fg.a),
                               b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lum = (c) => {
    const ch = (v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const bgOf = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a >= 0.95) return c;
      node = node.parentElement;
    }
    return parse(getComputedStyle(document.documentElement).backgroundColor)
        || parse(getComputedStyle(document.body).backgroundColor)
        || { r: 255, g: 255, b: 255, a: 1 };
  };
  const rows = [];
  for (const el of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none') continue;
    const raw = getComputedStyle(el, '::placeholder').color;
    const fg = parse(raw);
    if (!fg) continue;
    const bg = bgOf(el);
    const cr = ratio(blend(fg, bg), bg);
    rows.push({ text: (el.getAttribute('placeholder') || '').slice(0, 40), color: raw,
                bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
                ratio: Math.round(cr * 100) / 100 });
  }
  return rows;
}"""


def check_placeholders(page, mode: str) -> None:
    rows = page.evaluate(PLACEHOLDER_JS)
    failures = [row for row in rows if row["ratio"] < 4.5]
    check(
        f"placeholders ≥4.5:1 en {mode}",
        not failures,
        json.dumps(failures[:5] if failures else rows[:3], ensure_ascii=False),
    )


def main() -> int:
    start_code = {
        "commit": git_value("rev-parse", "HEAD"),
        "branch": git_value("rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": bool(git_value("status", "--porcelain")),
    }
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.add_init_script(
            """try { localStorage.setItem("mercado-cero:contrast", "high"); } catch (error) {}"""
        )
        errors: list[str] = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(BASE, wait_until="networkidle", timeout=60000)
        page.wait_for_function(
            "() => document.documentElement.dataset.contrast === 'high'", timeout=20000
        )
        page.wait_for_function("() => document.body.innerText.includes('Hoy $')", timeout=20000)
        page.wait_for_timeout(350)

        check(
            "el alto contraste está activo",
            page.evaluate("document.documentElement.dataset.contrast") == "high",
        )
        check(
            "sin overflow horizontal a 360 px",
            page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
            str(page.evaluate("[document.documentElement.scrollWidth, innerWidth]")),
        )

        if AXE.exists():
            page.add_script_tag(path=str(AXE))
            axe = page.evaluate(
                """async () => {
                  const r = await axe.run(document, {
                    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }
                  });
                  return {
                    violations: r.violations.map(v => ({
                      id: v.id, impact: v.impact, nodes: v.nodes.length,
                      targets: v.nodes.slice(0, 3).map(n => n.target)
                    }))
                  };
                }"""
            )
            serious = [
                v for v in axe["violations"] if v.get("impact") in ("serious", "critical")
            ]
            check(
                "axe sin violaciones serias en alto contraste",
                not serious,
                json.dumps(serious[:4], ensure_ascii=False),
            )
        else:
            check("axe disponible", False, str(AXE))

        check_placeholders(page, "alto contraste")

        page.keyboard.press("Tab")
        focus = page.evaluate(
            """() => {
              const el = document.activeElement;
              if (!el) return null;
              const s = getComputedStyle(el);
              return {
                tag: el.tagName,
                text: (el.innerText || "").slice(0, 40),
                outlineStyle: s.outlineStyle,
                outlineWidth: s.outlineWidth,
                outlineColor: s.outlineColor,
              };
            }"""
        )
        check(
            "el foco es visible en alto contraste",
            focus is not None
            and focus["outlineStyle"] != "none"
            and float(focus["outlineWidth"].replace("px", "")) >= 2,
            json.dumps(focus, ensure_ascii=False),
        )
        page.screenshot(path=str(SHOT))
        check("sin errores de consola", not errors, " · ".join(errors[:3]))
        context.close()

        # Placeholders en el tema normal (sin localStorage de alto contraste).
        normal = browser.new_context(
            viewport={"width": 360, "height": 800},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        normal_page = normal.new_page()
        normal_page.goto(BASE, wait_until="networkidle", timeout=60000)
        normal_page.wait_for_function(
            "() => document.body.innerText.includes('Hoy $')", timeout=20000
        )
        normal_page.wait_for_timeout(300)
        check_placeholders(normal_page, "tema normal")
        normal.close()
        browser.close()

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
    if failed == 0:
        print(f"CONTRAST OK: {passed} PASS · 0 FAIL")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
