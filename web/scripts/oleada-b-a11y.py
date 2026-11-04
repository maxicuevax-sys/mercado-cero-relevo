#!/usr/bin/env python3
"""Auditoría de accesibilidad de Oleada B para /caja y /ventas (Chromium + axe)."""
from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
AXE = ROOT / "web" / "node_modules" / "axe-core" / "axe.min.js"
OUT = Path(os.environ.get("OLEADA_B_OUT", ROOT / "quality-reports" / "oleada-b"))
OUT.mkdir(parents=True, exist_ok=True)


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


def measure(page) -> dict:
    return page.evaluate(
        """() => {
          const visible = (el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
          };
          const controls = [...document.querySelectorAll("button, input, select, textarea, summary, .mc-mobile-nav a, .inicio-nav a")]
            .filter(visible)
            .map((el) => {
              const r = el.getBoundingClientRect();
              return {tag: el.tagName, text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height)};
            });
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            h1: document.querySelector("h1")?.innerText || "",
            main: document.querySelectorAll("main").length,
            skip: document.querySelectorAll(".inicio-skip").length,
            currentVisible: [...document.querySelectorAll("[aria-current='page']")].filter(visible).length,
            under44: controls.filter((c) => c.h < 44 || c.w < 44),
            controls: controls.length,
          };
        }"""
    )


def main() -> int:
    report: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for path in ["/caja", "/ventas"]:
            for width, height, label in [(1448, 1086, "1448x1086"), (1366, 768, "1366x768"), (390, 844, "390x844"), (320, 640, "320x640")]:
                page = browser.new_page(viewport={"width": width, "height": height}, locale="es-MX")
                page.goto(BASE + "/inicio", wait_until="domcontentloaded")
                page.evaluate("localStorage.removeItem('mercado-cero:text-size'); localStorage.removeItem('mercado-cero:contrast')")
                page.goto(BASE + path, wait_until="networkidle")
                page.wait_for_timeout(500)
                normal = measure(page)
                normal["axe"] = axe(page)
                page.evaluate("localStorage.setItem('mercado-cero:contrast','high')")
                page.reload(wait_until="networkidle")
                page.wait_for_timeout(400)
                high = measure(page)
                high["axe"] = axe(page)
                page.evaluate("localStorage.removeItem('mercado-cero:contrast'); localStorage.setItem('mercado-cero:text-size','xlarge')")
                page.reload(wait_until="networkidle")
                page.wait_for_timeout(400)
                page.evaluate("document.documentElement.style.fontSize='32px'")
                page.wait_for_timeout(250)
                zoom = measure(page)
                report.append({"path": path, "viewport": label, "normal": normal, "highContrast": high, "zoom200": zoom})
                print(path, label, "axe", len(normal["axe"]), "hc", len(high["axe"]), "under44", len(normal["under44"]), "zoom", zoom["scrollWidth"], zoom["clientWidth"])
                page.close()
        browser.close()
    (OUT / "a11y.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
