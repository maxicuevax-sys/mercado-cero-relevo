#!/usr/bin/env python3
"""Regresión de Operación B.1 (Caja, Ventas y verdad financiera).

Requiere un servidor aislado con SQLite temporal:
  $env:BASE_URL="http://127.0.0.1:3340"
  python scripts/oleada-b1-regression.py

El script llama a /api/demo/reset y crea ventas demo. Se niega a correr
contra los puertos de la base principal (3000/3100/3101) o contra una URL
que no sea local. No usa la base principal ni pagos reales.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3340").rstrip("/")
OUT = Path(
    os.environ.get(
        "OLEADA_B1_OUT",
        str(ROOT / "quality-reports" / "oleada-b-estabilizacion" / "evidencia"),
    )
)
OUT.mkdir(parents=True, exist_ok=True)

parsed = urlparse(BASE)
if parsed.hostname not in {"127.0.0.1", "localhost"} or parsed.port in {3000, 3100, 3101}:
    raise SystemExit(
        "B.1 regression: usa un servidor aislado en localhost con puerto distinto de 3000/3100/3101."
    )

RESULTS: list[dict] = []
_ip = 40
_run = time.time_ns()
_reset = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + str(detail)) if detail else ''}")


def next_ip() -> str:
    global _ip
    _ip += 1
    return f"198.51.100.{(_ip % 200) + 1}"


def reset(page) -> None:
    global _reset
    _reset += 1
    response = page.request.post(
        BASE + "/api/demo/reset", headers={"x-forwarded-for": next_ip()}
    )
    assert response.ok, f"demo/reset falló: {response.status} {response.text()}"
    page.goto(BASE + "/inicio", wait_until="domcontentloaded")
    page.evaluate("localStorage.clear()")
    page.goto(BASE + "/caja", wait_until="domcontentloaded")
    clear_demo_ticket(page)


def clear_demo_ticket(page) -> None:
    """Remove the reference's DEMO examples through the real ticket controls.

    Financial fixtures below require only their explicitly added concepts.
    Never seed lines through React/DOM mutation or bypass form validation.
    """
    expect(page.get_by_label("¿Qué vendiste? Describe los productos", exact=True)).to_be_enabled()
    for name in ("Tortilla", "Huevo", "Refresco"):
        button = page.get_by_role("button", name=f"Quitar {name}", exact=True)
        if button.count():
            button.click()


def add_item(page, description: str, quantity: str = "1", price: str = "100") -> None:
    page.locator(".mc-sale-voice__chip--more").click()
    box = page.locator("#mc-caja-manual[open]")
    box.locator("#mc-caja-new-description").fill(description)
    box.get_by_label("Cantidad").fill(quantity)
    box.get_by_label("Precio unitario").fill(price)
    box.get_by_role("button", name="Agregar", exact=True).click()
    expect(page.locator(".mc-caja-line textarea").last).to_have_value(description)


def add_legacy_item(page, description: str, quantity: str, price: str) -> None:
    page.get_by_role("button", name="Agregar producto", exact=True).click()
    page.get_by_role("textbox", name="Producto").last.fill(description)
    page.get_by_role("spinbutton", name="Cantidad").last.fill(quantity)
    page.get_by_role("textbox", name="Precio unitario").last.fill(price)


def new_customer(page, name: str) -> None:
    page.locator("input[placeholder='Ej. Juan']").fill(name)


def order_count(page) -> int:
    response = page.request.get(BASE + "/api/orders")
    assert response.ok, response.text()
    return len(response.json()["orders"])


def make_order(page, request_id: str, cash: int, total: int = 10000, credit: int = 0, customer=None):
    response = page.request.post(
        BASE + "/api/orders",
        data=json.dumps(
            {
                "items": [
                    {
                        "description": f"B1 {request_id}",
                        "quantity": 1,
                        "unitPriceCents": total,
                    }
                ],
                "cashCents": cash,
                "creditCents": credit,
                "customerName": customer,
                "requestId": request_id,
            }
        ),
        headers={"Content-Type": "application/json", "x-forwarded-for": next_ip()},
    )
    assert response.ok, f"{request_id}: {response.status} {response.text()}"
    return response.json()["order"]


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ------------------------------------------------------------------
        # P0-01 · fiado puro
        # ------------------------------------------------------------------
        ctx = browser.new_context(viewport={"width": 1366, "height": 768}, locale="es-MX")
        page = ctx.new_page()
        page.set_default_timeout(15_000)
        page_errors: list[str] = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        reset(page)
        baseline = page.request.get(BASE + "/api/dashboard").json()["summary"]
        check(
            "B1 entorno aislado: seed demo 7000 y cash real 0",
            baseline["demoCashCents"] == 7000 and baseline["cashCents"] == 0,
            json.dumps(
                {
                    "base": BASE,
                    "demoCashCents": baseline["demoCashCents"],
                    "cashCents": baseline["cashCents"],
                }
            ),
        )
        add_item(page, "Fiado puro", "1", "100")
        page.get_by_role("button", name="Fiado", exact=True).click()
        page.get_by_label("Monto a fiado", exact=True).and_(page.locator(":visible")).fill("100")
        new_customer(page, "Juan")
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-result")).to_be_visible()
        result_text = page.locator(".mc-caja-result").inner_text()
        order = page.request.get(BASE + "/api/orders").json()["orders"][0]
        check(
            "P0-01 API paid=0 y credit=100",
            order["paidCents"] == 0 and order["creditCents"] == 10000,
            json.dumps({k: order[k] for k in ["status", "paidCents", "creditCents"]}),
        )
        check(
            "P0-01 no afirma efectivo recibido",
            "el efectivo sí se registró" not in result_text.lower(),
            result_text,
        )
        check("P0-01 dice que no recibiste dinero", "no recibiste dinero" in result_text.lower())
        check(
            "P0-01 muestra efectivo $0 y saldo fiado",
            "cobrado en efectivo" in result_text.lower()
            and "$0.00" in result_text
            and "saldo vivo fiado" in result_text.lower(),
        )
        check(
            "B5 fiado demo: estado Registrado sin 'Demo (simulado)' redundante",
            "venta demo registrada con fiado" in result_text.lower()
            and "registrado" in result_text.lower()
            and "demo (simulado)" not in result_text.lower(),
            result_text,
        )
        page.screenshot(path=str(OUT / "p0-01-fiado-puro.png"), full_page=True)

        # ------------------------------------------------------------------
        # P0-02 · mixto efectivo + digital
        # ------------------------------------------------------------------
        reset(page)
        add_item(page, "Mixto digital", "1", "100")
        page.get_by_role("button", name="Mixto", exact=True).click()
        page.get_by_label("Efectivo recibido", exact=True).and_(page.locator(":visible")).fill("60")
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-payment")).to_be_visible()
        panel = page.locator(".mc-caja-payment").inner_text()
        order = page.request.get(BASE + "/api/orders").json()["orders"][0]
        check(
            "P0-02 API paid=60 y due=40",
            order["paidCents"] == 6000
            and order["totalCents"] - order["paidCents"] - order["creditCents"] == 4000,
            json.dumps({k: order[k] for k in ["status", "paidCents", "creditCents", "totalCents"]}),
        )
        check("P0-02 panel Ya recibiste $60", "ya recibiste" in panel.lower() and "$60.00" in panel)
        check("P0-02 panel Falta cobrar $40", "falta cobrar" in panel.lower() and "$40.00" in panel)
        check(
            "P0-02 no dice que el dinero no se recibió",
            "el dinero aún no se considera recibido" not in panel.lower(),
        )
        page.screenshot(path=str(OUT / "p0-02-mixto-panel.png"), full_page=True)

        # ------------------------------------------------------------------
        # B5/P1 · mixto efectivo + digital + fiado: el encabezado digital
        # muestra lo digital cobrado, no el total de la venta.
        # ------------------------------------------------------------------
        reset(page)
        add_item(page, "Mixto tripartita", "1", "100")
        page.get_by_role("button", name="Mixto", exact=True).click()
        page.get_by_label("Efectivo recibido", exact=True).and_(page.locator(":visible")).fill("20")
        page.get_by_label("Monto a fiado", exact=True).and_(page.locator(":visible")).fill("40")
        new_customer(page, "Ana")
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-payment")).to_be_visible()
        page.get_by_role("button", name="Simular CoDi", exact=True).click()
        expect(page.locator(".mc-caja-result")).to_be_visible()
        mixed_order = page.request.get(BASE + "/api/orders").json()["orders"][0]
        check(
            "B5 mixto API total 100, digital 40, fiado 40",
            mixed_order["totalCents"] == 10000
            and mixed_order["digitalPaidCents"] == 4000
            and mixed_order["creditCents"] == 4000
            and mixed_order["paidCents"] == 6000,
            json.dumps({k: mixed_order[k] for k in ["totalCents", "paidCents", "digitalPaidCents", "creditCents"]}),
        )
        digital_header = page.locator(".mc-payment-confirmed").inner_text()
        check(
            "B5 mixto: encabezado digital muestra $40, no el total",
            "$40.00" in digital_header and "$100.00" not in digital_header,
            digital_header,
        )
        page.screenshot(path=str(OUT / "p1-10-mixto-digital-fiado.png"), full_page=True)

        # ------------------------------------------------------------------
        # P1-07 · cambio fantasma y aviso falso
        # ------------------------------------------------------------------
        reset(page)
        add_item(page, "Fantasma", "1", "100")
        page.get_by_role("button", name="Mixto", exact=True).click()
        page.get_by_label("Efectivo recibido", exact=True).and_(page.locator(":visible")).fill("100")
        page.get_by_label("Monto a fiado", exact=True).and_(page.locator(":visible")).fill("100")
        new_customer(page, "Ana")
        summary = page.locator(".mc-caja-summary").inner_text()
        check("P1-07 sin cambio fantasma", "cambio a devolver" not in summary.lower(), summary)
        check(
            "P1-07 avisa que el fiado cubre todo y no se aplicó efectivo",
            "no se aplicó el efectivo" in summary.lower(),
        )
        check("P1-07 bloquea confirmar", page.locator(".mc-caja-confirm").is_disabled())

        reset(page)
        add_item(page, "Split válido", "1", "100")
        page.get_by_role("button", name="Mixto", exact=True).click()
        page.get_by_label("Efectivo recibido", exact=True).and_(page.locator(":visible")).fill("40")
        page.get_by_label("Monto a fiado", exact=True).and_(page.locator(":visible")).fill("30")
        new_customer(page, "Ana")
        summary = page.locator(".mc-caja-summary").inner_text()
        check("P1-07 sin aviso falso de total", "el total cambió" not in summary.lower(), summary)
        check("P1-07 split válido pide digital $30", "$30.00" in summary)

        # ------------------------------------------------------------------
        # P1-08 · historial con pago parcial
        # ------------------------------------------------------------------
        reset(page)
        make_order(page, f"b1_pending_{_run}", cash=6000)
        page.goto(BASE + "/ventas", wait_until="domcontentloaded")
        page.wait_for_timeout(400)
        row = page.locator(".mc-ventas-row").first.inner_text()
        check("P1-08 fila muestra cobrado $60", "cobrado" in row.lower() and "$60.00" in row, row)
        check("P1-08 fila muestra falta $40", "falta cobrar" in row.lower() and "$40.00" in row, row)
        page.screenshot(path=str(OUT / "p1-08-ventas-pendiente.png"), full_page=True)

        # ------------------------------------------------------------------
        # P1-09 · abono demo no suma a cobrado confirmado
        # ------------------------------------------------------------------
        reset(page)
        before = page.request.get(BASE + "/api/dashboard").json()["summary"]
        order = make_order(
            page,
            f"b1_credit_{_run}",
            cash=0,
            total=10000,
            credit=10000,
            customer="Cliente demo",
        )
        pay = page.request.post(
            BASE + f"/api/credits/{order['creditId']}/pay",
            data=json.dumps(
                {
                    "amountCents": 5000,
                    "method": "cash",
                    "requestId": f"b1_credit_pay_{_run}",
                }
            ),
            headers={"Content-Type": "application/json", "x-forwarded-for": next_ip()},
        )
        check("P1-09 abono demo creado", pay.ok, f"{pay.status} {pay.text()}")
        after = page.request.get(BASE + "/api/dashboard").json()["summary"]
        check(
            "P1-09 cashCents real no cambia; demoCashCents sí",
            after["cashCents"] == before["cashCents"]
            and after["demoCashCents"] == before["demoCashCents"] + 5000,
            json.dumps(
                {
                    "before": before["cashCents"],
                    "after": after["cashCents"],
                    "demoBefore": before["demoCashCents"],
                    "demoAfter": after["demoCashCents"],
                }
            ),
        )
        page.goto(BASE + "/ventas", wait_until="domcontentloaded")
        page.wait_for_timeout(400)
        confirmed_card = page.locator(".mc-ventas-stats article").filter(
            has_text="Cobrado confirmado"
        )
        card = confirmed_card.inner_text()
        check("P1-09 Cobrado confirmado no incluye el abono demo", "$0.00" in card, card)
        page.screenshot(path=str(OUT / "p1-09-abono-demo.png"), full_page=True)

        # ------------------------------------------------------------------
        # P1-01 · puente de drafts v1/v2 y conflicto
        # ------------------------------------------------------------------
        reset(page)
        legacy = {
            "version": 1,
            "items": [{"id": "legacy_1", "description": "Legacy", "quantity": 2, "unitPriceCents": 3500}],
            "cashCents": 7000,
            "creditCents": 0,
            "customerName": "",
            "textInput": "",
            "transcript": "",
            "updatedAt": "2026-11-04T00:00:00.000Z",
        }
        page.evaluate("v => localStorage.setItem('mercado-cero:draft:v1', JSON.stringify(v))", legacy)
        page.goto(BASE + "/caja", wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        body = page.locator(".mc-caja").inner_text()
        check(
            "P1-01 importa el draft v1",
            page.locator(".mc-caja-line textarea").first.input_value() == "Legacy"
            and "$70.00" in body,
        )
        check(
            "P1-01 elimina v1 después de importar",
            page.evaluate("localStorage.getItem('mercado-cero:draft:v1')") is None,
        )
        check("P1-01 avisa la importación", "recuperamos el borrador" in body.lower())

        v2 = {
            "lines": [{"id": "v2_1", "description": "Nueva", "quantity": "1", "price": "100"}],
            "cashInput": "100",
            "creditInput": "",
            "customerName": "",
            "method": "cash",
        }
        page.evaluate("v => localStorage.setItem('mercado-cero:caja-draft:v2', JSON.stringify(v))", v2)
        page.evaluate("v => localStorage.setItem('mercado-cero:draft:v1', JSON.stringify(v))", legacy)
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        body = page.locator(".mc-caja").inner_text()
        check("P1-01 avisa dos drafts distintos", "borrador distinto" in body.lower(), body)
        check("P1-01 bloquea confirmar en conflicto", page.locator(".mc-caja-confirm").is_disabled())
        page.get_by_role("button", name="Descartar la de la Caja clásica", exact=True).click()
        legacy_dialog = page.get_by_role("dialog", name="¿Descartar el borrador de la Caja clásica?", exact=True)
        expect(legacy_dialog).to_be_visible()
        legacy_dialog.get_by_role("button", name="Seguir con la venta", exact=True).click()
        check("P1-01 cancelar conserva ambos borradores", page.evaluate("localStorage.getItem('mercado-cero:draft:v1')") is not None and page.locator(".mc-caja-line textarea").first.input_value() == v2["lines"][0]["description"])
        page.get_by_role("button", name="Usar esta venta").click()
        page.wait_for_timeout(150)
        check("P1-01 permite elegir esta venta", not page.locator(".mc-caja-confirm").is_disabled())
        page.evaluate("v => localStorage.setItem('mercado-cero:draft:v1', JSON.stringify(v))", legacy)
        page.reload(wait_until="domcontentloaded")
        page.get_by_role("button", name="Descartar la de la Caja clásica", exact=True).click()
        legacy_dialog.get_by_role("button", name="Sí, descartar borrador clásico", exact=True).click()
        expect(legacy_dialog).not_to_be_visible()
        check("P1-01 descartar clásico conserva esta venta", page.evaluate("localStorage.getItem('mercado-cero:draft:v1')") is None and page.locator(".mc-caja-line textarea").first.input_value() == v2["lines"][0]["description"])

        # ------------------------------------------------------------------
        # P1-11 · navegación única: Fiados es una pantalla nueva, no un alias
        # ------------------------------------------------------------------
        fiados = page.locator('.inicio-nav__item[href="/fiados"]').first
        check(
            "P1-11 Fiados es una pantalla nueva en la nav",
            fiados.count() == 1 and fiados.get_attribute("href") == "/fiados",
            str(fiados.count()),
        )
        check(
            "P1-11 la nav ya no marca destinos clásicos",
            page.locator(".inicio-nav__legacy, .mc-mobile-nav__legacy").count() == 0
            and "clásica" not in page.locator(".inicio-sidebar").inner_text().lower(),
            page.locator(".inicio-sidebar").inner_text()[:200],
        )
        fiados.click()
        page.wait_for_url(re.compile(r"/fiados"), timeout=15_000)
        page.wait_for_timeout(700)
        # Next conserva la página anterior oculta tras navegar por SPA: se
        # cuentan los shells visibles, no los nodos totales del DOM.
        shell_total = page.locator(".inicio-shell").count()
        shell_visible = page.locator(".inicio-shell:visible").count()
        classic_total = page.locator(".app-shell, .app-sidebar, .tab-panel").count()
        classic_visible = page.locator(
            ".app-shell:visible, .app-sidebar:visible, .tab-panel:visible"
        ).count()
        check(
            "P1-11 /fiados renderiza el shell nuevo",
            shell_visible == 1 and classic_visible == 0,
            f"shell total={shell_total} visible={shell_visible} · "
            f"clásico total={classic_total} visible={classic_visible} · {page.url}",
        )

        page.set_viewport_size({"width": 1366, "height": 768})
        page.goto(BASE + "/caja", wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        # DSH has a scrollable sidebar with more destinations. Bring the real
        # sidebar link into view as a user would before checking obstruction;
        # querying the first document-wide anchor can select an offscreen copy.
        settings = page.locator('.inicio-sidebar:visible a[href="/ajustes"]')
        expect(settings).to_be_visible()
        settings.scroll_into_view_if_needed()
        settings_hit = settings.evaluate(
            """link => {
              const r = link.getBoundingClientRect();
              const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              return {
                hitTag: hit?.tagName ?? null,
                hitHref: hit?.closest?.("a")?.getAttribute("href") ?? null,
                rect: { y: r.y, bottom: r.bottom },
              };
            }"""
        )
        check(
            "P1-11 Ajustes sigue clicable al desplazar la navegación de Caja",
            bool(settings_hit and settings_hit["hitHref"] == "/ajustes"),
            str(settings_hit),
        )
        settings.click()
        page.wait_for_url(re.compile(r"/ajustes/?$"), timeout=15_000)

        # P1-01 · dos pestañas con el mismo draft no duplican la venta.
        reset(page)
        twin_draft = {
            "lines": [
                {
                    "id": "twin_1",
                    "description": "Dos pestañas",
                    "quantity": "1",
                    "price": "100",
                }
            ],
            "cashInput": "100",
            "creditInput": "",
            "customerName": "",
            "method": "cash",
        }
        page.evaluate(
            "v => localStorage.setItem('mercado-cero:caja-draft:v2', JSON.stringify(v))",
            twin_draft,
        )
        page.goto(BASE + "/caja", wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        second = page.context.new_page()
        second.set_default_timeout(15_000)
        second.goto(BASE + "/caja", wait_until="domcontentloaded")
        second.wait_for_timeout(500)
        before_twin = order_count(second)
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-result")).to_be_visible()
        first_result = page.locator(".mc-caja-result").inner_text()
        second.locator(".mc-caja-confirm").click()
        second.wait_for_timeout(900)
        after_twin = order_count(second)
        second_result = (
            second.locator(".mc-caja-result").inner_text()
            if second.locator(".mc-caja-result").count()
            else ""
        )
        check(
            "P1-01 dos pestañas no duplican la venta",
            after_twin == before_twin + 1,
            f"{before_twin} -> {after_twin}",
        )
        first_short = first_result.split("PEDIDO")[-1].strip().split()[0]
        second_short = (
            second_result.split("PEDIDO")[-1].strip().split()[0]
            if second_result
            else ""
        )
        check(
            "P1-01 ambas pestañas muestran la misma venta",
            bool(second_short) and first_short == second_short,
            f"first={first_short} second={second_short}",
        )
        second.close()

        # P1-01 · una venta idéntica repetida después de “Nueva venta” sí debe
        # registrarse: el tombstone pertenece a la instancia del draft, no a
        # cualquier payload con la misma firma.
        page.get_by_role("button", name="Nueva venta").click()
        page.wait_for_timeout(250)
        add_item(page, "Pan repetido", "1", "100")
        page.get_by_label("Efectivo recibido", exact=True).and_(page.locator(":visible")).fill("100")
        before_repeat = order_count(page)
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-result")).to_be_visible()
        first_repeat = page.locator(".mc-caja-result").inner_text()
        page.get_by_role("button", name="Nueva venta").click()
        page.wait_for_timeout(250)
        add_item(page, "Pan repetido", "1", "100")
        page.get_by_label("Efectivo recibido", exact=True).and_(page.locator(":visible")).fill("100")
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-result")).to_be_visible()
        second_repeat = page.locator(".mc-caja-result").inner_text()
        after_repeat = order_count(page)
        first_repeat_short = first_repeat.split("PEDIDO")[-1].strip().split()[0]
        second_repeat_short = second_repeat.split("PEDIDO")[-1].strip().split()[0]
        check(
            "P1-01 venta idéntica repetida sí se registra",
            after_repeat == before_repeat + 2
            and first_repeat_short != second_repeat_short,
            f"{before_repeat} -> {after_repeat}; {first_repeat_short} / {second_repeat_short}",
        )

        # ------------------------------------------------------------------
        # P1-06 · cola completa y salida a nueva venta
        # ------------------------------------------------------------------
        reset(page)
        o1 = make_order(page, f"b1_pending_a_{_run}", cash=6000)
        o2 = make_order(page, f"b1_pending_b_{_run}", cash=3000)
        page.evaluate(
            "ids => localStorage.setItem('mercado-cero:caja-pending:v2', JSON.stringify({orderIds: ids}))",
            [o1["id"], o2["id"]],
        )
        page.goto(BASE + "/caja", wait_until="domcontentloaded")
        page.wait_for_timeout(700)
        check("P1-06 no secuestra la Caja", page.locator("#caja-title").inner_text() == "Nueva venta")
        check(
            "P1-06 lista todos los pendientes",
            page.locator(".mc-caja-pending__list > li").count() == 2,
        )
        page.get_by_role("button", name="Seguir cobrando").first.click()
        page.wait_for_timeout(250)
        check("P1-06 seguir cobrando abre el panel", page.locator(".mc-caja-payment").count() == 1)
        page.get_by_role("button", name="Nueva venta").click()
        page.wait_for_timeout(250)
        check(
            "P1-06 nueva venta conserva pendientes",
            page.locator("#caja-title").inner_text() == "Nueva venta"
            and page.locator(".mc-caja-pending__list > li").count() == 2,
        )

        # ------------------------------------------------------------------
        # P1-12 · 502 post-commit, recarga y reconciliación
        # ------------------------------------------------------------------
        reset(page)
        start_count = order_count(page)
        state = {"posts": 0, "request_ids": []}

        def fail_first_post(route):
            if route.request.method == "POST":
                state["posts"] += 1
                state["request_ids"].append(route.request.post_data_json.get("requestId"))
                route.fetch()
                route.fulfill(
                    status=502,
                    content_type="application/json",
                    body='{"error":"bad gateway"}',
                )
            else:
                route.continue_()

        page.route("**/api/orders", fail_first_post)
        add_item(page, "502 post-commit", "1", "100")
        page.get_by_label("Efectivo recibido", exact=True).and_(page.locator(":visible")).fill("100")
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-unknown")).to_be_visible()
        check(
            "P1-12 muestra estado desconocido",
            "no sabemos si la venta quedó registrada"
            in page.locator(".mc-caja-unknown").inner_text().lower(),
        )
        check(
            "P1-12 bloquea edición",
            page.locator(".mc-caja-line textarea").first.is_disabled(),
        )
        check("P1-12 hubo un solo POST", state["posts"] == 1, str(state))
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(600)
        check(
            "P1-12 conserva el aviso tras recargar",
            page.locator(".mc-caja-unknown").count() == 1,
        )
        page.get_by_role("button", name="Consultar si se registró").click()
        page.wait_for_timeout(900)
        check("P1-12 reconcilia y muestra resultado", page.locator(".mc-caja-result").count() == 1)
        check(
            "P1-12 no duplica la venta",
            order_count(page) == start_count + 1,
            f"{start_count} -> {order_count(page)}",
        )
        page.unroute("**/api/orders")

        # ------------------------------------------------------------------
        # P1-05 · foco de ruta y paginación
        # ------------------------------------------------------------------
        page.goto(BASE + "/inicio", wait_until="domcontentloaded")
        page.get_by_role("link", name="Caja", exact=True).click()
        page.wait_for_url(BASE + "/caja")
        page.wait_for_function("document.activeElement && ['caja-title', 'caja-main', 'H1'].includes(document.activeElement.id || document.activeElement.tagName)")
        active = page.evaluate(
            "document.activeElement && (document.activeElement.id || document.activeElement.tagName)"
        )
        check("P1-05 foco tras navegar a Caja", active in ("caja-title", "caja-main", "H1"), active)

        for index in range(26):
            make_order(page, f"b1_page_{_run}_{index}", cash=100)
        page.goto(BASE + "/ventas", wait_until="domcontentloaded")
        page.wait_for_timeout(400)
        next_link = page.locator(".mc-ventas-pager a", has_text="Siguiente")
        if next_link.count() == 0:
            check("P1-05 paginación disponible", False, "sin página 2")
        else:
            next_link.click()
            page.wait_for_timeout(700)
            active = page.evaluate("document.activeElement && document.activeElement.id")
            announcement = page.locator("[role='status'][aria-live='polite']").last.inner_text()
            check("P1-05 foco al paginar", active == "mc-ventas-list-title", active)
            check("P1-05 anuncia la página", "página 2" in announcement.lower(), announcement)

        # ------------------------------------------------------------------
        # P1-02 / P1-03 / P1-04 · geometría y reflow
        # ------------------------------------------------------------------
        for width, height in [(1448, 1086), (1366, 768), (1280, 800), (768, 1024)]:
            pg = browser.new_page(viewport={"width": width, "height": height}, locale="es-MX")
            pg.goto(BASE + "/caja", wait_until="domcontentloaded")
            pg.wait_for_timeout(350)
            pg.evaluate("localStorage.clear()")
            pg.reload(wait_until="domcontentloaded")
            clear_demo_ticket(pg)
            add_item(pg, "Uno", "1", "100")
            add_item(pg, "Dos", "2", "50")
            add_item(pg, "Tres", "1", "30")
            amount = pg.locator(".mc-caja-line__total .tabular-nums").first.bounding_box()
            check(
                f"P1-02 importe visible a {width}",
                bool(amount and amount["width"] > 20 and amount["height"] > 10),
                str(amount),
            )
            confirm = pg.locator(".mc-caja-confirm").bounding_box()
            bottom = confirm["y"] + confirm["height"] if confirm else 99999
            check(f"P1-03 CTA visible a {width}x{height}", bottom <= height + 1, str(confirm))
            pg.close()

        pg = browser.new_page(viewport={"width": 1366, "height": 768}, locale="es-MX")
        pg.goto(BASE + "/caja", wait_until="domcontentloaded")
        pg.wait_for_timeout(350)
        pg.evaluate("localStorage.clear()")
        pg.reload(wait_until="domcontentloaded")
        clear_demo_ticket(pg)
        add_item(pg, "Texto", "1", "100")
        add_item(pg, "Grande", "1", "50")
        add_item(pg, "Dos", "2", "30")
        pg.evaluate("document.documentElement.style.fontSize='32px'")
        pg.wait_for_timeout(400)
        check(
            "P1-04 cabecera de líneas apilada a 200%",
            pg.locator(".mc-caja-lines__head").evaluate("el => getComputedStyle(el).display")
            == "none",
        )
        confirm = pg.locator(".mc-caja-confirm").bounding_box()
        bottom = confirm["y"] + confirm["height"] if confirm else 99999
        check("P1-04 CTA visible a 200% en 1366", bottom <= 769, str(confirm))
        pg.close()

        pg = browser.new_page(viewport={"width": 320, "height": 640}, locale="es-MX")
        pg.goto(BASE + "/ventas", wait_until="domcontentloaded")
        pg.wait_for_timeout(350)
        pg.evaluate("document.documentElement.style.fontSize='32px'")
        pg.wait_for_timeout(300)
        dims = pg.evaluate(
            "({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})"
        )
        check("P1-04 /ventas 320 sin scroll horizontal", dims["sw"] <= dims["cw"], str(dims))
        pg.close()

        pg = browser.new_page(viewport={"width": 390, "height": 844}, locale="es-MX")
        pg.goto(BASE + "/caja", wait_until="domcontentloaded")
        pg.wait_for_timeout(350)
        pg.evaluate("localStorage.clear()")
        pg.reload(wait_until="domcontentloaded")
        # DSH removed the old preloaded DEMO ticket. Preserve the three-line
        # discard contract by composing a ticket through the visible UI.
        expect(pg.locator(".mc-caja-line")).to_have_count(0)
        add_item(pg, "Uno", "1", "100")
        add_item(pg, "Dos", "1", "50")
        add_item(pg, "Tres", "1", "30")
        expect(pg.locator(".mc-caja-line")).to_have_count(3)
        b2_clear = pg.get_by_role("button", name="Descartar venta", exact=True).and_(
            pg.locator(":visible")
        )
        b2_box = b2_clear.bounding_box()
        check(
            "B2 móvil: descartar venta visible y >=44px",
            b2_clear.is_visible() and bool(b2_box and b2_box["height"] >= 44),
            str(b2_box),
        )
        native_dialogs = []
        def reject_native_dialog(dialog):
            native_dialogs.append(dialog.message)
            dialog.dismiss()
        pg.on("dialog", reject_native_dialog)
        stored_before_discard = pg.evaluate("localStorage.getItem('mercado-cero:caja-draft:v2')")
        b2_clear.click()
        discard = pg.get_by_role("dialog", name="¿Descartar la venta sin confirmar?", exact=True)
        expect(discard).to_be_visible()
        keep_sale = discard.get_by_role("button", name="Seguir con la venta", exact=True)
        expect(keep_sale).to_be_focused()
        keep_sale.click()
        expect(discard).not_to_be_visible()
        expect(b2_clear).to_be_focused()
        expect(pg.locator(".mc-caja-line")).to_have_count(3)
        check("B2 cancelar conserva el borrador completo", pg.evaluate("localStorage.getItem('mercado-cero:caja-draft:v2')") == stored_before_discard)
        b2_clear.click()
        pg.keyboard.press("Escape")
        expect(discard).not_to_be_visible()
        expect(b2_clear).to_be_focused()
        expect(pg.locator(".mc-caja-line")).to_have_count(3)
        b2_clear.click()
        discard.get_by_role("button", name="Cerrar", exact=True).click()
        expect(discard).not_to_be_visible()
        expect(b2_clear).to_be_focused()
        b2_clear.click()
        # Native modal focus must wrap inside the card in both directions.
        keep_sale.focus()
        pg.keyboard.press("Shift+Tab")
        expect(discard.get_by_role("button", name="Cerrar", exact=True)).to_be_focused()
        pg.keyboard.press("Shift+Tab")
        expect(discard.get_by_role("button", name="Sí, descartar venta", exact=True)).to_be_focused()
        discard.click(position={"x": 1, "y": 1})
        expect(discard).not_to_be_visible()
        expect(pg.locator(".mc-caja-line")).to_have_count(3)
        check("B2 Escape, cerrar y fondo conservan el borrador", pg.evaluate("localStorage.getItem('mercado-cero:caja-draft:v2')") == stored_before_discard)
        b2_clear.click()
        discard.get_by_role("button", name="Sí, descartar venta", exact=True).click()
        expect(pg.locator(".mc-caja-line")).to_have_count(0)
        expect(pg.locator("#mc-sale-voice-text")).to_be_focused()
        check("B2 descartar elimina el borrador persistido", pg.evaluate("localStorage.getItem('mercado-cero:caja-draft:v2')") is None)
        check("B2 descartar usa solo confirmación dentro de la app", not native_dialogs, str(native_dialogs))
        check("B2 móvil: descarta el ticket de tres líneas", True)
        pg.reload(wait_until="domcontentloaded")
        clear_demo_ticket(pg)
        add_item(pg, "Uno", "1", "100")
        add_item(pg, "Dos", "1", "50")
        add_item(pg, "Tres", "1", "30")
        pg.evaluate("document.documentElement.style.fontSize='32px'")
        pg.wait_for_timeout(400)
        # The approved mobile composition replaces the sticky paybar with
        # a total followed by an in-flow Registrar venta button, and hides
        # bottom navigation in Caja. Check the actual visible replacements.
        total = pg.locator(".mc-spec-total").bounding_box()
        register = pg.locator(".mc-spec-checkout > .mc-spec-register")
        button = register.bounding_box()
        check(
            "P1-04 total y botón no se solapan",
            bool(total and button and total["width"] > 0 and button["width"] > 0
                 and total["y"] + total["height"] <= button["y"]
                 and 0 <= total["x"] < total["x"] + total["width"] <= 390
                 and 0 <= button["x"] < button["x"] + button["width"] <= 390),
            f"{total} / {button}",
        )
        check("P1-04 Caja oculta el bottom-nav sustituido", not pg.locator(".mc-mobile-nav").is_visible())
        mic = pg.get_by_role("button", name="Dictar venta", exact=True)
        mic_box = mic.bounding_box()
        pg.locator(".mc-sale-voice__chip--manzana").click()
        expect(pg.locator("#mc-sale-voice-text")).to_have_value("Manzana")
        check(
            "B1 móvil: chip y micrófono principal disponibles",
            mic.is_visible() and mic.is_enabled()
            and bool(mic_box and mic_box["width"] >= 56 and mic_box["height"] >= 56),
            str(mic_box),
        )
        register.click()
        expect(pg.get_by_role("heading", name="Método de pago", exact=True)).to_be_visible()
        pg.get_by_role("button", name="Continuar", exact=True).click()
        review = pg.get_by_role("region", name="Revisar cobro", exact=True)
        expect(review).to_be_visible()
        review.get_by_role("button", name="Efectivo exacto", exact=True).click()
        expect(review.get_by_label("Efectivo recibido", exact=True)).to_have_value("180.00")
        mobile_before = order_count(pg)
        review.get_by_role("button", name="Registrar venta", exact=True).click()
        expect(pg.locator(".mc-caja-result")).to_be_visible()
        mobile_order = pg.request.get(BASE + "/api/orders").json()["orders"][0]
        check(
            "B1 móvil: Registrar venta registra efectivo demo una sola vez",
            order_count(pg) == mobile_before + 1
            and mobile_order["totalCents"] == 18000
            and mobile_order["paidCents"] == 18000
            and mobile_order["status"] == "demo_paid"
            and mobile_order["lastPaymentDemo"] is True,
            json.dumps(mobile_order),
        )
        pg.screenshot(path=str(OUT / "p1-04-mobile-checkout.png"), full_page=True)

        # DSH replaces the former 3+2 layout with five primary controls:
        # Inicio, Movimientos, Cobrar, Caja and Más. Preserve visible navigation
        # and text-scale coverage on Inicio, where the nav is rendered.
        pg.goto(BASE + "/inicio", wait_until="domcontentloaded")
        pg.evaluate("document.documentElement.style.fontSize='32px'")
        nav = pg.locator(".mc-mobile-nav")
        expect(nav).to_be_visible()
        expect(nav).to_have_css("grid-template-columns", re.compile(r"^\S+(?: \S+){4}$"))
        nav_columns = nav.evaluate("el => getComputedStyle(el).gridTemplateColumns")
        controls = nav.locator(":scope > a, :scope > details > summary")
        expect(controls).to_have_count(5)
        control_boxes = controls.evaluate_all(
            """elements => elements.map(el => {
              const r = el.getBoundingClientRect();
              const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              return { x: r.x, y: r.y, right: r.right, bottom: r.bottom,
                width: r.width, height: r.height, hittable: !!hit && el.contains(hit) };
            })"""
        )
        check(
            "P1-04 nav móvil DSH de cinco controles a 200% sin recorte ni obstrucción",
            nav.is_visible() and len(nav_columns.split()) == 5
            and all(box["width"] >= 44 and box["height"] >= 44
                    and 0 <= box["x"] < box["right"] <= 391
                    and 0 <= box["y"] < box["bottom"] <= 845
                    and box["hittable"] for box in control_boxes),
            f"{nav_columns} / {control_boxes}",
        )
        nav.locator(".mc-mobile-nav__more > summary").click()
        mobile_settings = nav.locator('.mc-mobile-nav__panel a[href="/ajustes"]')
        expect(mobile_settings).to_be_visible()
        mobile_settings.click()
        pg.wait_for_url(re.compile(r"/ajustes/?$"), timeout=15_000)
        check("P1-04 Más permite abrir Ajustes a 200%", True)
        pg.close()

        # ------------------------------------------------------------------
        # P1-13 · Inicio 768
        # ------------------------------------------------------------------
        pg = browser.new_page(viewport={"width": 768, "height": 1024}, locale="es-MX")
        pg.goto(BASE + "/inicio", wait_until="domcontentloaded")
        pg.wait_for_timeout(400)
        picado = pg.locator(".inicio-picado")
        check(
            "P1-13 papel picado no invade a 768",
            picado.count() == 0
            or picado.evaluate("el => getComputedStyle(el).display") == "none",
        )
        cta = pg.locator(".inicio-hero__cta").bounding_box()
        check(
            "P1-13 CTA Nueva venta sin recorte",
            bool(cta and cta["x"] + cta["width"] <= 768),
            str(cta),
        )
        dims = pg.evaluate(
            "({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})"
        )
        check("P1-13 Inicio 768 sin scroll horizontal", dims["sw"] <= dims["cw"], str(dims))
        pg.close()

        # ------------------------------------------------------------------
        # P1-01 legacy retirado: la raíz ya redirige a /inicio; no se monta la Caja clásica.
        page.goto(BASE + "/", wait_until="domcontentloaded")
        page.wait_for_url(re.compile(r"/inicio/?$"), timeout=15_000)
        check("P1-01 raíz redirige a Inicio", page.url.rstrip("/").endswith("/inicio"), page.url)

        check("sin pageerrors", not page_errors, "; ".join(page_errors))
        browser.close()

    passed = sum(1 for item in RESULTS if item["ok"])
    failed = sum(1 for item in RESULTS if not item["ok"])
    payload = {
        "suite": "oleada-b1-regression",
        "baseUrl": BASE,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": {"pass": passed, "fail": failed, "total": len(RESULTS)},
        "results": RESULTS,
    }
    (OUT / "oleada-b1-regression.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nB.1 REGRESSION · {passed} PASS · {failed} FAIL")
    print(f"EVIDENCIA {OUT / 'oleada-b1-regression.json'}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
