#!/usr/bin/env python3
"""Sonda de onboarding para /caja y /ventas (solo lectura de producto).

Genera inventario de controles, textos y capturas en EVIDENCIAS/onboarding-*.
No modifica el repositorio ni el codigo; usa el servidor demo en 3100.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
OUT = Path(__file__).resolve().parent
DRAFT_KEYS = [
    "mercado-cero:caja-draft:v2",
    "mercado-cero:caja-pending:v2",
    "mercado-cero:caja-request:v2",
]


def clear_draft(page) -> None:
    page.goto(BASE + "/inicio", wait_until="domcontentloaded")
    page.evaluate(
        "(keys) => keys.forEach((k) => localStorage.removeItem(k))", DRAFT_KEYS
    )


def inventory(page, name: str) -> dict:
    data = page.evaluate(
        """() => {
          const visible = (el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
          };
          const txt = (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
          const all = [...document.querySelectorAll('button, a, input, select, textarea, summary')];
          const controls = all.filter(visible).map((el, i) => ({
            i,
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type'),
            name: el.getAttribute('name'),
            id: el.id || null,
            label: (el.getAttribute('aria-label') || el.getAttribute('placeholder') || txt(el) || '').slice(0, 160),
            role: el.getAttribute('role'),
            disabled: el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true',
            required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
            tabIndex: el.tabIndex,
            x: Math.round(el.getBoundingClientRect().x),
            y: Math.round(el.getBoundingClientRect().y),
            w: Math.round(el.getBoundingClientRect().width),
            h: Math.round(el.getBoundingClientRect().height),
          }));
          const fields = [...document.querySelectorAll('input, select, textarea')].filter(visible).map((el) => {
            const lab = el.labels && el.labels.length ? [...el.labels].map(txt).join(' | ') : '';
            return {
              id: el.id || null,
              label: lab.slice(0, 160),
              value: el.value,
              placeholder: el.getAttribute('placeholder'),
              inputMode: el.getAttribute('inputmode'),
              type: el.getAttribute('type') || 'text',
              disabled: el.matches(':disabled'),
            };
          });
          const headings = [...document.querySelectorAll('h1,h2,h3')].filter(visible).map((h) => ({tag: h.tagName, text: txt(h)}));
          const alerts = [...document.querySelectorAll('[role=alert], [role=status], [aria-live]')].filter(visible).map((el) => ({role: el.getAttribute('role'), live: el.getAttribute('aria-live'), text: txt(el).slice(0,300)}));
          const body = txt(document.querySelector('main') || document.body);
          return {url: location.href, title: document.title, controls, fields, headings, alerts, mainText: body};
        }"""
    )
    (OUT / f"onboarding-{name}.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT / f"onboarding-{name}.txt").write_text(
        data["mainText"] + "\n", encoding="utf-8"
    )
    return data


def shot(page, name: str, full: bool = False) -> None:
    page.screenshot(path=str(OUT / f"onboarding-{name}.png"), full_page=full)
    print("shot", name)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1448, "height": 1086}, locale="es-MX"
        )
        page = ctx.new_page()
        console = []
        page.on("console", lambda m: console.append(f"{m.type}: {m.text}"))
        page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))

        clear_draft(page)
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(300)

        empty = inventory(page, "caja-vacia-1448")
        shot(page, "caja-vacia-1448")

        # Foco y orden de tabulacion desde el inicio.
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(300)
        seq = []
        for _ in range(18):
            page.keyboard.press("Tab")
            seq.append(
                page.evaluate(
                    """() => {
                      const el = document.activeElement;
                      if (!el) return null;
                      const lab = el.labels && el.labels.length ? [...el.labels].map((l)=>l.innerText.replace(/\\s+/g,' ').trim()).join(' | ') : '';
                      return {
                        tag: el.tagName.toLowerCase(),
                        id: el.id || null,
                        text: (el.innerText || el.value || el.getAttribute('aria-label') || lab || '').replace(/\\s+/g,' ').trim().slice(0,120),
                        label: lab.slice(0,120)
                      };
                    }"""
                )
            )
        (OUT / "onboarding-tab-order.json").write_text(
            json.dumps(seq, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        # Alta de un producto y estado en curso.
        page.get_by_label("Producto o servicio").fill("Quesadilla")
        page.get_by_label("Cantidad").first.fill("2")
        page.get_by_label("Precio unitario").fill("35")
        page.get_by_role("button", name="Agregar", exact=True).click()
        page.wait_for_timeout(250)
        after_add = inventory(page, "caja-tras-agregar")
        shot(page, "caja-tras-agregar")
        focused_after_add = page.evaluate(
            """() => {
              const el = document.activeElement;
              return {tag: el?.tagName, id: el?.id, value: el?.value, label: el?.labels?.[0]?.innerText};
            }"""
        )

        # Efectivo insuficiente.
        page.get_by_label("Efectivo recibido").fill("50")
        page.wait_for_timeout(200)
        cash_short = inventory(page, "caja-efectivo-insuficiente")
        shot(page, "caja-efectivo-insuficiente")
        confirm_state = page.locator(".mc-caja-confirm").evaluate(
            "(el) => ({text: el.innerText, disabled: el.disabled})"
        )

        # Efectivo con cambio.
        page.get_by_label("Efectivo recibido").fill("100")
        page.wait_for_timeout(200)
        cash_change = inventory(page, "caja-efectivo-cambio")
        shot(page, "caja-efectivo-cambio")

        # Confirmar venta en efectivo.
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(700)
        cash_result = inventory(page, "caja-resultado-efectivo")
        shot(page, "caja-resultado-efectivo")

        # Fiado puro (nueva venta).
        page.get_by_role("button", name="Nueva venta").click()
        page.wait_for_timeout(200)
        page.get_by_label("Producto o servicio").fill("Pedido fiado")
        page.get_by_label("Precio unitario").fill("100")
        page.get_by_role("button", name="Agregar", exact=True).click()
        page.get_by_role("button", name="Fiado", exact=True).click()
        page.wait_for_timeout(200)
        credit_form = inventory(page, "caja-fiado-formulario")
        page.get_by_label("¿Quién queda a deber?").fill("Juan")
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(700)
        credit_result = inventory(page, "caja-resultado-fiado")
        shot(page, "caja-resultado-fiado")

        # Digital pendiente (nueva venta).
        page.get_by_role("button", name="Nueva venta").click()
        page.wait_for_timeout(200)
        page.get_by_label("Producto o servicio").fill("Cobro digital")
        page.get_by_label("Precio unitario").fill("50")
        page.get_by_role("button", name="Agregar", exact=True).click()
        page.get_by_role("button", name="Digital", exact=True).click()
        page.wait_for_timeout(200)
        page.locator(".mc-caja-confirm").click()
        page.wait_for_timeout(700)
        digital_pending = inventory(page, "caja-digital-pendiente-sin-link")
        shot(page, "caja-digital-pendiente-sin-link")
        page.get_by_role("button", name="Generar link").click()
        page.wait_for_timeout(900)
        digital_link = inventory(page, "caja-digital-pendiente-con-link")
        shot(page, "caja-digital-pendiente-con-link")

        # Confirmar que el pendiente secuestra /caja al volver.
        page.goto(BASE + "/inicio", wait_until="domcontentloaded")
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(700)
        returned = inventory(page, "caja-regreso-con-pendiente")
        shot(page, "caja-regreso-con-pendiente")

        # Ventas escritorio.
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(300)
        ventas = inventory(page, "ventas-1448")
        shot(page, "ventas-1448")
        shot(page, "ventas-1448-full", full=True)

        # Ventas mobile 320 y 390.
        for name, width, height in [("320", 320, 640), ("390", 390, 844)]:
            page.set_viewport_size({"width": width, "height": height})
            page.goto(BASE + "/ventas", wait_until="networkidle")
            page.wait_for_timeout(250)
            inventory(page, f"ventas-{name}")
            shot(page, f"ventas-{name}")

        # Caja mobile 320 (vacia y con producto).
        page.set_viewport_size({"width": 320, "height": 640})
        clear_draft(page)
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(300)
        inventory(page, "caja-vacia-320")
        shot(page, "caja-vacia-320")
        page.get_by_label("Producto o servicio").fill("Quesadilla")
        page.get_by_label("Precio unitario").fill("35")
        page.get_by_role("button", name="Agregar", exact=True).click()
        page.wait_for_timeout(250)
        inventory(page, "caja-con-producto-320")
        shot(page, "caja-con-producto-320")

        # Ayuda desde la shell nueva.
        page.set_viewport_size({"width": 1448, "height": 1086})
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(300)
        help_href = page.locator("a", has_text="Ayuda").first.get_attribute("href")
        page.locator("a", has_text="Ayuda").first.click()
        page.wait_for_timeout(800)
        help_url = page.url
        help_text = page.locator("body").inner_text()[:800]

        meta = {
            "console": console,
            "focusedAfterAdd": focused_after_add,
            "confirmStateCashShort": confirm_state,
            "emptyHeadings": empty["headings"],
            "emptyFields": empty["fields"],
            "afterAddFields": after_add["fields"],
            "cashShortAlerts": cash_short["alerts"],
            "cashChangeAlerts": cash_change["alerts"],
            "cashResultHeadings": cash_result["headings"],
            "cashResultAlerts": cash_result["alerts"],
            "creditFormAlerts": credit_form["alerts"],
            "creditResultHeadings": credit_result["headings"],
            "creditResultAlerts": credit_result["alerts"],
            "digitalPendingHeadings": digital_pending["headings"],
            "digitalPendingAlerts": digital_pending["alerts"],
            "digitalLinkAlerts": digital_link["alerts"],
            "returnedHeadings": returned["headings"],
            "ventasHeadings": ventas["headings"],
            "helpHref": help_href,
            "helpUrlAfterClick": help_url,
            "helpTextStart": help_text,
        }
        (OUT / "onboarding-probe.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        browser.close()
        print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
