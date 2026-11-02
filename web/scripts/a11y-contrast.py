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

BASE = os.environ.get("CONTRAST_BASE_URL", "http://localhost:3000").rstrip("/")
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
            "document.documentElement.dataset.contrast === 'high'", timeout=20000
        )
        page.wait_for_function("document.body.innerText.includes('Hoy $')", timeout=20000)
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
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
