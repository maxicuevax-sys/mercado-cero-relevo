"""
Auditoría HIG de línea base — no modifica la UI.

Uso:
  python scripts/hig-audit.py

Requiere el servidor en http://localhost:3000 y axe-core descargado en
C:/Users/Elitebook 840 G8/AppData/Local/Temp/opencode/axe.min.js.
Guarda capturas y JSON en mercado-cero/demo/hig-before/.
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://localhost:3000"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "demo" / "hig-before"
OUT.mkdir(parents=True, exist_ok=True)
AXE = Path(
    r"C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\axe.min.js"
)

VIEWPORTS = [(360, 800), (390, 844), (768, 1024), (1280, 800)]
results: list[dict] = []


def shot(page, name: str, full: bool = False) -> None:
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)


def wait_text(page, text: str, timeout: int = 15000) -> bool:
    try:
        page.wait_for_selector(f"text={text}", timeout=timeout)
        return True
    except Exception:
        return False


def run_axe(page) -> dict:
    if page.evaluate("typeof axe === 'undefined'"):
        page.add_script_tag(path=str(AXE))
    return page.evaluate(
        """async () => {
            const r = await axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }
            });
            return {
                violations: r.violations.map(v => ({
                    id: v.id,
                    impact: v.impact,
                    help: v.help,
                    nodes: v.nodes.length,
                    targets: v.nodes.slice(0, 4).map(n => n.target)
                })),
                passes: r.passes.length,
                incomplete: r.incomplete.length
            };
        }"""
    )


def measure(page, label: str) -> dict:
    data = page.evaluate(
        """() => {
            const visible = (el) => {
                const r = el.getBoundingClientRect();
                const s = getComputedStyle(el);
                return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
            };
            const textEls = Array.from(document.querySelectorAll('p, span, button, a, label, h1, h2, h3, h4, dt, dd, li'))
                .filter(el => el.innerText && el.innerText.trim().length > 0 && visible(el))
                .map(el => ({
                    text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 80),
                    size: parseFloat(getComputedStyle(el).fontSize),
                    tag: el.tagName
                }));
            const targets = Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="button"]'))
                .filter(visible)
                .map(el => {
                    const r = el.getBoundingClientRect();
                    return {
                        text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 50),
                        tag: el.tagName,
                        width: Math.round(r.width),
                        height: Math.round(r.height)
                    };
                });
            const unnamed = Array.from(document.querySelectorAll('button, a, [role="button"]'))
                .filter(visible)
                .filter(el => !(el.innerText || '').trim() && !el.getAttribute('aria-label') && !el.getAttribute('title'))
                .map(el => el.outerHTML.slice(0, 120));
            const imgs = Array.from(document.querySelectorAll('img')).map(el => ({
                alt: el.getAttribute('alt'),
                src: (el.getAttribute('src') || '').slice(0, 80)
            }));
            const surface = document.querySelector('.grain');
            return {
                innerWidth: window.innerWidth,
                documentScrollWidth: document.documentElement.scrollWidth,
                surfaceScrollWidth: surface ? surface.scrollWidth : null,
                surfaceScrollLeft: surface ? Math.round(surface.scrollLeft) : null,
                headings: Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(el => ({
                    tag: el.tagName,
                    text: (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 70)
                })),
                landmarks: {
                    main: document.querySelectorAll('main').length,
                    nav: document.querySelectorAll('nav').length,
                    header: document.querySelectorAll('header').length,
                    footer: document.querySelectorAll('footer').length
                },
                dialogs: Array.from(document.querySelectorAll('[role="dialog"]')).map(el => ({
                    label: el.getAttribute('aria-label'),
                    modal: el.getAttribute('aria-modal')
                })),
                textCount: textEls.length,
                under12: textEls.filter(t => t.size < 12).slice(0, 12),
                under12Count: textEls.filter(t => t.size < 12).length,
                under14: textEls.filter(t => t.size < 14).slice(0, 12),
                under14Count: textEls.filter(t => t.size < 14).length,
                under17: textEls.filter(t => t.size < 17).slice(0, 12),
                under17Count: textEls.filter(t => t.size < 17).length,
                clippedText: Array.from(document.querySelectorAll('p, span, button, a, label, h1, h2, h3, h4, dt, dd, li'))
                    .filter(el => el.innerText && el.innerText.trim().length > 0 && visible(el))
                    .filter(el => {
                        const r = el.getBoundingClientRect();
                        return r.right > window.innerWidth + 1 || r.left < -1 ||
                            el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
                    })
                    .map(el => ({
                        text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 60),
                        tag: el.tagName
                    })).slice(0, 12),
                targetCount: targets.length,
                under44: targets.filter(t => t.width < 44 || t.height < 44).slice(0, 16),
                under44Count: targets.filter(t => t.width < 44 || t.height < 44).length,
                unnamed: unnamed.slice(0, 8),
                unnamedCount: unnamed.length,
                images: imgs
            };
        }"""
    )
    data["label"] = label
    return data


def focus_sequence(page, steps: int = 10) -> list[dict]:
    page.evaluate("document.activeElement?.blur()")
    seq = []
    for _ in range(steps):
        page.keyboard.press("Tab")
        page.wait_for_timeout(80)
        seq.append(
            page.evaluate(
                """() => {
                    const e = document.activeElement;
                    const s = getComputedStyle(e);
                    return {
                        tag: e.tagName,
                        text: (e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 50),
                        outline: `${s.outlineStyle} ${s.outlineWidth}`,
                        boxShadow: s.boxShadow.slice(0, 80),
                        inDialog: Boolean(e.closest('[role="dialog"]'))
                    };
                }"""
            )
        )
    return seq


def audit_page(page, context, viewport: tuple[int, int], full_flow: bool) -> dict:
    w, h = viewport
    prefix = f"{w}"
    page.goto(BASE, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_selector("text=Modo demo", timeout=30000)
    page.wait_for_timeout(500)

    home = measure(page, "home")
    axe_home = run_axe(page)
    shot(page, f"home-{prefix}-fold")
    if w in (360, 390):
        shot(page, f"home-{prefix}-full", full=True)

    # 200% text-only sobre la home.
    text_style = page.add_style_tag(content="html { font-size: 200% !important; }")
    page.wait_for_timeout(400)
    text200 = measure(page, "home-text-200")
    shot(page, f"home-{prefix}-text200")
    text_style.evaluate("el => el.remove()")
    page.wait_for_timeout(300)

    # Guía: foco, Escape, axe.
    page.get_by_role("button", name="Abrir guía").click()
    page.wait_for_timeout(400)
    help_metrics = measure(page, "help")
    axe_help = run_axe(page)
    shot(page, f"help-{prefix}")
    help_initial = page.evaluate(
        """() => {
            const e = document.activeElement;
            return {
                tag: e.tagName,
                text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 60),
                inDialog: Boolean(e.closest('[role="dialog"]'))
            };
        }"""
    )
    help_focus = focus_sequence(page, 8)
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    help_closed_with_escape = page.evaluate(
        "document.querySelectorAll('[role=\"dialog\"]').length === 0"
    )
    if page.locator('[role="dialog"]').count():
        page.get_by_role("button", name="Cerrar guía").click()
        page.wait_for_timeout(300)

    record = {
        "viewport": f"{w}x{h}",
        "home": home,
        "homeAxe": axe_home,
        "homeText200": text200,
        "help": help_metrics,
        "helpAxe": axe_help,
        "helpInitialFocus": help_initial,
        "helpFocus": help_focus,
        "helpClosedWithEscape": help_closed_with_escape,
    }

    if full_flow:
        page.get_by_role("link", name="Cobrar ahora").click()
        page.wait_for_timeout(500)
        record["caja"] = measure(page, "caja")
        shot(page, f"caja-{prefix}")

        page.get_by_role("button", name="Dos quesadillas de 35 y un agua de 20").click()
        page.wait_for_selector("text=2 productos", timeout=15000)
        record["draft"] = measure(page, "draft")
        page.get_by_role("button", name="Confirmar venta").click()
        page.wait_for_selector("text=Link de pago", timeout=15000)
        page.wait_for_timeout(600)
        record["payment"] = measure(page, "payment")
        shot(page, f"payment-{prefix}")

        page.get_by_role("button", name=re.compile("Link de pago")).click()
        page.wait_for_selector("text=Simular CoDi", timeout=15000)
        page.wait_for_timeout(600)
        record["link"] = measure(page, "link")
        shot(page, f"link-{prefix}")

        page.get_by_role("button", name="Simular CoDi").click()
        page.wait_for_selector("text=Pago simulado", timeout=15000)
        page.wait_for_timeout(500)
        record["paid"] = measure(page, "paid-overlay")
        record["paidDialogs"] = page.evaluate(
            "Array.from(document.querySelectorAll('[role=\"dialog\"]')).length"
        )
        record["paidInitialFocus"] = page.evaluate(
            """() => {
                const e = document.activeElement;
                return {
                    tag: e.tagName,
                    text: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 60),
                    inDialog: Boolean(e.closest('[role="dialog"]'))
                };
            }"""
        )
        record["paidFocus"] = focus_sequence(page, 6)
        shot(page, f"paid-{prefix}")
        page.get_by_role("button", name="Listo para entregar").click()
        page.wait_for_timeout(400)

        page.locator("#fiado").scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        record["fiado"] = measure(page, "fiado")
        shot(page, f"fiado-{prefix}")

        page.locator("#verificar").scroll_into_view_if_needed()
        page.get_by_role("button", name="Probar con un comprobante falso").click()
        page.wait_for_selector("text=No verificado", timeout=15000)
        page.wait_for_timeout(300)
        record["verify"] = measure(page, "verify")
        shot(page, f"verify-{prefix}")

        page.locator("#corte").scroll_into_view_if_needed()
        page.wait_for_timeout(700)
        record["corte"] = measure(page, "corte")
        shot(page, f"corte-{prefix}")

        page.locator("#meta").scroll_into_view_if_needed()
        page.wait_for_timeout(700)
        record["meta"] = measure(page, "meta")
        shot(page, f"meta-{prefix}")

    # Checkout público.
    context.request.post(f"{BASE}/api/demo/reset")
    dashboard = context.request.get(f"{BASE}/api/dashboard").json()
    pending = next(
        (o for o in dashboard["orders"] if o["status"] == "payment_pending"), None
    )
    if pending:
        page.goto(f"{BASE}/pay/{pending['id']}", wait_until="domcontentloaded", timeout=45000)
        page.wait_for_selector("text=¿Cómo quieres pagar?", timeout=20000)
        page.wait_for_timeout(400)
        record["checkout"] = measure(page, "checkout")
        record["checkoutAxe"] = run_axe(page)
        shot(page, f"checkout-{prefix}-fold")
        if w in (360, 390):
            shot(page, f"checkout-{prefix}-full", full=True)
        page.get_by_role("button", name="Pagar $120.00").click()
        page.wait_for_selector("text=Listo para entregar", timeout=20000)
        page.wait_for_timeout(400)
        record["checkoutPaid"] = measure(page, "checkout-paid")
        record["checkoutPaidAxe"] = run_axe(page)
        shot(page, f"checkout-{prefix}-paid")

    context.request.post(f"{BASE}/api/demo/reset")
    return record


def main() -> int:
    started = time.time()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for w, h in VIEWPORTS:
            print(f"\nVIEWPORT {w}x{h}")
            context = browser.new_context(
                viewport={"width": w, "height": h},
                device_scale_factor=2 if w <= 390 else 1,
                is_mobile=w <= 390,
                has_touch=w <= 390,
                locale="es-MX",
            )
            page = context.new_page()
            try:
                record = audit_page(page, context, (w, h), full_flow=w in (360, 1280))
                results.append(record)
                home = record["home"]
                print(
                    f"  scroll={home['documentScrollWidth']}/{home['innerWidth']} "
                    f"under12={home['under12Count']} under14={home['under14Count']} "
                    f"targets<44={home['under44Count']} "
                    f"axe={len(record['homeAxe']['violations'])} "
                    f"escape={record['helpClosedWithEscape']}"
                )
            except Exception as exc:
                print("  ERROR", type(exc).__name__, exc)
                results.append({"viewport": f"{w}x{h}", "error": str(exc)})
            finally:
                context.close()
        browser.close()

    report = {
        "base": BASE,
        "started": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "elapsedSeconds": round(time.time() - started, 1),
        "viewports": results,
    }
    path = OUT / "audit.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nReporte:", path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
