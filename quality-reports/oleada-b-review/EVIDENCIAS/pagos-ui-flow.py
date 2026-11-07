#!/usr/bin/env python3
"""Auditoria adversarial Oleada B - /caja y /ventas con Playwright.

Solo lectura de producto. Crea ventas demo por las mismas APIs que usa la UI.
No declara pagos reales: DEMO_MODE=true en el servidor 3100.
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import time
import uuid
from pathlib import Path

import requests
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
ROOT = Path(__file__).resolve().parents[3]
DB = ROOT / "web" / "data" / "mercado-cero.db"
OUT = Path(__file__).resolve().parent
MARK = f"AUD{int(time.time())}"
RESULTS: list[dict] = []
SHOTS: list[str] = []


def check(name: str, ok: bool, detail: str = "", severity: str = "") -> None:
    RESULTS.append(
        {"name": name, "ok": bool(ok), "detail": detail, "severity": severity}
    )
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f" | {detail}" if detail else ""))


def shot(page, name: str) -> None:
    path = OUT / f"pagos-{name}.png"
    page.screenshot(path=str(path), full_page=True)
    SHOTS.append(path.name)


def money(cents: int) -> str:
    return f"${cents / 100:,.2f}"


def db_one(sql: str, params: tuple = ()) -> dict | None:
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        row = con.execute(sql, params).fetchone()
        return dict(row) if row else None
    finally:
        con.close()


def db_all(sql: str, params: tuple = ()) -> list[dict]:
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        return [dict(row) for row in con.execute(sql, params).fetchall()]
    finally:
        con.close()


def order_by_id(order_id: str) -> dict | None:
    return db_one("SELECT * FROM orders WHERE id = ?", (order_id,))


def order_by_request(request_id: str) -> dict | None:
    return db_one("SELECT * FROM orders WHERE request_id = ?", (request_id,))


def payments(order_id: str) -> list[dict]:
    return db_all(
        "SELECT * FROM payments WHERE order_id = ? ORDER BY created_at, rowid",
        (order_id,),
    )


def api(method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
    response = requests.request(
        method,
        BASE + path,
        json=payload,
        timeout=30,
        headers={"Cache-Control": "no-cache"},
    )
    try:
        body = response.json()
    except Exception:
        body = {"raw": response.text[:500]}
    return response.status_code, body


def reset_caja(page) -> None:
    if not page.url.startswith(BASE):
        page.goto(BASE + "/caja", wait_until="domcontentloaded")
    page.evaluate(
        """() => {
          localStorage.removeItem('mercado-cero:caja-draft:v2');
          localStorage.removeItem('mercado-cero:caja-pending:v2');
          localStorage.removeItem('mercado-cero:caja-request:v2');
        }"""
    )
    page.goto(BASE + "/caja", wait_until="networkidle")
    page.wait_for_timeout(250)


def add_item(page, description: str, quantity: str, price: str) -> None:
    add = page.locator(".mc-caja-add")
    add.get_by_label("Producto o servicio").fill(description)
    add.get_by_label("Cantidad").fill(quantity)
    add.get_by_label("Precio unitario").fill(price)
    add.get_by_role("button", name="Agregar", exact=True).click()
    page.wait_for_timeout(100)


def total_text(page) -> str:
    return page.locator(".mc-caja-total").inner_text().strip()


def wait_result(page):
    expect(page.locator(".mc-caja-result")).to_be_visible(timeout=15_000)
    page.wait_for_timeout(250)


def wait_payment(page):
    expect(page.locator("#mc-caja-payment-title")).to_be_visible(timeout=15_000)
    page.wait_for_timeout(200)


def new_sale(page) -> None:
    page.locator(".mc-caja-result").get_by_role("button", name="Nueva venta").click()
    page.wait_for_timeout(300)


def last_order_from_posts(posts: list[dict]) -> dict | None:
    for entry in reversed(posts):
        body = entry.get("body") or {}
        if body.get("order"):
            return body["order"]
    return None


def install_post_recorder(page) -> tuple[list[dict], list[dict]]:
    requests_seen: list[dict] = []
    responses_seen: list[dict] = []

    def on_request(request):
        if request.method == "POST" and request.url.rstrip("/").endswith("/api/orders"):
            try:
                requests_seen.append({"requestId": (request.post_data_json or {}).get("requestId"), "payload": request.post_data_json})
            except Exception:
                requests_seen.append({"requestId": None, "payload": None})

    def on_response(response):
        if response.request.method == "POST" and response.url.rstrip("/").endswith("/api/orders"):
            try:
                body = response.json()
            except Exception:
                body = None
            responses_seen.append({"status": response.status, "body": body})

    page.on("request", on_request)
    page.on("response", on_response)
    return requests_seen, responses_seen


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 1000}, locale="es-MX"
        )
        page = context.new_page()
        page.set_default_timeout(15_000)
        page_errors: list[str] = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        post_requests, post_responses = install_post_recorder(page)
        page.on("dialog", lambda dialog: dialog.accept())

        reset_caja(page)

        # ---------------------------------------------------------------
        # A. Venta simple/multiple, cantidades, eliminacion, decimales y efectivo exacto.
        # ---------------------------------------------------------------
        check("A1 /caja abre vacia", total_text(page) == "$0.00", total_text(page))
        add_item(page, f"{MARK} Quesadilla", "2", "35")
        check("A2 primer concepto 2x35 = 70", total_text(page) == "$70.00", total_text(page))
        add_item(page, f"{MARK} Agua", "1", "18.50")
        check("A3 decimal suma 88.50", total_text(page) == "$88.50", total_text(page))
        first = page.locator(".mc-caja-line").first
        first.get_by_label("Cantidad").fill("3")
        page.wait_for_timeout(150)
        check("A4 cambiar cantidad recalcula 123.50", total_text(page) == "$123.50", total_text(page))
        page.locator(".mc-caja-line").last.get_by_role("button", name=re.compile("Quitar")).click()
        page.wait_for_timeout(150)
        check("A5 eliminar concepto recalcula 105.00", total_text(page) == "$105.00", total_text(page))
        page.get_by_label("Efectivo recibido").fill("105")
        check(
            "A6 efectivo exacto se anuncia",
            "Efectivo exacto" in page.locator(".mc-caja-change").inner_text(),
            page.locator(".mc-caja-change").inner_text(),
        )
        before_posts = len(post_requests)
        page.locator(".mc-caja-confirm").click()
        wait_result(page)
        created_a = last_order_from_posts(post_responses)
        check(
            "A7 efectivo exacto crea una venta pagada",
            bool(created_a)
            and created_a["status"] == "paid"
            and created_a["paidCents"] == 10500
            and created_a["paymentMethod"] == "cash",
            json.dumps({k: created_a[k] for k in ("status", "totalCents", "paidCents", "paymentMethod")}) if created_a else "sin orden",
        )
        check("A8 el POST de la UI lleva requestId", len(post_requests) == before_posts + 1 and str(post_requests[-1].get("requestId", "")).startswith("sale_"), json.dumps(post_requests[-1].get("requestId")))
        result_text = page.locator(".mc-caja-result").inner_text()
        check(
            "A9 el resultado demo no dice Pagado real",
            "Venta cobrada en efectivo (demo)" in result_text
            and "Demo (simulado)" in result_text
            and "Pago confirmado por pey" not in result_text,
            result_text.splitlines()[:8],
        )
        row_a = order_by_id(created_a["id"]) if created_a else None
        pays_a = payments(created_a["id"]) if created_a else []
        check(
            "A10 DB: 1 pago cash, sin credito",
            bool(row_a)
            and row_a["paid_cents"] == 10500
            and row_a["credit_cents"] == 0
            and len(pays_a) == 1
            and pays_a[0]["method"] == "cash"
            and pays_a[0]["amount_cents"] == 10500,
            json.dumps({"order": {k: row_a[k] for k in ("status", "paid_cents", "credit_cents")} if row_a else None, "pagos": len(pays_a)}),
        )
        shot(page, "caja-efectivo-exacto")

        # ---------------------------------------------------------------
        # B. Efectivo con cambio y decimales.
        # ---------------------------------------------------------------
        new_sale(page)
        add_item(page, f"{MARK} Cafe", "1", "47.25")
        page.get_by_label("Efectivo recibido").fill("50")
        change_text = page.locator(".mc-caja-change").inner_text()
        check("B1 cambio 2.75 visible", "Cambio a devolver $2.75" in change_text, change_text)
        page.locator(".mc-caja-confirm").click()
        wait_result(page)
        created_b = last_order_from_posts(post_responses)
        result_b = page.locator(".mc-caja-result").inner_text()
        result_b_lower = result_b.lower()
        check(
            "B2 resultado muestra recibido/aplicado/cambio",
            "recibiste $50.00" in result_b_lower
            and "efectivo aplicado $47.25" in result_b_lower
            and "cambio" in result_b_lower
            and "$2.75" in result_b_lower,
            result_b.replace("\n", " | "),
        )
        row_b = order_by_id(created_b["id"]) if created_b else None
        check(
            "B3 DB cobra solo el total, no el efectivo recibido",
            bool(row_b) and row_b["total_cents"] == 4725 and row_b["paid_cents"] == 4725,
            json.dumps({"total": row_b["total_cents"], "paid": row_b["paid_cents"]}) if row_b else "sin orden",
        )
        shot(page, "caja-cambio")

        # ---------------------------------------------------------------
        # C. Efectivo insuficiente bloquea y no crea pedido.
        # ---------------------------------------------------------------
        reset_caja(page)
        add_item(page, f"{MARK} Insuficiente", "1", "90")
        page.get_by_label("Efectivo recibido").fill("50")
        check(
            "C1 faltante visible",
            "Faltan $40.00" in page.locator(".mc-caja-change").inner_text(),
            page.locator(".mc-caja-change").inner_text(),
        )
        check("C2 CTA deshabilitado", page.locator(".mc-caja-confirm").is_disabled())
        posts_before = len(post_requests)
        page.evaluate("() => document.querySelector('.mc-caja-confirm').click()")
        page.wait_for_timeout(500)
        check("C3 click forzado no crea pedido", len(post_requests) == posts_before, f"posts={len(post_requests) - posts_before}")

        # ---------------------------------------------------------------
        # D. Doble clic crea una sola venta.
        # ---------------------------------------------------------------
        reset_caja(page)
        add_item(page, f"{MARK} Doble", "1", "30")
        page.get_by_label("Efectivo recibido").fill("30")
        posts_before = len(post_requests)
        page.evaluate("() => { const b=document.querySelector('.mc-caja-confirm'); b.click(); b.click(); }")
        wait_result(page)
        page.wait_for_timeout(500)
        created_d = last_order_from_posts(post_responses)
        check(
            "D1 doble clic produce un solo POST",
            len(post_requests) == posts_before + 1,
            f"posts={len(post_requests) - posts_before}",
        )
        check(
            "D2 doble clic produce una sola orden",
            bool(created_d)
            and len(db_all("SELECT id FROM orders WHERE request_id = ?", (post_requests[-1]["requestId"],))) == 1,
            post_requests[-1]["requestId"] if post_requests else "sin requestId",
        )

        # ---------------------------------------------------------------
        # E. Respuesta perdida (502 post-commit) y reintento con misma llave.
        # ---------------------------------------------------------------
        reset_caja(page)
        add_item(page, f"{MARK} Perdida", "1", "40")
        page.get_by_label("Efectivo recibido").fill("40")
        attempts = {"n": 0}
        payloads: list[dict] = []
        posts_before = len(post_requests)

        def lose_first(route):
            if route.request.method != "POST":
                route.continue_()
                return
            attempts["n"] += 1
            payloads.append(route.request.post_data_json or {})
            if attempts["n"] == 1:
                route.fetch()
                route.fulfill(
                    status=502,
                    content_type="application/json",
                    body=json.dumps({"error": "El banco tardo en responder. Reintenta."}),
                )
            else:
                route.continue_()

        page.route("**/api/orders", lose_first)
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-alert")).to_be_visible(timeout=10_000)
        page.wait_for_timeout(300)
        alert_text = page.locator(".mc-caja-alert").inner_text()
        committed = order_by_request(payloads[0]["requestId"]) if payloads else None
        check(
            "E1 error posterior al commit es visible",
            "Reintenta" in alert_text or "No sabemos" in alert_text,
            alert_text,
        )
        check(
            "E2 la venta si quedo registrada una vez",
            bool(committed) and committed["total_cents"] == 4000
            and len(db_all("SELECT id FROM orders WHERE request_id = ?", (payloads[0]["requestId"],))) == 1,
            json.dumps({"status": committed["status"], "total": committed["total_cents"]}) if committed else "sin orden",
        )
        check(
            "E3 el error pide reintentar (aunque el CTA no cambia de etiqueta)",
            "Reintenta" in alert_text,
            f"alerta={alert_text!r} cta={page.locator('.mc-caja-confirm').inner_text()!r}",
        )
        page.locator(".mc-caja-confirm").click()
        wait_result(page)
        check(
            "E4 reintento reutiliza el mismo requestId",
            len(payloads) == 2 and payloads[0]["requestId"] == payloads[1]["requestId"],
            json.dumps([payload.get("requestId") for payload in payloads]),
        )
        check(
            "E5 reintento no duplica la orden",
            len(db_all("SELECT id FROM orders WHERE request_id = ?", (payloads[0]["requestId"],))) == 1,
            f"posts_exitosos={len(post_requests) - posts_before}",
        )
        page.unroute("**/api/orders")
        shot(page, "caja-reintento")

        # ---------------------------------------------------------------
        # F. Borrador sobrevive recarga.
        # ---------------------------------------------------------------
        reset_caja(page)
        add_item(page, f"{MARK} Borrador", "2", "25")
        page.wait_for_timeout(300)
        draft_raw = page.evaluate("() => localStorage.getItem('mercado-cero:caja-draft:v2')")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(500)
        restore_visible = page.locator(".mc-caja-restore").count() == 1
        check(
            "F1 borrador recuperado tras recarga",
            restore_visible and total_text(page) == "$50.00",
            f"restore={restore_visible} total={total_text(page)}",
        )
        if restore_visible:
            page.get_by_role("button", name="Seguir").click()
            page.wait_for_timeout(200)
        draft_orders = db_one(
            "SELECT COUNT(*) n FROM order_items WHERE description = ?",
            (f"{MARK} Borrador",),
        )
        check(
            "F2 el borrador no crea pedido por si solo",
            bool(draft_orders) and draft_orders["n"] == 0,
            json.dumps(draft_orders),
        )

        # ---------------------------------------------------------------
        # G. Digital: pendiente, link/QR, polling viejo, demo, recarga.
        # ---------------------------------------------------------------
        reset_caja(page)
        add_item(page, f"{MARK} Digital", "1", "60")
        page.get_by_role("button", name="Digital", exact=True).click()
        page.locator(".mc-caja-confirm").click()
        wait_payment(page)
        created_g = last_order_from_posts(post_responses)
        row_g = order_by_id(created_g["id"]) if created_g else None
        check(
            "G1 digital queda registrado, no pagado",
            bool(row_g)
            and row_g["status"] == "confirmed"
            and row_g["paid_cents"] == 0
            and len(payments(row_g["id"])) == 0,
            json.dumps({"status": row_g["status"], "paid": row_g["paid_cents"]}) if row_g else "sin orden",
        )
        panel_text = page.locator(".mc-caja-payment").inner_text()
        badge = page.locator(".mc-caja-status").inner_text().strip().upper()
        check(
            "G2 el badge dice Registrado/Pendiente, no Pagado",
            badge in {"REGISTRADO", "PENDIENTE"},
            f"badge={badge}",
        )
        old_order = json.loads(json.dumps(created_g)) if created_g else None

        page.get_by_role("button", name="Generar link").click()
        expect(page.locator(".mc-caja-link code")).to_be_visible(timeout=15_000)
        page.wait_for_timeout(300)
        link = page.locator(".mc-caja-link code").inner_text().strip()
        row_g_link = order_by_id(created_g["id"]) if created_g else None
        check(
            "G3 link generado y orden sigue pendiente",
            bool(link)
            and bool(row_g_link)
            and row_g_link["status"] == "payment_pending"
            and row_g_link["payment_url"] == link,
            link,
        )
        check(
            "G4 link usa APP_URL del servidor",
            link.startswith(BASE + "/pay/") or link.startswith("http://localhost:3100/pay/"),
            link,
        )
        page.get_by_role("button", name="Generar QR").click()
        expect(page.locator(".mc-caja-qr img")).to_be_visible(timeout=15_000)
        page.wait_for_timeout(300)
        qr_src = page.locator(".mc-caja-qr img").get_attribute("src") or ""
        row_g_qr = order_by_id(created_g["id"]) if created_g else None
        check(
            "G5 QR generado y orden sigue pendiente",
            qr_src.startswith("data:image/")
            and bool(row_g_qr)
            and row_g_qr["status"] == "payment_pending"
            and bool(row_g_qr["qr_string"]),
            f"qr={qr_src[:32]} status={row_g_qr['status'] if row_g_qr else None}",
        )
        shot(page, "caja-digital-pendiente")

        page.reload(wait_until="networkidle")
        page.wait_for_timeout(900)
        check(
            "G6 recarga reanuda el mismo cobro pendiente",
            page.locator("#mc-caja-payment-title").count() == 1
            and created_g["id"][-4:].upper() in page.locator("#mc-caja-payment-title").inner_text()
            and page.locator(".mc-caja-link code").count() == 1,
            page.locator("#mc-caja-payment-title").inner_text() if page.locator("#mc-caja-payment-title").count() else "sin panel",
        )

        # Polling viejo: servir la orden original (confirmed, sin link) debe ignorarse.
        stale_served = {"n": 0}

        def stale_handler(route):
            if route.request.method != "GET":
                route.continue_()
                return
            stale_served["n"] += 1
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"order": old_order, "payments": [], "credit": None}),
            )

        page.route(f"**/api/orders/{created_g['id']}", stale_handler)
        page.get_by_role("button", name="Actualizar estado").click()
        page.wait_for_timeout(800)
        stale_text = page.locator(".mc-caja-payment").inner_text()
        check(
            "G7 polling viejo no revive estado anterior",
            "Pendiente" in stale_text and page.locator(".mc-caja-link code").count() == 1,
            f"stale_served={stale_served['n']} panel={stale_text.splitlines()[:5]}",
        )
        page.unroute(f"**/api/orders/{created_g['id']}")

        page.get_by_role("button", name="Simular tarjeta").click()
        wait_result(page)
        result_g = page.locator(".mc-caja-result").inner_text()
        row_g_demo = order_by_id(created_g["id"]) if created_g else None
        pays_g = payments(created_g["id"]) if created_g else []
        check(
            "G8 demo deja demo_paid, nunca paid",
            bool(row_g_demo)
            and row_g_demo["status"] == "demo_paid"
            and row_g_demo["paid_cents"] == 6000
            and len(pays_g) == 1
            and pays_g[0]["provider"] == "demo",
            json.dumps({"status": row_g_demo["status"], "paid": row_g_demo["paid_cents"], "provider": pays_g[0]["provider"]}) if row_g_demo and pays_g else "sin datos",
        )
        check(
            "G9 resultado dice Pago demo (simulado)",
            "Pago demo (simulado)" in result_g
            and "Pago confirmado por pey" not in result_g
            and "Pagado" not in result_g,
            result_g.splitlines()[:8],
        )
        shot(page, "caja-digital-demo-resultado")

        # ---------------------------------------------------------------
        # H. Checkout del link: demo valido, sin declarar paid.
        # ---------------------------------------------------------------
        reset_caja(page)
        add_item(page, f"{MARK} Checkout", "1", "55")
        page.get_by_role("button", name="Digital", exact=True).click()
        page.locator(".mc-caja-confirm").click()
        wait_payment(page)
        created_h = last_order_from_posts(post_responses)
        page.get_by_role("button", name="Generar link").click()
        expect(page.locator(".mc-caja-link code")).to_be_visible(timeout=15_000)
        page.wait_for_timeout(200)
        checkout_url = page.locator(".mc-caja-link code").inner_text().strip()
        checkout = context.new_page()
        checkout.set_default_timeout(15_000)
        checkout.goto(checkout_url, wait_until="networkidle")
        checkout.wait_for_timeout(300)
        checkout_text = checkout.locator("main").inner_text()
        check(
            "H1 checkout muestra Modo demo y total",
            "Modo demo" in checkout_text and "$55.00" in checkout_text,
            checkout_text.splitlines()[:10],
        )
        shot(checkout, "checkout-demo")
        checkout.get_by_role("button", name=re.compile(r"^Pagar ")).click()
        expect(checkout.get_by_role("heading", name=re.compile("Pago demo|Simulaci"))).to_be_visible(timeout=20_000)
        checkout.wait_for_timeout(400)
        checkout_result = checkout.locator("main").inner_text()
        row_h = order_by_id(created_h["id"]) if created_h else None
        check(
            "H2 checkout demo termina en demo_paid y lo declara",
            bool(row_h)
            and row_h["status"] == "demo_paid"
            and "Pago demo" in checkout_result
            and "Confirmaci" not in checkout_result,
            json.dumps({"status": row_h["status"] if row_h else None, "texto": checkout_result.splitlines()[:8]}),
        )
        checkout.close()

        # ---------------------------------------------------------------
        # I. Fiado y saldo vivo en /ventas.
        # ---------------------------------------------------------------
        reset_caja(page)
        add_item(page, f"{MARK} Fiado", "1", "100")
        page.get_by_role("button", name="Fiado", exact=True).click()
        page.get_by_label(re.compile("qu.*deber", re.I)).fill("Cliente Auditoria B")
        page.locator(".mc-caja-confirm").click()
        wait_result(page)
        created_i = last_order_from_posts(post_responses)
        result_i = page.locator(".mc-caja-result").inner_text()
        row_i = order_by_id(created_i["id"]) if created_i else None
        credit_i = db_one("SELECT * FROM credits WHERE id = ?", (row_i["credit_id"],)) if row_i and row_i["credit_id"] else None
        check(
            "I1 fiado crea deuda, no efectivo",
            bool(row_i)
            and row_i["status"] == "confirmed"
            and row_i["paid_cents"] == 0
            and row_i["credit_cents"] == 10000
            and bool(credit_i)
            and credit_i["balance_cents"] == 10000,
            json.dumps({"status": row_i["status"], "credit": row_i["credit_cents"]}) if row_i else "sin orden",
        )
        result_i_lower = result_i.lower()
        check(
            "I2 resultado habla de fiado/saldo vivo",
            "venta registrada con fiado" in result_i_lower
            and "saldo vivo fiado" in result_i_lower
            and "pagado" not in result_i_lower,
            result_i.replace("\n", " | "),
        )
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(400)
        short_i = created_i["id"][-4:].upper()
        row_ui = page.locator(".mc-ventas-row", has_text=short_i)
        check(
            "I3 /ventas muestra fiado y saldo vivo",
            row_ui.count() == 1
            and "Fiado" in row_ui.inner_text()
            and "Saldo vivo" in row_ui.inner_text()
            and "$100.00" in row_ui.inner_text(),
            row_ui.inner_text()[:220] if row_ui.count() else "sin fila",
        )
        if credit_i:
            status, body = api(
                "POST",
                f"/api/credits/{credit_i['id']}/pay",
                {"amountCents": 4000, "method": "cash", "requestId": f"aud_partial_{MARK}", "expectedBalanceCents": 10000},
            )
            check("I4 abono parcial por API", status == 200 and (body.get("credit") or body.get("balanceCents") is not None), f"{status} {json.dumps(body)[:200]}")
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(400)
            row_ui = page.locator(".mc-ventas-row", has_text=short_i)
            check(
                "I5 /ventas baja el saldo a 60",
                row_ui.count() == 1 and "Saldo vivo" in row_ui.inner_text() and "$60.00" in row_ui.inner_text(),
                row_ui.inner_text()[:220] if row_ui.count() else "sin fila",
            )
            shot(page, "ventas-fiado-parcial")
            status, body = api(
                "POST",
                f"/api/credits/{credit_i['id']}/pay",
                {"amountCents": 6000, "method": "cash", "requestId": f"aud_settle_{MARK}", "expectedBalanceCents": 6000},
            )
            check("I6 liquidacion por API", status == 200, f"{status} {json.dumps(body)[:160]}")
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(400)
            row_ui = page.locator(".mc-ventas-row", has_text=short_i)
            check(
                "I7 /ventas muestra fiado saldado, no deuda viva",
                row_ui.count() == 1
                and "Fiado saldado" in row_ui.inner_text()
                and "Saldo vivo" not in row_ui.inner_text(),
                row_ui.inner_text()[:220] if row_ui.count() else "sin fila",
            )

        # ---------------------------------------------------------------
        # J. Mixto efectivo+fiado en demo: titular.
        # ---------------------------------------------------------------
        reset_caja(page)
        add_item(page, f"{MARK} Mixto", "1", "90")
        page.get_by_role("button", name="Mixto", exact=True).click()
        page.get_by_label("Efectivo recibido").fill("100")
        page.get_by_label("Monto a fiado").fill("30")
        page.get_by_label(re.compile("qu.*deber", re.I)).fill("Cliente Mixto B")
        check(
            "J1 cambio mixto 40.00",
            "Cambio a devolver $40.00" in page.locator(".mc-caja-change").inner_text(),
            page.locator(".mc-caja-change").inner_text(),
        )
        page.locator(".mc-caja-confirm").click()
        wait_result(page)
        created_j = last_order_from_posts(post_responses)
        result_j = page.locator(".mc-caja-result").inner_text()
        row_j = order_by_id(created_j["id"]) if created_j else None
        check(
            "J2 DB: efectivo 60 + fiado 30",
            bool(row_j)
            and row_j["paid_cents"] == 6000
            and row_j["credit_cents"] == 3000
            and row_j["status"] == "confirmed",
            json.dumps({"paid": row_j["paid_cents"], "credit": row_j["credit_cents"], "status": row_j["status"]}) if row_j else "sin orden",
        )
        check(
            "J3 el titular no oculta el fiado pendiente",
            "Saldo vivo fiado" in result_j
            and "Venta cobrada en efectivo (demo)" not in result_j,
            result_j.splitlines()[:10],
            severity="P2",
        )
        shot(page, "caja-mixto-fiado-demo")

        # ---------------------------------------------------------------
        # K. Puntero pendiente: Nueva venta + recarga.
        # ---------------------------------------------------------------
        reset_caja(page)
        add_item(page, f"{MARK} Puntero", "1", "25")
        page.get_by_role("button", name="Digital", exact=True).click()
        page.locator(".mc-caja-confirm").click()
        wait_payment(page)
        created_k = last_order_from_posts(post_responses)
        pending_raw = page.evaluate("() => localStorage.getItem('mercado-cero:caja-pending:v2')")
        check(
            "K1 el cobro pendiente queda apuntado",
            bool(pending_raw) and created_k["id"] in pending_raw,
            pending_raw,
        )
        api("POST", "/api/demo/pay", {"orderId": created_k["id"], "method": "card"})
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(800)
        reload_title = page.locator("#caja-title").inner_text()
        check(
            "K2 recarga de un pendiente ya pagado muestra su resultado",
            reload_title == "Venta registrada",
            reload_title,
        )
        page.get_by_role("button", name="Nueva venta").click()
        page.wait_for_timeout(300)
        after_new = page.locator("#caja-title").inner_text()
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(700)
        after_reload = page.locator("#caja-title").inner_text()
        pending_after = page.evaluate("() => localStorage.getItem('mercado-cero:caja-pending:v2')")
        check(
            "K3 Nueva venta no borra el puntero y la recarga resucita el resultado viejo",
            after_new == "Nueva venta" and after_reload == "Venta registrada" and bool(pending_after),
            json.dumps({"after_new": after_new, "after_reload": after_reload, "pending": pending_after}),
            severity="P2",
        )
        shot(page, "caja-puntero-resucitado")

        # Crear un pendiente nuevo para /ventas (sin pagarlo).
        reset_caja(page)
        add_item(page, f"{MARK} Pendiente", "1", "45")
        page.get_by_role("button", name="Digital", exact=True).click()
        page.locator(".mc-caja-confirm").click()
        wait_payment(page)
        created_pending = last_order_from_posts(post_responses)

        # ---------------------------------------------------------------
        # L. /ventas: importes, metodos, pendiente, demo y agregados.
        # ---------------------------------------------------------------
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(500)
        page_text = page.locator("main").inner_text()
        status, dashboard = api("GET", "/api/dashboard")
        check("L1 dashboard legible", status == 200, str(status))
        summary = dashboard.get("summary", {}) if isinstance(dashboard, dict) else {}
        expected_sales = money(int(summary.get("salesCents", 0)))
        expected_collected = money(int(summary.get("cashCents", 0)) + int(summary.get("verifiedDigitalCents", 0)))
        pending = db_one(
            """SELECT COALESCE(SUM(MAX(total_cents - paid_cents - credit_cents, 0)), 0) AS total
               FROM orders
               WHERE status IN ('confirmed','payment_pending','partially_paid')
                 AND MAX(total_cents - paid_cents - credit_cents, 0) > 0"""
        )
        expected_pending = money(int(pending["total"])) if pending else "$0.00"
        stats = page.locator(".mc-ventas-stats").inner_text()
        sales_card = page.locator(".mc-ventas-stats article").nth(0).inner_text()
        collected_card = page.locator(".mc-ventas-stats article").nth(1).inner_text()
        pending_card = page.locator(".mc-ventas-stats article").nth(2).inner_text()
        check(
            "L2 Ventas hoy coincide con el resumen del servidor",
            expected_sales in sales_card,
            f"esperado={expected_sales} card={sales_card}",
        )
        check(
            "L3 Cobrado confirmado coincide con el resumen del servidor",
            expected_collected in collected_card,
            f"esperado={expected_collected} card={collected_card}",
        )
        demo_credit_cash = db_one(
            """SELECT COALESCE(SUM(amount_cents), 0) total
               FROM credit_payments
               WHERE demo = 1 AND method = 'cash'"""
        )
        demo_credit_total = int(demo_credit_cash["total"]) if demo_credit_cash else 0
        check(
            "L3b Cobrado confirmado no debe incluir abonos demo",
            demo_credit_total == 0 or money(demo_credit_total) not in collected_card,
            f"abonos_demo={money(demo_credit_total)} card={collected_card}",
            severity="P2",
        )
        check(
            "L4 Por cobrar digital coincide con la deuda viva",
            expected_pending in pending_card,
            f"esperado={expected_pending} card={pending_card}",
        )

        # Filas conocidas.
        def row_for(order_id: str):
            return page.locator(".mc-ventas-row", has_text=order_id[-4:].upper())

        if created_a:
            row = row_for(created_a["id"])
            check(
                "L5 fila efectivo: importe y metodo",
                row.count() == 1 and "$105.00" in row.inner_text() and "Efectivo" in row.inner_text(),
                row.inner_text()[:240] if row.count() else "sin fila",
            )
        if created_g:
            row = row_for(created_g["id"])
            check(
                "L6 fila demo: dice Demo, no Pagado real",
                row.count() == 1 and "Demo" in row.inner_text() and "no es dinero real" in row.inner_text(),
                row.inner_text()[:240] if row.count() else "sin fila",
            )
        if created_h:
            row = row_for(created_h["id"])
            check(
                "L7 fila checkout: metodo CoDi y demo",
                row.count() == 1 and "CoDi" in row.inner_text() and "Demo" in row.inner_text(),
                row.inner_text()[:240] if row.count() else "sin fila",
            )
        if created_pending:
            row = row_for(created_pending["id"])
            check(
                "L8 fila pendiente: Falta cobrar y no Pagado",
                row.count() == 1
                and "Falta cobrar" in row.inner_text()
                and "Pendiente" in row.inner_text()
                and "Pagado" not in row.inner_text(),
                row.inner_text()[:240] if row.count() else "sin fila",
            )
        check(
            "L9 ningun texto afirma pago verificado por pey",
            "verificado por pey" not in page_text.lower() and "confirmacion firmada" not in page_text.lower(),
            page_text[-300:],
        )
        shot(page, "ventas")

        # Paginacion (si hay >25).
        total_orders = db_one("SELECT COUNT(*) n FROM orders")["n"]
        expected_pages = max(1, (total_orders + 24) // 25)
        page.goto(BASE + "/ventas?page=99", wait_until="networkidle")
        page.wait_for_timeout(400)
        head = page.locator(".mc-ventas-list__head").inner_text()
        check(
            "L10 page=99 se acota a la ultima pagina",
            f"página {expected_pages} de {expected_pages}" in head,
            f"total={total_orders} head={head}",
        )
        if expected_pages > 1:
            page.goto(BASE + "/ventas?page=2", wait_until="networkidle")
            page.wait_for_timeout(400)
            check("L11 pagina 2 muestra filas", page.locator(".mc-ventas-row").count() > 0, str(page.locator(".mc-ventas-row").count()))
            shot(page, "ventas-pagina2")

        # ---------------------------------------------------------------
        # M. Idempotencia directa de requestId + doble POST concurrente.
        # ---------------------------------------------------------------
        rid = f"aud_idem_{uuid.uuid4()}"
        payload = {
            "items": [{"description": f"{MARK} Idem", "quantity": 1, "unitPriceCents": 1234}],
            "cashCents": 1234,
            "creditCents": 0,
            "customerName": None,
            "requestId": rid,
        }
        s1, b1 = api("POST", "/api/orders", payload)
        s2, b2 = api("POST", "/api/orders", payload)
        check(
            "M1 mismo requestId y payload devuelve el mismo pedido",
            s1 == 201 and s2 == 201 and b1.get("order", {}).get("id") == b2.get("order", {}).get("id"),
            json.dumps({"s1": s1, "s2": s2, "id1": b1.get("order", {}).get("id"), "id2": b2.get("order", {}).get("id")}),
        )
        check(
            "M2 una sola fila para el requestId",
            len(db_all("SELECT id FROM orders WHERE request_id = ?", (rid,))) == 1,
            rid,
        )
        altered = dict(payload)
        altered["items"] = [{"description": f"{MARK} Idem", "quantity": 1, "unitPriceCents": 9999}]
        s3, b3 = api("POST", "/api/orders", altered)
        check(
            "M3 mismo requestId con otro payload da 409 y no crea",
            s3 == 409
            and b3.get("code") == "request_id_conflict"
            and len(db_all("SELECT id FROM orders WHERE request_id = ?", (rid,))) == 1,
            f"{s3} {json.dumps(b3)[:200]}",
        )
        rid2 = f"aud_race_{uuid.uuid4()}"
        payload2 = {
            "items": [{"description": f"{MARK} Race", "quantity": 1, "unitPriceCents": 777}],
            "cashCents": 777,
            "creditCents": 0,
            "customerName": None,
            "requestId": rid2,
        }
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(api, "POST", "/api/orders", payload2) for _ in range(2)]
            results = [future.result() for future in futures]
        ids = [body.get("order", {}).get("id") for status, body in results]
        check(
            "M4 doble POST concurrente con misma llave crea una orden",
            all(status == 201 for status, _ in results)
            and len(set(ids)) == 1
            and len(db_all("SELECT id FROM orders WHERE request_id = ?", (rid2,))) == 1,
            json.dumps({"status": [s for s, _ in results], "ids": ids}),
        )

        # ---------------------------------------------------------------
        # N. Consola y errores.
        # ---------------------------------------------------------------
        check("N1 sin errores de pagina", len(page_errors) == 0, json.dumps(page_errors[:5]))
        context.close()
        browser.close()

    failed = [item for item in RESULTS if not item["ok"]]
    payload = {
        "base": BASE,
        "mark": MARK,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "results": RESULTS,
        "screenshots": SHOTS,
        "summary": {"total": len(RESULTS), "pass": len(RESULTS) - len(failed), "fail": len(failed)},
    }
    (OUT / "pagos-ui-flow.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nPAGOS UI FLOW: {len(RESULTS) - len(failed)} PASS / {len(failed)} FAIL")
    for item in failed:
        print(f"FAIL {item['name']}: {item['detail']}")
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
