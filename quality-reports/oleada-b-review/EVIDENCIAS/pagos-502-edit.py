#!/usr/bin/env python3
"""Reproduce: 502 post-commit + edicion + reintento con otra firma."""
from __future__ import annotations

import json
import os
import sqlite3
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
ROOT = Path(__file__).resolve().parents[3]
DB = ROOT / "web" / "data" / "mercado-cero.db"
OUT = Path(__file__).resolve().parent
MARK = f"AUD502{int(time.time())}"


def db_all(sql: str, params: tuple = ()) -> list[dict]:
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        return [dict(row) for row in con.execute(sql, params).fetchall()]
    finally:
        con.close()


def main() -> int:
    result = {"mark": MARK, "steps": [], "ok": False}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1000}, locale="es-MX")
        page = context.new_page()
        page.set_default_timeout(15_000)
        page.goto(BASE + "/caja", wait_until="domcontentloaded")
        page.evaluate(
            """() => {
              localStorage.removeItem('mercado-cero:caja-draft:v2');
              localStorage.removeItem('mercado-cero:caja-pending:v2');
              localStorage.removeItem('mercado-cero:caja-request:v2');
            }"""
        )
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(300)

        add = page.locator(".mc-caja-add")
        add.get_by_label("Producto o servicio").fill(f"{MARK} Editado")
        add.get_by_label("Cantidad").fill("1")
        add.get_by_label("Precio unitario").fill("40")
        add.get_by_role("button", name="Agregar", exact=True).click()
        page.get_by_label("Efectivo recibido").fill("40")

        attempts = {"n": 0}
        payloads: list[dict] = []

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
        alert = page.locator(".mc-caja-alert").inner_text()
        button_label = page.locator(".mc-caja-confirm").inner_text()
        result["steps"].append({"step": "error_502", "alert": alert, "button": button_label, "requestId": payloads[0]["requestId"]})
        page.screenshot(path=str(OUT / "pagos-502-antes-de-editar.png"), full_page=True)

        # La persona edita la cantidad y el efectivo, luego confirma otra vez.
        page.locator(".mc-caja-line").first.get_by_label("Cantidad").fill("2")
        page.get_by_label("Efectivo recibido").fill("80")
        page.wait_for_timeout(200)
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-result")).to_be_visible(timeout=15_000)
        page.wait_for_timeout(500)
        page.unroute("**/api/orders")
        page.screenshot(path=str(OUT / "pagos-502-despues-de-editar.png"), full_page=True)

        orders = db_all(
            "SELECT id, request_id, total_cents, paid_cents, status, created_at FROM orders WHERE request_id IN (?, ?) ORDER BY created_at",
            (payloads[0]["requestId"], payloads[-1]["requestId"]),
        )
        result["steps"].append(
            {
                "step": "edicion_y_reintento",
                "requests": [payload.get("requestId") for payload in payloads],
                "orders": orders,
                "duplicated": len(orders) == 2 and payloads[0]["requestId"] != payloads[-1]["requestId"],
            }
        )
        result["ok"] = result["steps"][-1]["duplicated"]
        context.close()
        browser.close()

    (OUT / "pagos-502-edit.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
