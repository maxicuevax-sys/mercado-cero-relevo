#!/usr/bin/env python3
"""Evidencia del hub CoDi central de /inicio (feature/codi-center).

Uso (servidor aislado, DEMO_MODE=true):
    BASE_URL=http://127.0.0.1:4590 python reports/RELEVO/codi-center/capture.py

Solo GET + el flujo demo existente (/api/orders y /api/orders/:id/pay?mode=qr
y /api/demo/pay). No toca 4580 ni 4497.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OUT = Path(__file__).resolve().parent
BASE = os.environ.get("BASE_URL", "http://localhost:4590").rstrip("/")
CHECKS: list[dict] = []
CONSOLE: list[str] = []
PAGE_ERRORS: list[str] = []


def check(name: str, ok: bool, detail: object = "") -> None:
    CHECKS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail != "" else ""))


def overflow(page) -> dict:
    return page.evaluate(
        """() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        })"""
    )


def first_screen_metrics(page, height: int) -> dict:
    return page.evaluate(
        """(vh) => {
          const box = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {top: Math.round(r.top), bottom: Math.round(r.bottom),
                    left: Math.round(r.left), right: Math.round(r.right),
                    w: Math.round(r.width), h: Math.round(r.height)};
          };
          const nav = document.querySelector(".mc-mobile-nav");
          const navBox = nav ? nav.getBoundingClientRect() : null;
          return {
            vh,
            hub: box("#cobrar-codi"),
            cta: box("#cobrar-codi .mc-codi__cta"),
            input: box("#mc-codi-amount"),
            chips: [...document.querySelectorAll("#cobrar-codi .mc-codi__chip")].map((el) => {
              const r = el.getBoundingClientRect();
              return {w: Math.round(r.width), h: Math.round(r.height)};
            }),
            nav: nav ? {top: Math.round(nav.getBoundingClientRect().top)} : null,
            navItems: [...document.querySelectorAll(".mc-mobile-nav__item")].map((el) => ({
              text: (el.innerText || "").trim(),
              sw: el.scrollWidth, cw: el.clientWidth,
              href: el.getAttribute("href") || "",
            })),
            navCenterHref: document.querySelector(".mc-mobile-nav__sale")?.getAttribute("href") || null,
            moreLinks: [...document.querySelectorAll(".mc-mobile-nav__panel a")].map((a) => ({
              href: a.getAttribute("href"),
              text: (a.innerText || "").trim(),
            })),
            docHeight: document.documentElement.scrollHeight,
          };
        }""",
        height,
    )


def collect(page) -> None:
    page.on(
        "console",
        lambda msg: CONSOLE.append(msg.text[:300]) if msg.type == "error" else None,
    )
    page.on("pageerror", lambda exc: PAGE_ERRORS.append(str(exc)[:300]))


def hub_state(page) -> dict:
    return page.evaluate(
        """() => {
          const title = document.querySelector("#mc-codi-title");
          const qr = document.querySelector(".mc-codi__figure img");
          return {
            title: title ? title.textContent.trim() : null,
            qrAlt: qr ? qr.getAttribute("alt") : null,
            qrLoaded: qr ? qr.naturalWidth > 0 : null,
            note: document.querySelector(".mc-codi__order .mc-codi__note")?.textContent.trim()
              || document.querySelector(".mc-codi__settled .mc-codi__note")?.textContent.trim()
              || null,
            body: document.querySelector("#cobrar-codi")?.textContent || "",
          };
        }"""
    )


def snap(page, name: str, full: bool = False) -> None:
    page.evaluate(
        "() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }"
    )
    page.wait_for_timeout(150)
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=full)


def scroll_hub_top(page) -> None:
    page.evaluate(
        """() => {
          const el = document.getElementById("cobrar-codi");
          if (!el) return;
          window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - 6));
        }"""
    )
    page.wait_for_timeout(300)


def run_flow(page, width: int, height: int, label: str) -> None:
    page.set_viewport_size({"width": width, "height": height})
    page.goto(BASE + "/inicio", wait_until="networkidle", timeout=60000)
    page.locator("#mc-codi-amount").wait_for()
    page.locator("#mc-codi-amount").fill("125")

    cta = page.locator("#cobrar-codi .mc-codi__form .mc-codi__cta")
    check(f"{label}: CTA cobrar habilitado", cta.is_enabled())
    cta.click()

    qr = page.locator(".mc-codi__figure img")
    qr.wait_for(state="visible", timeout=30000)
    page.wait_for_timeout(400)
    state = hub_state(page)
    check(f"{label}: QR generado con imagen cargada", state["qrLoaded"] is True, state["qrAlt"])
    check(f"{label}: estado espera de pago", state["title"] == "Esperando pago", state["title"])
    check(
        f"{label}: aviso de que el QR no es dinero",
        bool(state["note"])
        and "QR está listo" in state["note"]
        and "no es dinero recibido" in state["note"],
        state["note"],
    )
    page.locator("#cobrar-codi").scroll_into_view_if_needed()
    scroll_hub_top(page)
    snap(page, f"{label}-hub-qr")
    snap(page, f"{label}-hub-qr-full", full=True)

    simulate = page.get_by_role("button", name="Simular pago CoDi")
    check(f"{label}: simulación demo disponible", simulate.count() == 1)
    simulate.click()
    page.wait_for_function(
        "() => document.querySelector('#mc-codi-title')?.textContent?.trim() === 'Pago simulado'",
        timeout=30000,
    )
    page.wait_for_timeout(350)
    settled = hub_state(page)
    check(f"{label}: estado pago demo", settled["title"] == "Pago simulado", settled["title"])
    check(
        f"{label}: demo declara que no es dinero real",
        "No es dinero real" in settled["body"],
    )
    check(f"{label}: demo no afirma pago recibido", "Pago recibido" not in settled["body"])
    page.locator("#cobrar-codi").scroll_into_view_if_needed()
    scroll_hub_top(page)
    snap(page, f"{label}-hub-pagado-demo")
    snap(page, f"{label}-hub-pagado-demo-full", full=True)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(locale="es-MX")
        page = context.new_page()
        collect(page)

        # 1. Inicio 390x693 y 1448x1086 (estado inicial).
        for label, width, height in [("390x693", 390, 693), ("1448x1086", 1448, 1086)]:
            page.set_viewport_size({"width": width, "height": height})
            page.goto(BASE + "/inicio", wait_until="networkidle", timeout=60000)
            page.locator("#mc-codi-amount").wait_for()
            page.wait_for_timeout(400)
            ov = overflow(page)
            check(f"{label}: sin scroll horizontal", ov["sw"] == ov["cw"], ov)
            snap(page, f"inicio-{label}")
            snap(page, f"inicio-{label}-full", full=True)

            if width == 390:
                data = first_screen_metrics(page, height)
                hub, cta = data["hub"], data["cta"]
                check(
                    "390: hub CoDi visible en la primera pantalla",
                    hub is not None and hub["top"] < height and cta is not None,
                    hub,
                )
                check(
                    "390: CTA del hub sobre la barra inferior",
                    cta is not None and data["nav"] is not None and cta["bottom"] <= data["nav"]["top"],
                    {"cta": cta, "nav": data["nav"]},
                )
                check(
                    "390: targets táctiles del hub >= 44 px",
                    data["input"] is not None
                    and data["input"]["h"] >= 44
                    and all(c["h"] >= 44 for c in data["chips"])
                    and cta is not None
                    and cta["h"] >= 44,
                    {"input": data["input"], "chips": data["chips"], "cta": cta},
                )
                bad = [i for i in data["navItems"] if i["cw"] and i["sw"] > i["cw"] + 1]
                check("390: etiquetas de la barra sin recorte", not bad, bad)
                check(
                    "390: el centro de la barra es el hub CoDi",
                    data["navCenterHref"] == "/inicio#cobrar-codi",
                    data["navCenterHref"],
                )
                more_hrefs = [item["href"] for item in data["moreLinks"]]
                check(
                    "390: Pendientes/Fiados/Corte/Metas/Ventas/Ajustes en Más",
                    all(
                        href in more_hrefs
                        for href in [
                            "/fiados",
                            "/corte",
                            "/pendientes",
                            "/metas",
                            "/ventas",
                            "/ajustes",
                        ]
                    ),
                    more_hrefs,
                )
                check(
                    "390: Inicio y Movimientos en la barra",
                    any(i["href"] == "/inicio" for i in data["navItems"])
                    and any(i["href"] == "/movimientos" for i in data["navItems"]),
                    [i["href"] for i in data["navItems"]],
                )

        # 2. Flujo demo real del hub (crear pedido, QR, simular pago).
        run_flow(page, 390, 693, "390x693")

        # 3. Estado con QR a 1448 para evidencia visual (pedido nuevo).
        run_flow(page, 1448, 1086, "1448x1086")

        # 4. 320 px: sin scroll horizontal y targets del hub presentes.
        page.set_viewport_size({"width": 320, "height": 640})
        page.goto(BASE + "/inicio", wait_until="networkidle", timeout=60000)
        page.locator("#mc-codi-amount").wait_for()
        page.wait_for_timeout(350)
        ov = overflow(page)
        check("320: sin scroll horizontal", ov["sw"] == ov["cw"], ov)
        metrics = first_screen_metrics(page, 640)
        check(
            "320: input y CTA del hub >= 44 px",
            metrics["input"] is not None
            and metrics["input"]["h"] >= 44
            and metrics["cta"] is not None
            and metrics["cta"]["h"] >= 44,
            {"input": metrics["input"], "cta": metrics["cta"]},
        )
        bad = [i for i in metrics["navItems"] if i["cw"] and i["sw"] > i["cw"] + 1]
        check("320: etiquetas de la barra sin recorte", not bad, bad)
        snap(page, "inicio-320x640")

        # 5. Navegación: centro desde /metas lleva al hub; Inicio enfoca el h1.
        page.set_viewport_size({"width": 390, "height": 693})
        page.goto(BASE + "/metas", wait_until="networkidle", timeout=60000)
        page.locator(".mc-mobile-nav__sale").click()
        page.wait_for_url(re.compile(r"/inicio#cobrar-codi$"))
        check("nav: el centro lleva a /inicio#cobrar-codi", "/inicio#cobrar-codi" in page.url, page.url)

        context.close()
        browser.close()

    report = {
        "base": BASE,
        "checks": CHECKS,
        "consoleErrors": CONSOLE,
        "pageErrors": PAGE_ERRORS,
        "pass": sum(1 for c in CHECKS if c["ok"]),
        "fail": sum(1 for c in CHECKS if not c["ok"]),
    }
    (OUT / "capture-results.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nRESULTADO — {report['pass']} PASS · {report['fail']} FAIL")
    print(f"consoleErrors={len(CONSOLE)} pageErrors={len(PAGE_ERRORS)}")
    for err in CONSOLE[:5]:
        print("CONSOLE", err)
    for err in PAGE_ERRORS[:5]:
        print("PAGEERROR", err)
    return 0 if report["fail"] == 0 and not CONSOLE and not PAGE_ERRORS else 1


if __name__ == "__main__":
    raise SystemExit(main())
