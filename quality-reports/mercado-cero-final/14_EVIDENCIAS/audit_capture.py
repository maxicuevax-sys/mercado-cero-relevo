from __future__ import annotations

import json
import os
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(r"C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero")
OUT = ROOT / "quality-reports" / "mercado-cero-final" / "14_EVIDENCIAS"
AXE = ROOT / "web" / "node_modules" / "axe-core" / "axe.min.js"
BASE = os.environ.get("BASE_URL", "http://localhost:3100")

ROUTES = [
    ("inicio", "/inicio"),
    ("caja", "/"),
    ("fiado", "/?tab=fiado"),
    ("corte", "/?tab=corte"),
    ("meta", "/?tab=meta"),
    ("pendientes", "/?tab=pendientes"),
]

VIEWPORTS = [
    ("desktop-1448x1086", 1448, 1086),
    ("mobile-390x844", 390, 844),
]

AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]


def safe_name(value: str) -> str:
    return "".join(c if c.isalnum() or c in "-_." else "-" for c in value)


def wait_ready(page) -> None:
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts.ready.then(() => true)")
    page.wait_for_timeout(500)
    page.add_style_tag(
        content="""
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          caret-color: transparent !important;
        }
        """
    )
    page.wait_for_timeout(150)


def measure(page) -> dict:
    return page.evaluate(
        """
        () => {
          const q = (s) => Array.from(document.querySelectorAll(s));
          const rect = (el) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)};
          };
          const visible = (el) => {
            const r = el.getBoundingClientRect();
            const st = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
          };
          const text = (el) => (el?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 160);
          const buttons = q("button").filter(visible);
          const links = q("a").filter(visible);
          const h1 = q("h1").find(visible);
          const active = q("[aria-current='page'],[aria-current='true']").map(text);
          const skips = q("a[href^='#']").map((a) => text(a)).filter(Boolean);
          const inputs = q("input,textarea,select").filter(visible);
          return {
            url: location.href,
            title: document.title,
            h1: text(h1),
            active: active,
            skipLinks: skips,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            bodyHeight: document.body.scrollHeight,
            viewport: {w: innerWidth, h: innerHeight},
            buttons: buttons.length,
            links: links.length,
            inputs: inputs.length,
            buttonLabels: buttons.map(text).filter(Boolean).slice(0, 30),
            linkLabels: links.map(text).filter(Boolean).slice(0, 30),
            kpis: q("[class*='inicio-kpi']").map(rect),
            hero: rect(document.querySelector(".inicio-hero")),
            pending: rect(document.querySelector(".inicio-pending")),
            suggestion: rect(document.querySelector(".inicio-suggestion")),
            cta: rect(document.querySelector(".inicio-hero__cta")),
            main: rect(document.querySelector("main")),
            sidebar: rect(document.querySelector(".inicio-sidebar, .app-sidebar")),
            fontStatus: document.fonts.status,
            navItems: q("nav button, nav a").filter(visible).map(text).filter(Boolean).slice(0, 30),
            hasForm: q("form").length,
            hasQR: q("canvas, svg[aria-label*='QR' i], img[alt*='QR' i]").length,
            demoText: (document.body.innerText.match(/demo/gi) || []).length,
            bodyText: (document.body.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 500),
          };
        }
        """
    )


def focus_order(page, count: int = 8) -> list[dict]:
    page.evaluate("document.body.focus(); document.activeElement.blur();")
    result = []
    for _ in range(count):
        page.keyboard.press("Tab")
        result.append(
            page.evaluate(
                """
                () => {
                  const el = document.activeElement;
                  if (!el) return {tag: "NONE"};
                  const r = el.getBoundingClientRect();
                  return {
                    tag: el.tagName,
                    text: (el.innerText || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim().slice(0, 120),
                    role: el.getAttribute("role"),
                    href: el.getAttribute("href"),
                    name: el.getAttribute("name"),
                    rect: {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)},
                  };
                }
                """
            )
        )
    return result


