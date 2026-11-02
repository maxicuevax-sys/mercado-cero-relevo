#!/usr/bin/env python3
"""HIG móvil mínimo a 320 px: overflow, texto, targets y foco.

Uso (servidor ya levantado):
  $env:MOBILE_320_BASE_URL="http://localhost:3000"
  python scripts/mobile-320-audit.py

Solo lee la app. No reinicia datos ni crea pedidos. Escribe
harness/evidence/mobile-320.json y una captura 320 px.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = (
    os.environ.get("MOBILE_320_BASE_URL")
    or os.environ.get("MOBILE_BASE_URL")
    or os.environ.get("BASE_URL")
    or "http://localhost:3000"
).rstrip("/")
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "harness" / "evidence"
SHOT = OUT / "mobile-320-home.png"

checks: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    checks.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' - ' + detail) if detail else ''}")


def measure(page) -> dict:
    return page.evaluate(
        """() => {
          const visible = (el) => {
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return s.display !== 'none' && s.visibility !== 'hidden' &&
              r.width > 0 && r.height > 0;
          };
          const smallText = [];
          for (const el of document.querySelectorAll('p,span,a,button,label,li,td,th,h1,h2,h3')) {
            if (!visible(el)) continue;
            const text = (el.innerText || '').trim();
            if (!text) continue;
            const size = parseFloat(getComputedStyle(el).fontSize);
            if (size < 12) smallText.push({tag: el.tagName, size, text: text.slice(0, 40)});
          }
          const smallTargets = [];
          for (const el of document.querySelectorAll('button,a,input,select,textarea,[role="button"]')) {
            if (!visible(el)) continue;
            const text = (el.innerText || el.getAttribute('aria-label') || '').trim();
            if (text === 'Saltar al contenido') continue;
            const r = el.getBoundingClientRect();
            if (r.width < 44 || r.height < 44) {
              smallTargets.push({tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), text: text.slice(0, 40)});
            }
          }
          return {
            innerWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            smallText,
            smallTargets,
            hash: location.hash,
          };
        }"""
    )


def no_overflow(metrics: dict) -> bool:
    return (
        metrics["scrollWidth"] <= metrics["innerWidth"] + 1
        and metrics["bodyScrollWidth"] <= metrics["innerWidth"] + 1
    )


def main() -> int:
    started = time.time()
    errors: list[str] = []
    page_errors: list[str] = []
    records: dict[str, dict] = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 320, "height": 720},
            locale="es-MX",
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.on(
            "console",
            lambda message: errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        page.goto(BASE, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_selector("h1:has-text('Caja')", timeout=30000)
        page.wait_for_function(
            "document.body.innerText.includes('Hoy $')", timeout=30000
        )
        page.wait_for_timeout(400)
        records["home"] = measure(page)
        page.screenshot(path=str(SHOT))
        check("home carga a 320 px", True, BASE)
        check("home sin scroll horizontal", no_overflow(records["home"]))
        check(
            "home sin texto visible menor a 12 px",
            len(records["home"]["smallText"]) == 0,
            f"{len(records['home']['smallText'])} bloques",
        )
        check(
            "home con targets de al menos 44 px",
            len(records["home"]["smallTargets"]) == 0,
            f"{len(records['home']['smallTargets'])} targets",
        )

        page.locator('button[title="Ayuda y accesibilidad"]').first.click()
        page.wait_for_selector("[role=dialog]", timeout=10000)
        page.wait_for_timeout(250)
        records["help"] = measure(page)
        check("ayuda sin scroll horizontal", no_overflow(records["help"]))
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)

        page.get_by_role("button", name="Meta", exact=True).first.click()
        page.wait_for_selector("text=Mi camino", timeout=10000)
        page.wait_for_timeout(250)
        records["meta"] = measure(page)
        check("meta sin scroll horizontal", no_overflow(records["meta"]))

        page.locator('button[title="Corte de caja"]').first.click()
        page.wait_for_selector("text=Corte de caja", timeout=10000)
        page.wait_for_timeout(250)
        records["corte"] = measure(page)
        check("corte sin scroll horizontal", no_overflow(records["corte"]))

        page.keyboard.press("Tab")
        focus = page.evaluate(
            """() => {
              const el = document.activeElement;
              if (!el) return null;
              const s = getComputedStyle(el);
              return {
                tag: el.tagName,
                text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 40),
                outlineStyle: s.outlineStyle,
                outlineWidth: s.outlineWidth,
              };
            }"""
        )
        width = float((focus or {}).get("outlineWidth", "0px").replace("px", ""))
        check(
            "foco visible de al menos 2 px",
            bool(focus)
            and focus["outlineStyle"] != "none"
            and width >= 2,
            json.dumps(focus, ensure_ascii=False),
        )
        check("sin errores de consola", len(errors) == 0, "; ".join(errors[:3]))
        check("sin pageerrors", len(page_errors) == 0, "; ".join(page_errors[:3]))

        browser.close()

    passed = sum(1 for item in checks if item["ok"])
    failed = len(checks) - passed
    report = {
        "baseUrl": BASE,
        "viewport": "320x720",
        "elapsedSeconds": round(time.time() - started, 1),
        "checks": checks,
        "records": records,
        "consoleErrors": errors,
        "pageErrors": page_errors,
        "passed": passed,
        "failed": failed,
        "total": len(checks),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "mobile-320.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("")
    if failed == 0:
        print(f"MOBILE 320 OK: {passed}/{len(checks)} checks")
        return 0
    print(f"MOBILE 320 FAIL: {passed}/{len(checks)} en verde")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
