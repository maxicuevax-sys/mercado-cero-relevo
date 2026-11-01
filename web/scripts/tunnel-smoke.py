"""
Humo del túnel público: checkout real a través de Cloudflare, a 360 px.

Uso:
  python scripts/tunnel-smoke.py

Lee APP_URL de .env.local. No imprime secretos.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "demo"
OUT.mkdir(parents=True, exist_ok=True)
ENV = ROOT / "web" / ".env.local"


def app_url() -> str:
    if os.environ.get("MERCADO_BASE_URL"):
        return os.environ["MERCADO_BASE_URL"].rstrip("/")
    for line in ENV.read_text(encoding="utf-8").splitlines():
        key, _, value = line.partition("=")
        if key.strip() == "APP_URL" and value.strip():
            return value.strip().strip("\"'").rstrip("/")
    raise SystemExit("APP_URL no está definido en .env.local")


BASE = app_url()
results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")


def main() -> int:
    console_errors: list[str] = []
    page_errors: list[str] = []
    started = time.time()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            locale="es-MX",
        )
        page = context.new_page()
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        print(f"INFO  {BASE}")
        reset = context.request.post(f"{BASE}/api/demo/reset", timeout=30000)
        check("Reset de demo por el túnel", reset.ok, f"HTTP {reset.status}")

        dashboard = context.request.get(f"{BASE}/api/dashboard", timeout=30000).json()
        pending = next(
            (
                order
                for order in dashboard["orders"]
                if order["status"] == "payment_pending"
            ),
            None,
        )
        if not pending:
            print("FAIL  no hay pedido pendiente")
            return 1

        order_id = pending["id"]
        response = page.goto(f"{BASE}/pay/{order_id}", wait_until="domcontentloaded", timeout=45000)
        check("Checkout responde por HTTPS", bool(response and response.ok), f"HTTP {response.status if response else '—'}")
        page.wait_for_selector("text=¿Cómo quieres pagar?", timeout=20000)
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "tunnel-360-checkout.png"))

        check("Checkout muestra el total", page.get_by_text("$120.00").first.is_visible())
        check("Checkout se identifica como demo", page.get_by_text("Modo demo").first.is_visible())

        page.get_by_role("button", name="Pagar $120.00").click()
        paid = True
        try:
            page.wait_for_selector("h1:has-text('Pago simulado')", timeout=20000)
        except Exception:
            paid = False
        check("Pago demo por el túnel confirmado", paid)
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "tunnel-360-pagado.png"))

        state = context.request.get(f"{BASE}/api/checkout/{order_id}", timeout=30000).json()
        check(
            "Servidor público: orden pagada",
            state["order"]["status"] in ("paid", "demo_paid") and state["payment"] is not None,
            state["order"]["status"],
        )
        check("Sin errores de consola", len(console_errors) == 0, "; ".join(console_errors[:3]))
        check("Sin pageerrors", len(page_errors) == 0, "; ".join(page_errors[:3]))

        context.request.post(f"{BASE}/api/demo/reset", timeout=30000)
        elapsed = round(time.time() - started, 1)
        browser.close()

    report = {
        "base": BASE,
        "viewport": "360x800",
        "elapsedSeconds": elapsed,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "checks": results,
        "passed": sum(1 for item in results if item["ok"]),
        "failed": sum(1 for item in results if not item["ok"]),
    }
    path = OUT / "tunnel-smoke.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("")
    print(f"{report['passed']}/{len(results)} checks en verde")
    print(f"Reporte: {path}")
    return 0 if report["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
