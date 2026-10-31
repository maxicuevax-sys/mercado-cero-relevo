"""
Ensayo cronometrado del guion de demo. Corre 3 veces y guarda demo/rehearsal.json.

Uso:
  python scripts/rehearse-demo.py

Requiere el servidor en http://localhost:3000.
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
OUT = ROOT / "demo"
OUT.mkdir(parents=True, exist_ok=True)

RUNS = 3
results: list[dict] = []


def wait_text(page, text: str, timeout: int = 12000) -> bool:
    try:
        page.wait_for_selector(f"text={text}", timeout=timeout)
        return True
    except Exception:
        return False


def fill_denomination(page, label: str, quantity: str) -> None:
    span = page.get_by_text(label, exact=True)
    span.locator("xpath=..").locator("input").fill(quantity)


def run_once(page, iteration: int) -> dict:
    errors: list[str] = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))

    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector("text=Modo demo", timeout=15000)
    page.wait_for_timeout(400)
    started = time.time()
    steps: list[dict] = []

    def step(name: str, ok: bool, detail: str = "") -> None:
        steps.append({"name": name, "ok": bool(ok), "detail": detail})
        print(f"  {'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")

    # 1. Venta por texto.
    page.locator("#caja").scroll_into_view_if_needed()
    page.get_by_role("button", name="Dos quesadillas de 35 y un agua de 20").click()
    step("venta interpretada", wait_text(page, "2 productos"))
    step("total $90", wait_text(page, "$90.00"))
    page.get_by_role("button", name="Confirmar venta").click()
    step("cobro visible", wait_text(page, "Link de pago"))

    # 2. Link + pago demo.
    page.get_by_role("button", name=re.compile("Link de pago")).click()
    step("link generado", wait_text(page, "Simular CoDi"))
    page.get_by_role("button", name="Simular CoDi").click()
    step("pago demo confirmado", wait_text(page, "Pago simulado"))
    page.get_by_role("button", name="Listo para entregar").click()
    page.wait_for_timeout(350)

    # 3. Fiado.
    page.locator("#caja").scroll_into_view_if_needed()
    page.get_by_role("button", name="Juan me pagó 50 del fiado").click()
    step("abono de fiado", wait_text(page, "Abono de"))
    step("saldo de Juan en cero", wait_text(page, "Saldo: $0.00"))

    # 4. Consulta por voz.
    page.get_by_role("button", name="¿Cuánto vendí hoy?").click()
    step("consulta de ventas", wait_text(page, "Hoy llevas"))

    # 5. Anti-fraude.
    page.locator("#verificar").scroll_into_view_if_needed()
    page.get_by_role("button", name="Probar con un comprobante falso").click()
    step("comprobante falso rechazado", wait_text(page, "No verificado"))

    # 6. Mi negocio.
    page.locator("#corte").scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    step("dashboard visible", page.locator("#corte").is_visible())

    # 7. Corte de caja: refrescar, contar $620 y guardar.
    page.locator('button[title="Actualizar corte"]').click()
    step("corte incluye abono de fiado", wait_text(page, "$620.00"))
    page.get_by_role("button", name="Contar por billetes y monedas").click()
    page.wait_for_timeout(250)
    fill_denomination(page, "$100", "5")
    fill_denomination(page, "$50", "2")
    fill_denomination(page, "$20", "1")
    step("conteo cuadra", wait_text(page, "Cuadra"))
    page.get_by_role("button", name="Guardar corte").click()
    step("corte guardado", wait_text(page, "Corte guardado"))

    # 8. Meta.
    page.locator("#meta").scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    page.get_by_placeholder("¿Cuánto apartaste?").fill("25")
    page.get_by_role("button", name="Apartar", exact=True).click()
    step("meta avanza", wait_text(page, "$325.00"))

    elapsed = time.time() - started
    print(f"  TIEMPO  {elapsed:.1f}s · errores consola: {len(errors)}")
    return {
        "iteration": iteration,
        "seconds": round(elapsed, 1),
        "steps": steps,
        "consoleErrors": errors,
        "passed": sum(1 for item in steps if item["ok"]),
        "failed": sum(1 for item in steps if not item["ok"]),
    }


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800}, locale="es-MX")

        for iteration in range(1, RUNS + 1):
            print(f"\nENSAYO {iteration}/{RUNS}")
            page.request.post(f"{BASE}/api/demo/reset")
            result = run_once(page, iteration)
            results.append(result)

        browser.close()

    durations = [item["seconds"] for item in results]
    report = {
        "runs": results,
        "fastestSeconds": min(durations),
        "slowestSeconds": max(durations),
        "averageSeconds": round(sum(durations) / len(durations), 1),
        "allPassed": all(item["failed"] == 0 and not item["consoleErrors"] for item in results),
    }
    path = OUT / "rehearsal.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nRESUMEN")
    print(f"  rápido: {report['fastestSeconds']}s · lento: {report['slowestSeconds']}s · promedio: {report['averageSeconds']}s")
    print(f"  todo en verde: {report['allPassed']}")
    print(f"  reporte: {path}")
    return 0 if report["allPassed"] else 1


if __name__ == "__main__":
    sys.exit(main())
