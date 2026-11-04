#!/usr/bin/env python3
"""Reproduce: Actualizar estado acepta una respuesta GET mas vieja y oculta el link."""
from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
OUT = Path(__file__).resolve().parent
MARK = f"AUDPOLL{int(time.time())}"


def main() -> int:
    create = requests.post(
        BASE + "/api/orders",
        json={
            "items": [{"description": MARK, "quantity": 1, "unitPriceCents": 6000}],
            "cashCents": 0,
            "creditCents": 0,
            "customerName": None,
            "requestId": f"poll_{uuid.uuid4()}",
        },
        timeout=20,
    ).json()["order"]
    linked = requests.post(
        BASE + f"/api/orders/{create['id']}/pay", json={"mode": "link"}, timeout=20
    ).json()["order"]
    detail = requests.get(BASE + f"/api/orders/{create['id']}", timeout=20).json()
    old_order = dict(detail["order"])
    old_order.update(
        {
            "status": "confirmed",
            "paymentUrl": None,
            "paymentLinkId": None,
            "qrString": None,
            "qrImage": None,
            "numRef": None,
            "updatedAt": "2000-01-01T00:00:00.000Z",
        }
    )

    result = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "orderId": create["id"],
        "apiStatus": linked["status"],
        "apiPaymentUrl": linked["paymentUrl"],
    }
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 1000}, locale="es-MX")
        page.goto(BASE + "/caja", wait_until="domcontentloaded")
        page.evaluate(
            """(orderId) => {
              localStorage.setItem('mercado-cero:caja-pending:v2', JSON.stringify({orderIds:[orderId]}));
              localStorage.removeItem('mercado-cero:caja-draft:v2');
              localStorage.removeItem('mercado-cero:caja-request:v2');
            }""",
            create["id"],
        )
        page.goto(BASE + "/caja", wait_until="networkidle")
        page.wait_for_timeout(800)
        result["before"] = {
            "title": page.locator("#mc-caja-payment-title").inner_text() if page.locator("#mc-caja-payment-title").count() else None,
            "badge": page.locator(".mc-caja-status").inner_text() if page.locator(".mc-caja-status").count() else None,
            "linkCount": page.locator(".mc-caja-link code").count(),
        }

        def stale(route):
            if route.request.method != "GET":
                route.continue_()
                return
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"order": old_order, "payments": [], "credit": None}),
            )

        page.route(f"**/api/orders/{create['id']}", stale)
        page.get_by_role("button", name="Actualizar estado").click()
        page.wait_for_timeout(800)
        result["after"] = {
            "title": page.locator("#mc-caja-payment-title").inner_text() if page.locator("#mc-caja-payment-title").count() else None,
            "badge": page.locator(".mc-caja-status").inner_text() if page.locator(".mc-caja-status").count() else None,
            "linkCount": page.locator(".mc-caja-link code").count(),
            "bodyText": page.locator("main").inner_text()[:300],
        }
        page.screenshot(path=str(OUT / "pagos-polling-viejo.png"), full_page=True)
        page.unroute(f"**/api/orders/{create['id']}")
        browser.close()

    result["ok"] = (
        result["before"]["badge"].upper() == "PENDIENTE"
        and result["after"]["badge"].upper() == "REGISTRADO"
        and result["after"]["linkCount"] == 0
    )
    (OUT / "pagos-polling-viejo.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
