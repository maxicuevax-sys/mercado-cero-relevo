#!/usr/bin/env python3
"""Respuesta perdida real (abort) despues del commit + reintento con la misma llave."""
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
MARK = f"AUDLOST{int(time.time())}"


def db_all(sql: str, params: tuple = ()) -> list[dict]:
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        return [dict(row) for row in con.execute(sql, params).fetchall()]
    finally:
        con.close()


def main() -> int:
    result = {"mark": MARK, "steps": []}
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
        add.get_by_label("Producto o servicio").fill(f"{MARK} Perdida")
        add.get_by_label("Cantidad").fill("1")
        add.get_by_label("Precio unitario").fill("40")
        add.get_by_role("button", name="Agregar", exact=True).click()
        page.get_by_label("Efectivo recibido").fill("40")

        attempts = {"n": 0}
        payloads: list[dict] = []

        def lose_network(route):
            if route.request.method != "POST":
                route.continue_()
                return
            attempts["n"] += 1
            payloads.append(route.request.post_data_json or {})
            if attempts["n"] == 1:
                route.fetch()
                route.abort("failed")
            else:
                route.continue_()

        page.route("**/api/orders", lose_network)
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-alert")).to_be_visible(timeout=10_000)
        page.wait_for_timeout(400)
        alert = page.locator(".mc-caja-alert").inner_text()
        cta = page.locator(".mc-caja-confirm").inner_text()
        first_order = db_all("SELECT id, status, total_cents FROM orders WHERE request_id = ?", (payloads[0]["requestId"],))
        result["steps"].append(
            {
                "step": "abort_post_commit",
                "alert": alert,
                "cta": cta,
                "requestId": payloads[0]["requestId"],
                "orders": first_order,
            }
        )
        page.screenshot(path=str(OUT / "pagos-lost-response-aviso.png"), full_page=True)
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-result")).to_be_visible(timeout=15_000)
        page.wait_for_timeout(400)
        page.unroute("**/api/orders")
        after = db_all("SELECT id, status, total_cents FROM orders WHERE request_id = ?", (payloads[0]["requestId"],))
        result["steps"].append(
            {
                "step": "reintento",
                "requests": [payload.get("requestId") for payload in payloads],
                "orders": after,
                "same_key": len(payloads) == 2 and payloads[0]["requestId"] == payloads[1]["requestId"],
                "one_order": len(after) == 1,
            }
        )
        page.screenshot(path=str(OUT / "pagos-lost-response-resultado.png"), full_page=True)
        context.close()
        browser.close()

    result["ok"] = (
        "No sabemos" in result["steps"][0]["alert"]
        and result["steps"][1]["same_key"]
        and result["steps"][1]["one_order"]
    )
    (OUT / "pagos-lost-response.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
