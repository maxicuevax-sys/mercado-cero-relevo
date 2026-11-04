from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(r"C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero")
OUT = ROOT / "quality-reports" / "mercado-cero-final" / "14_EVIDENCIAS" / "variantes"
AXE = ROOT / "web" / "node_modules" / "axe-core" / "axe.min.js"
BASE = os.environ.get("BASE_URL", "http://localhost:3100")

AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]

VARIANTS = [
    ("desktop-1448x1086", 1448, 1086, 1, None, None),
    ("laptop-1366x768", 1366, 768, 1, None, None),
    ("mobile-390x844", 390, 844, 1, None, None),
    ("mobile-320x640", 320, 640, 1, None, None),
    ("zoom-200-724x543", 724, 543, 2, None, None),
    ("texto-grande-1448x1086", 1448, 1086, 1, "large", None),
    ("texto-muy-grande-1448x1086", 1448, 1086, 1, "xlarge", None),
    ("texto-muy-grande-390x844", 390, 844, 1, "xlarge", None),
    ("alto-contraste-1448x1086", 1448, 1086, 1, None, "high"),
    ("alto-contraste-390x844", 390, 844, 1, None, "high"),
]


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


def choose_text_size(page, value: str | None) -> None:
    if value is None:
        return
    page.evaluate(
        """(value) => {
          try { localStorage.setItem("mercado-cero:text-size", value); } catch {}
        }""",
        value,
    )
    page.reload(wait_until="networkidle")
    wait_ready(page)


def choose_contrast(page, value: str | None) -> None:
    if value is None:
        return
    page.evaluate(
        """(value) => {
          try { localStorage.setItem("mercado-cero:contrast", value); } catch {}
        }""",
        value,
    )
    page.reload(wait_until="networkidle")
    wait_ready(page)


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
          const h1 = q("h1").find(visible);
          const h2 = q(".inicio-hero h2").find(visible);
          const nav = q(".inicio-nav__item").find(visible);
          const value = q(".inicio-kpi__value").find(visible);
          const cta = q(".inicio-hero__cta").find(visible);
          const style = (el) => el ? getComputedStyle(el) : null;
          const css = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop) : null;
          return {
            url: location.href,
            h1: text(h1),
            h1Size: css(h1, "font-size"),
            h2Size: css(h2, "font-size"),
            navSize: css(nav, "font-size"),
            kpiValueSize: css(value, "font-size"),
            ctaSize: css(cta, "font-size"),
            rootSize: getComputedStyle(document.documentElement).fontSize,
            contrast: document.documentElement.dataset.contrast || "normal",
            textSize: document.documentElement.dataset.textSize || "normal",
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            bodyHeight: document.body.scrollHeight,
            viewport: {w: innerWidth, h: innerHeight},
            hero: rect(document.querySelector(".inicio-hero")),
            pending: rect(document.querySelector(".inicio-pending")),
            suggestion: rect(document.querySelector(".inicio-suggestion")),
            cta: rect(document.querySelector(".inicio-hero__cta")),
            sidebar: rect(document.querySelector(".inicio-sidebar")),
            topbar: rect(document.querySelector(".inicio-topbar")),
            kpis: q(".inicio-kpi").map(rect),
            skip: rect(document.querySelector(".inicio-skip")),
            sidebarColor: css(document.querySelector(".inicio-sidebar"), "background-color"),
            sidebarText: css(document.querySelector(".inicio-nav__item"), "color"),
            activeBg: css(document.querySelector(".inicio-nav__item[aria-current='page']"), "background-color"),
            activeText: css(document.querySelector(".inicio-nav__item[aria-current='page']"), "color"),
            heroBg: css(document.querySelector(".inicio-hero"), "background-color"),
            heroText: css(document.querySelector(".inicio-hero h2"), "color"),
          };
        }
        """
    )


def axe(page) -> dict:
    page.add_script_tag(content=AXE.read_text(encoding="utf-8"))
    return page.evaluate(
        """
        async (tags) => {
          const r = await axe.run(document, {
            runOnly: {type: "tag", values: tags},
            resultTypes: ["violations"],
          });
          return {
            violations: r.violations.map((v) => ({
              id: v.id, impact: v.impact, help: v.help,
              nodes: v.nodes.map((n) => ({target: n.target, html: (n.html||"").slice(0,400), failureSummary: n.failureSummary})),
            })),
          };
        }
        """,
        AXE_TAGS,
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    summary = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, width, height, dpr, text_size, contrast in VARIANTS:
            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=dpr,
                locale="es-MX",
                timezone_id="America/Mexico_City",
                color_scheme="light",
                reduced_motion="reduce",
            )
            page = context.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            entry = {"name": name, "viewport": [width, height], "dpr": dpr, "textSize": text_size, "contrast": contrast}
            try:
                page.goto(BASE + "/inicio", wait_until="networkidle", timeout=60_000)
                wait_ready(page)
                choose_text_size(page, text_size)
                choose_contrast(page, contrast)
                wait_ready(page)
                entry["metrics"] = measure(page)
                entry["axe"] = axe(page)
                entry["pageErrors"] = errors
                page.screenshot(path=str(OUT / f"{name}.png"), full_page=False)

                if contrast == "high":
                    page.focus(".inicio-nav__item[aria-current='page']")
                    page.wait_for_timeout(150)
                    entry["focus"] = page.evaluate(
                        """() => {
                          const el = document.activeElement;
                          const st = el ? getComputedStyle(el) : null;
                          return {text: el?.innerText || "", outline: st?.outline || "", outlineColor: st?.outlineColor || ""};
                        }"""
                    )
                    page.screenshot(path=str(OUT / f"{name}-focus.png"), full_page=False)
                    page.evaluate("document.activeElement && document.activeElement.blur()")

                (OUT / f"{name}.json").write_text(
                    json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8"
                )
            except Exception as exc:  # noqa: BLE001
                entry["error"] = repr(exc)
            finally:
                context.close()
                summary.append(entry)
                print(name, entry.get("error", "ok"))
        browser.close()
    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", OUT / "summary.json")


if __name__ == "__main__":
    main()