def run_axe(page, label: str) -> dict:
    page.add_script_tag(content=AXE.read_text(encoding="utf-8"))
    result = page.evaluate(
        """
        async (tags) => {
          const r = await axe.run(document, {
            runOnly: {type: "tag", values: tags},
            resultTypes: ["violations"],
          });
          return {
            violations: r.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              help: v.help,
              helpUrl: v.helpUrl,
              nodes: v.nodes.map((n) => ({
                target: n.target,
                html: (n.html || "").slice(0, 500),
                failureSummary: n.failureSummary,
              })),
            })),
            passes: r.passes.length,
            incomplete: r.incomplete.length,
            inapplicable: r.inapplicable.length,
          };
        }
        """,
        AXE_TAGS,
    )
    result["label"] = label
    result["tags"] = AXE_TAGS
    return result


def main() -> None:
    OUT.joinpath("capturas").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("axe").mkdir(parents=True, exist_ok=True)
    OUT.joinpath("metricas").mkdir(parents=True, exist_ok=True)
    summary = {"base": BASE, "axe_tags": AXE_TAGS, "routes": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for route_name, route in ROUTES:
            for viewport_name, width, height in VIEWPORTS:
                label = f"{route_name}-{viewport_name}"
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=1,
                    locale="es-MX",
                    timezone_id="America/Mexico_City",
                    color_scheme="light",
                    reduced_motion="no-preference",
                )
                page = context.new_page()
                console_errors = []
                page_errors = []
                failed = []
                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
                page.on("pageerror", lambda exc: page_errors.append(str(exc)))
                page.on("requestfailed", lambda req: failed.append({"url": req.url, "failure": req.failure}))
                entry = {"route": route_name, "path": route, "viewport": viewport_name}
                try:
                    response = page.goto(BASE + route, wait_until="networkidle", timeout=60_000)
                    entry["status"] = response.status if response else None
                    wait_ready(page)
                    entry["metrics"] = measure(page)
                    entry["focusOrder"] = focus_order(page)
                    page.evaluate("document.activeElement && document.activeElement.blur()")
                    page.wait_for_timeout(100)
                    entry["axe"] = run_axe(page, label)
                    entry["consoleErrors"] = console_errors[:20]
                    entry["pageErrors"] = page_errors[:20]
                    entry["failedRequests"] = failed[:20]

                    page.screenshot(
                        path=str(OUT / "capturas" / f"{label}-viewport.png"),
                        full_page=False,
                    )
                    page.screenshot(
                        path=str(OUT / "capturas" / f"{label}-full.png"),
                        full_page=True,
                    )
                    (OUT / "axe" / f"{label}.json").write_text(
                        json.dumps(entry["axe"], ensure_ascii=False, indent=2), encoding="utf-8"
                    )
                    (OUT / "metricas" / f"{label}.json").write_text(
                        json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8"
                    )

                    # High contrast pass: reload so the inline forced-colors
                    # bootstrap runs before paint, as it does for a real user.
                    page.emulate_media(forced_colors="active")
                    page.reload(wait_until="networkidle")
                    wait_ready(page)
                    hc = run_axe(page, f"{label}-hc")
                    entry["axeHighContrast"] = hc
                    entry["metricsHighContrast"] = measure(page)
                    page.screenshot(
                        path=str(OUT / "capturas" / f"{label}-hc-viewport.png"),
                        full_page=False,
                    )
                    (OUT / "axe" / f"{label}-hc.json").write_text(
                        json.dumps(hc, ensure_ascii=False, indent=2), encoding="utf-8"
                    )
                    (OUT / "metricas" / f"{label}.json").write_text(
                        json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8"
                    )
                except Exception as exc:  # noqa: BLE001
                    entry["error"] = repr(exc)
                    entry["consoleErrors"] = console_errors[:20]
                    entry["pageErrors"] = page_errors[:20]
                    entry["failedRequests"] = failed[:20]
                finally:
                    context.close()
                    summary["routes"].append(entry)
                    print(label, entry.get("status"), entry.get("error", ""))

        browser.close()

    (OUT / "metricas" / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("wrote", OUT / "metricas" / "summary.json")


if __name__ == "__main__":
    main()
