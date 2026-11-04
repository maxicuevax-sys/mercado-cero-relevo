#!/usr/bin/env python3
"""Re-verificacion puntual de B2/I2 (inner_text separa etiqueta y monto con \\n)."""
from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
OUT = Path(__file__).resolve().parent
MARK = f"AUDRES{int(time.time())}"
RESULTS: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name} | {detail}")


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def reset(page) -> None:
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


def add(page, description: str, price: str) -> None:
    box = page.locator(".mc-caja-add")
    box.get_by_label("Producto o servicio").fill(description)
    box.get_by_label("Cantidad").fill("1")
    box.get_by_label("Precio unitario").fill(price)
    box.get_by_role("button", name="Agregar", exact=True).click()
    page.wait_for_timeout(100)


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 1000}, locale="es-MX")
        page.set_default_timeout(15_000)

        reset(page)
        add(page, f"{MARK} Cambio", "47.25")
        page.get_by_label("Efectivo recibido").fill("50")
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-result")).to_be_visible(timeout=15_000)
        page.wait_for_timeout(250)
        text = norm(page.locator(".mc-caja-result").inner_text())
        check("B2 resultado: recibido/aplicado/cambio", "recibiste $50.00" in text and "efectivo aplicado $47.25" in text and "cambio $2.75" in text, text)
        page.screenshot(path=str(OUT / "pagos-caja-cambio-recheck.png"), full_page=True)

        reset(page)
        add(page, f"{MARK} Fiado", "100")
        page.get_by_role("button", name="Fiado", exact=True).click()
        page.get_by_label(re.compile("qu.*deber", re.I)).fill("Cliente Recheck")
        page.locator(".mc-caja-confirm").click()
        expect(page.locator(".mc-caja-result")).to_be_visible(timeout=15_000)
        page.wait_for_timeout(250)
        text = norm(page.locator(".mc-caja-result").inner_text())
        check("I2 resultado: fiado y saldo vivo", "venta registrada con fiado" in text and "saldo vivo fiado $100.00" in text, text)
        page.screenshot(path=str(OUT / "pagos-caja-fiado-recheck.png"), full_page=True)
        browser.close()

    failed = [r for r in RESULTS if not r["ok"]]
    payload = {
        "base": BASE,
        "mark": MARK,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "results": RESULTS,
        "pass": len(RESULTS) - len(failed),
        "fail": len(failed),
    }
    (OUT / "pagos-result-assertions.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nRESULT ASSERTIONS: {len(RESULTS) - len(failed)} PASS / {len(failed)} FAIL")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
