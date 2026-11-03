"""
Ensayo cronometrado del guion de demo sobre la UI nueva.
Corre 3 veces y guarda demo/rehearsal.json.

Uso:
  python scripts/rehearse-demo.py

Requiere el servidor en http://localhost:3000 (o REHEARSAL_BASE_URL).

El pago demo deja la orden en `demo_paid`. La app rechaza a propósito
"Listo para entregar" en ese estado (409, ver web/src/lib/orders.ts), así que
el ensayo cierra la hoja de resultado con "Cerrar" y comprueba que el fondo
recupera la interacción antes de pulsar el chip de fiado.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = (
    os.environ.get("REHEARSAL_BASE_URL")
    or os.environ.get("BASE_URL")
    or "http://localhost:3000"
).rstrip("/")
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "demo"
OUT.mkdir(parents=True, exist_ok=True)
ERROR_SHOT = OUT / "rehearsal-error.png"
ERROR_STATE = OUT / "rehearsal-error.json"

RUNS = 3
results: list[dict] = []


def wait_text(page, text: str, timeout: int = 12000) -> bool:
    try:
        page.wait_for_selector(f"text={text}", timeout=timeout)
        return True
    except Exception:
        return False


def page_state(page) -> dict:
    """Estado mínimo para entender por qué una hoja bloquea la caja."""
    try:
        return page.evaluate(
            """() => {
              const dialogs = [...document.querySelectorAll('[role="dialog"]')];
              const shell = document.querySelector('.app-shell');
              return {
                url: location.href,
                title: document.title,
                dialogs: dialogs.map((dialog) => ({
                  title: dialog.querySelector('h2')?.innerText ?? null,
                  text: (dialog.innerText || '').replace(/\\s+/g, ' ').slice(0, 400),
                  buttons: [...dialog.querySelectorAll('button')].map(
                    (button) => button.innerText || button.getAttribute('aria-label')
                  ),
                })),
                inert: shell ? Boolean(shell.inert) : null,
                body: (document.body?.innerText || '').replace(/\\s+/g, ' ').slice(0, 600),
              };
            }"""
        )
    except Exception as exc:  # La página pudo cerrarse antes de capturar.
        return {"error": repr(exc)}


def sheets_clear(state: dict) -> bool:
    """La caja solo está libre si existe, no está inert y no hay hojas."""
    return (
        not state.get("error")
        and not state.get("dialogs")
        and state.get("inert") is False
    )


def sheets_closed(page, timeout: int = 6000) -> bool:
    try:
        page.wait_for_function(
            """() => {
              const shell = document.querySelector('.app-shell');
              return Boolean(shell) && !shell.inert && !document.querySelector('[role="dialog"]');
            }""",
            timeout=timeout,
        )
        return True
    except Exception:
        return False


def close_all_sheets(page, timeout: int = 8000) -> dict:
    """Cierra toda hoja abierta probando Escape y, si queda, el botón Cerrar."""
    deadline = time.time() + timeout / 1000
    while time.time() < deadline:
        state = page_state(page)
        if sheets_clear(state):
            return state

        if not state.get("dialogs"):
            # Una hoja acaba de desmontarse: deja que React libere `inert`.
            page.wait_for_timeout(100)
            continue

        page.keyboard.press("Escape")
        page.wait_for_timeout(120)
        state = page_state(page)
        if sheets_clear(state):
            return state

        dialog = page.get_by_role("dialog").last
        try:
            discard = dialog.get_by_role("button", name="Descartar abono", exact=True)
            if discard.count():
                discard.click(timeout=1500)
            else:
                dialog.get_by_role("button", name="Cerrar", exact=True).click(timeout=1500)
        except Exception:
            # Si el botón no está accesible, el siguiente intento vuelve a
            # probar Escape; no ocultamos el estado final.
            pass
        page.wait_for_timeout(200)
    return page_state(page)


def reset_demo(page, iteration: int) -> None:
    # Cada ensayo se presenta como un cliente distinto para no agotar el
    # rate limit de 5/min y para no compartir estado con la corrida anterior.
    headers = {"x-forwarded-for": f"198.51.100.{100 + iteration}"}
    token = os.environ.get("DEMO_RESET_TOKEN", "").strip()
    if token:
        headers["x-demo-token"] = token
    response = page.request.post(f"{BASE}/api/demo/reset", headers=headers)
    if not response.ok:
        raise RuntimeError(
            f"demo/reset falló: HTTP {response.status} — {response.text()[:300]}"
        )


def credit_snapshot(page) -> list[dict]:
    response = page.request.get(f"{BASE}/api/credits?limit=100")
    if not response.ok:
        raise RuntimeError(
            f"/api/credits falló: HTTP {response.status} — {response.text()[:300]}"
        )
    return response.json().get("credits", [])


def cash_snapshot(page) -> dict:
    response = page.request.get(f"{BASE}/api/cash")
    if not response.ok:
        raise RuntimeError(
            f"/api/cash falló: HTTP {response.status} — {response.text()[:300]}"
        )
    return response.json()


def pick_juan(credits: list[dict]) -> dict | None:
    for credit in credits:
        if (credit.get("customerName") or "").strip().lower() == "juan":
            return credit
    return None


def run_once(page, iteration: int) -> dict:
    errors: list[str] = []
    steps: list[dict] = []
    started = time.time()
    def on_console(message) -> None:
        if message.type != "error":
            return
        location = message.location or {}
        url = location.get("url", "") if isinstance(location, dict) else ""
        # Piper no está instalado en el entorno de ensayo: el TTS fijo
        # responde 503 y el navegador lo registra. Es una degradación
        # esperada del entorno, no un fallo del guion.
        if "503" in message.text and "/api/tts" in url:
            return
        errors.append(f"{message.text} @ {url}" if url else message.text)

    page.on("console", on_console)
    page.on("pageerror", lambda error: errors.append(str(error)))

    def step(name: str, ok: bool, detail: str = "") -> None:
        steps.append({"name": name, "ok": bool(ok), "detail": detail})
        print(f"  {'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")

    def fail(detail: str) -> None:
        raise RuntimeError(detail)

    try:
        reset_demo(page, iteration)

        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_selector("h1:has-text('Caja')", timeout=15000)
        page.wait_for_function(
            "() => document.body.innerText.includes('Ventas registradas hoy')",
            timeout=20000,
        )
        page.wait_for_timeout(400)
        started = time.time()

        # 1. Venta por texto.
        page.get_by_role("heading", name="Caja", exact=True).wait_for()
        page.get_by_role(
            "button", name="Dos quesadillas de 35 y un agua de 20"
        ).click()
        step("venta interpretada", wait_text(page, "2 productos"))
        step("total $90", wait_text(page, "$90.00"))
        page.get_by_role("button", name="Confirmar venta").click()
        step("cobro visible", wait_text(page, "Link de pago"))

        # 2. Link + pago demo. El resultado se cierra con "Cerrar": un pago
        # demo no se puede marcar como entregado (409 intencional).
        page.get_by_role("button", name=re.compile("Link de pago")).click()
        step("link generado", wait_text(page, "Simular CoDi"))
        page.get_by_role("button", name="Simular CoDi").click()
        result_dialog = page.get_by_role("dialog")
        try:
            result_dialog.get_by_role(
                "heading", name="Pago demo (simulado)", exact=True
            ).wait_for(timeout=15000)
            demo_confirmed = True
        except Exception:
            demo_confirmed = False
        step("pago demo confirmado", demo_confirmed)
        if not demo_confirmed:
            fail("La hoja de resultado no llegó a Pago demo (simulado).")

        result_dialog.wait_for(timeout=8000)
        result_text = result_dialog.inner_text()
        if (
            "Pago demo (simulado)" not in result_text
            or "No se entrega." not in result_text
        ):
            fail("La hoja visible no es la hoja de resultado del cobro.")
        result_dialog.get_by_role("button", name="Cerrar", exact=True).click()
        closed = sheets_closed(page)
        closed_state = close_all_sheets(page) if not closed else page_state(page)
        step(
            "hoja de resultado cerrada",
            sheets_clear(closed_state),
            f"dialogs={len(closed_state.get('dialogs') or [])} inert={closed_state.get('inert')}",
        )
        if not sheets_clear(closed_state):
            fail(f"La caja sigue bloqueada: {json.dumps(closed_state, ensure_ascii=False)}")

        # 3. Fiado: el chip abre la hoja; si no está en el DOM, se usa Fiado.
        chip = page.get_by_role("button", name=re.compile(r"Juan pagó \$50"))
        used_fallback = False
        if chip.count() == 0:
            used_fallback = True
            print(
                "  KNOWN  chip 'Juan pagó $50' ausente; abriendo el abono desde Fiado."
            )
            page.get_by_role("button", name="Fiado", exact=True).first.click()
            row = page.locator(".credit-row").filter(has_text="Juan").first
            row.get_by_role("button", name="Registrar abono").click()
        else:
            chip.first.click(timeout=8000)

        step("hoja de abono visible", wait_text(page, "Saldo vivo:"))
        page.get_by_role("dialog").get_by_text("Efectivo", exact=True).click()
        page.get_by_role("dialog").get_by_role("button", name="Registrar abono").click()
        step("abono confirmado", wait_text(page, "debe $0.00"))

        credits_after = credit_snapshot(page)
        juan = pick_juan(credits_after)
        balance = juan.get("balanceCents") if juan else None
        step(
            "saldo de Juan en $0.00",
            balance == 0,
            f"balanceCents={balance} · vía={'Fiado' if used_fallback else 'chip'}",
        )
        cash_after = cash_snapshot(page)
        step(
            "abono de $50 en efectivo",
            cash_after.get("cashCreditCents") == 5000,
            f"cashCreditCents={cash_after.get('cashCreditCents')}",
        )

        # 4. Consulta por voz. Si el abono se abrió desde Fiado, vuelve a Caja.
        if used_fallback:
            page.get_by_role("button", name="Caja", exact=True).first.click()
            page.get_by_role("heading", name="Caja", exact=True).wait_for(timeout=8000)
        page.get_by_role("button", name="¿Cuánto vendí hoy?").click()
        try:
            transcript_note = page.locator(".transcript-note")
            transcript_note.filter(has_text="Cobrado confirmado").wait_for(timeout=12000)
            transcript_text = transcript_note.inner_text()
            consulta_ok = (
                "Ventas registradas hoy" in transcript_text
                and "Por cobrar de hoy" in transcript_text
            )
        except Exception:
            consulta_ok = False
        step("consulta de ventas", consulta_ok)

        # 5. Anti-fraude.
        page.get_by_role("button", name="Verificar comprobante", exact=True).first.click()
        page.wait_for_selector("text=Verificar comprobante", timeout=12000)
        page.get_by_role("button", name="Probar con un comprobante falso").click()
        step("comprobante falso rechazado", wait_text(page, "No verificado"))
        page.keyboard.press("Escape")
        verify_state = close_all_sheets(page)
        if not sheets_clear(verify_state):
            fail(f"La verificación dejó la caja bloqueada: {json.dumps(verify_state, ensure_ascii=False)}")

        # 6. Corte de caja: refrescar, contar $550 y guardar.
        page.get_by_role("button", name="Corte", exact=True).first.click()
        page.wait_for_selector("text=Corte de caja", timeout=12000)
        step("corte visible", page.get_by_text("Corte de caja", exact=False).first.is_visible())
        page.locator('button[title="Actualizar corte"]').click()
        step("corte espera $550", wait_text(page, "$550.00"))
        cash_before_close = cash_snapshot(page)
        step(
            "corte en servidor espera $550",
            cash_before_close.get("expectedCents") == 55000
            and cash_before_close.get("cashCreditCents") == 5000,
            f"expectedCents={cash_before_close.get('expectedCents')} "
            f"cashCreditCents={cash_before_close.get('cashCreditCents')}",
        )
        page.get_by_role("button", name="Contar por billetes y monedas").click()
        page.wait_for_timeout(250)
        page.get_by_label("Cantidad de $100", exact=True).fill("5")
        page.get_by_label("Cantidad de $50", exact=True).fill("1")
        page.get_by_label("Cantidad de $20", exact=True).fill("0")
        step("conteo cuadra", wait_text(page, "Cuadra"))
        page.get_by_role("button", name="Guardar corte").click()
        page.wait_for_selector("[role=dialog]", timeout=8000)
        page.get_by_role("dialog").get_by_role("button", name="Guardar corte").click()
        try:
            page.get_by_text(re.compile(r"Corte #\d+ guardado")).first.wait_for(timeout=12000)
            corte_ok = True
        except Exception:
            corte_ok = False
        step("corte guardado", corte_ok)
        if not corte_ok:
            fail("El corte no confirmó que se guardó.")

        # 7. Meta.
        page.get_by_role("button", name="Meta", exact=True).first.click()
        page.wait_for_timeout(400)
        step("meta visible", page.get_by_text("Mi camino", exact=False).first.is_visible())
        page.get_by_label("¿Cuánto apartaste?").fill("25")
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
            "usedFiadoFallback": used_fallback,
        }
    except Exception as exc:
        state = page_state(page)
        shot: str | None = None
        try:
            page.screenshot(path=str(ERROR_SHOT), full_page=True)
            shot = str(ERROR_SHOT)
        except Exception as shot_error:
            state["screenshotError"] = repr(shot_error)

        diagnostic = {
            "iteration": iteration,
            "error": repr(exc),
            "state": state,
            "screenshot": shot,
        }
        try:
            ERROR_STATE.write_text(
                json.dumps(diagnostic, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as write_error:
            print(f"  AVISO  no pude escribir {ERROR_STATE.name}: {write_error!r}")

        step("ensayo completo", False, str(exc))
        print("  ESTADO EN FALLO:")
        print(json.dumps(diagnostic, ensure_ascii=False, indent=2))
        elapsed = time.time() - started
        return {
            "iteration": iteration,
            "seconds": round(elapsed, 1),
            "steps": steps,
            "consoleErrors": errors,
            "passed": sum(1 for item in steps if item["ok"]),
            "failed": sum(1 for item in steps if not item["ok"]),
            "error": repr(exc),
            "failure": diagnostic,
        }


def main() -> int:
    for stale in (ERROR_SHOT, ERROR_STATE):
        if stale.exists():
            stale.unlink()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for iteration in range(1, RUNS + 1):
            print(f"\nENSAYO {iteration}/{RUNS}")
            # Contexto nuevo por ensayo: localStorage, foco y hojas no se
            # heredan de la corrida anterior.
            context = browser.new_context(
                viewport={"width": 1280, "height": 800}, locale="es-MX"
            )
            page = context.new_page()
            try:
                results.append(run_once(page, iteration))
            finally:
                context.close()

        browser.close()

    durations = [item["seconds"] for item in results]
    all_passed = (
        len(results) == RUNS
        and all(
            item["failed"] == 0
            and not item["consoleErrors"]
            and not item.get("error")
            for item in results
        )
    )
    report = {
        "baseUrl": BASE,
        "runs": results,
        "fastestSeconds": min(durations),
        "slowestSeconds": max(durations),
        "averageSeconds": round(sum(durations) / len(durations), 1),
        "allPassed": all_passed,
    }
    path = OUT / "rehearsal.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nRESUMEN")
    print(
        f"  rápido: {report['fastestSeconds']}s · lento: {report['slowestSeconds']}s · promedio: {report['averageSeconds']}s"
    )
    print(f"  todo en verde: {report['allPassed']}")
    print(f"  reporte: {path}")
    if all_passed:
        print("REHEARSAL OK")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
