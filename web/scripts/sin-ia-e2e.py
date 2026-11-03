#!/usr/bin/env python3
"""E2E P0 · vender sin IA y recuperar la venta sin perder nada.

Cubre la aceptación de GOAL-ACOMPANAMIENTO P0-A con el endpoint real
`/api/voice/parse` en 500:

  1. El parser falla y la caja ofrece escribir o agregar a mano.
  2. Se crea una venta manual de 2 ítems por $90.
  3. Se reciben $100 en efectivo: cambio $10 y orden con paidCents=9000.
  4. Un borrador guardado se recupera; "Seguir" lo conserva y
     "Empezar de nuevo" exige confirmación antes de borrar.
  5. No hay ninguna llamada a IA para completar la venta.

El script arranca su propio servidor en :3303 con una base temporal y
DEMO_MODE=true si no se le pasa SIN_IA_BASE_URL. Las capturas y el JSON de
resultado quedan en %TEMP%/opencode/sin-ia/, fuera del repositorio.

Requisitos:
  pip install playwright
  python -m playwright install chromium
  cd web && npm run build

Uso:
  cd web
  python scripts/sin-ia-e2e.py

  # contra un servidor ya levantado:
  $env:SIN_IA_BASE_URL="http://127.0.0.1:3303"
  python scripts/sin-ia-e2e.py
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

WEB = Path(__file__).resolve().parents[1]
ROOT = WEB.parent
TEMP_ROOT = Path(os.environ.get("TEMP") or tempfile.gettempdir()) / "opencode" / "sin-ia"
TEMP_ROOT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get("SIN_IA_BASE_URL", "http://127.0.0.1:3303").rstrip("/")
BASE_PARTS = urlparse(BASE)
DRAFT_KEY = "mercado-cero:draft:v1"
RESULTS: list[dict] = []
AI_REQUESTS: list[dict] = []
BLOCKED_EXTERNAL: list[str] = []
SALE_PAYLOADS: list[dict] = []
SCREENSHOTS: list[str] = []
RESET_CLIENT = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' · ' + detail) if detail else ''}")


def note(name: str, detail: str = "") -> None:
    RESULTS.append({"name": name, "ok": None, "detail": detail})
    print(f"NOTE  {name}{(' · ' + detail) if detail else ''}")


def screenshot(page, name: str) -> None:
    path = TEMP_ROOT / name
    page.screenshot(path=str(path), full_page=True)
    SCREENSHOTS.append(str(path))
    print(f"SHOT  {path}")


def is_local(url: str) -> bool:
    parts = urlparse(url)
    return (
        parts.scheme in ("http", "https")
        and parts.hostname == BASE_PARTS.hostname
        and (parts.port or (443 if parts.scheme == "https" else 80))
        == (BASE_PARTS.port or (443 if BASE_PARTS.scheme == "https" else 80))
    )


def health_ok() -> bool:
    try:
        with urllib.request.urlopen(f"{BASE}/api/health", timeout=2) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def start_server():
    """Levanta un Next aislado. Devuelve (proceso, log, run_dir) o None."""
    if os.environ.get("SIN_IA_BASE_URL"):
        note("servidor", f"se usa SIN_IA_BASE_URL={BASE}")
        return None

    if health_ok():
        raise RuntimeError(
            f"El puerto de {BASE} ya responde. Este test necesita un servidor "
            "aislado: libéralo o define SIN_IA_BASE_URL para usar otro."
        )

    if not (WEB / ".next").exists():
        raise RuntimeError("Falta web/.next. Corre `npm run build` antes del E2E.")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = TEMP_ROOT / f"server-{stamp}"
    run_dir.mkdir(parents=True, exist_ok=True)
    db_path = run_dir / "mercado-cero.db"
    backup_dir = run_dir / "backups"
    log_path = run_dir / "server.log"

    env = os.environ.copy()
    env.update(
        {
            "PORT": str(BASE_PARTS.port or 3303),
            "DATABASE_PATH": str(db_path),
            "DATABASE_BACKUP_DIR": str(backup_dir),
            "DEMO_MODE": "true",
            "NEXT_TELEMETRY_DISABLED": "1",
        }
    )
    # Sin llaves: la venta manual no depende de IA ni de pagos reales.
    for key in ("OPENAI_API_KEY", "PEY_API_KEY", "PEY_WEBHOOK_SECRET"):
        env.pop(key, None)

    npm = shutil.which("npm.cmd") or shutil.which("npm") or "npm"
    log = open(log_path, "w", encoding="utf-8")
    creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    proc = subprocess.Popen(
        [npm, "start"],
        cwd=WEB,
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
        creationflags=creationflags,
    )

    deadline = time.time() + 90
    while time.time() < deadline:
        if proc.poll() is not None:
            log.close()
            raise RuntimeError(
                f"El servidor terminó antes de responder. Revisa {log_path}"
            )
        if health_ok():
            print(f"SERVER {BASE} · db={db_path} · log={log_path}")
            return proc, log, run_dir
        time.sleep(0.5)

    log.close()
    stop_server(proc)
    raise RuntimeError(f"El servidor no respondió en 90 s. Revisa {log_path}")


def stop_server(proc) -> None:
    if proc is None or proc.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            capture_output=True,
            check=False,
        )
    else:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


def reset(page) -> None:
    global RESET_CLIENT
    RESET_CLIENT += 1
    headers = {"x-forwarded-for": f"198.51.100.{(RESET_CLIENT % 200) + 1}"}
    response = page.request.post(f"{BASE}/api/demo/reset", headers=headers)
    assert response.ok, f"demo/reset falló: {response.status} {response.text()}"
    page.goto(BASE, wait_until="domcontentloaded")
    wait_ready(page)
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="domcontentloaded")
    wait_ready(page)


def wait_ready(page) -> None:
    page.wait_for_selector("h1:has-text('Caja')", timeout=30_000)
    page.get_by_role("button", name="Agregar a mano").wait_for(
        state="visible", timeout=30_000
    )


def order_ids(page) -> set[str]:
    response = page.request.get(f"{BASE}/api/orders")
    assert response.ok, response.text()
    return {order["id"] for order in response.json()["orders"]}


def fill_item(page, index: int, description: str, quantity: float, price: str) -> None:
    page.get_by_role("textbox", name="Producto").nth(index).fill(description)
    page.get_by_role("spinbutton", name="Cantidad").nth(index).fill(str(quantity))
    price_input = page.get_by_role("textbox", name="Precio unitario").nth(index)
    price_input.fill(price)
    price_input.press("Tab")


def min_height(page, selector: str) -> float:
    box = page.locator(selector).bounding_box()
    return round(box["height"], 1) if box else 0.0


def main() -> int:
    server = None
    proc = None
    log = None
    ok = False
    failure = ""

    try:
        server = start_server()
        if server:
            proc, log, _run_dir = server

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 1000})
            page = context.new_page()

            def gate(route):
                request = route.request
                url = request.url
                if "/api/voice/parse" in url:
                    AI_REQUESTS.append(
                        {
                            "kind": "parse",
                            "url": url,
                            "body": request.post_data,
                        }
                    )
                    route.fulfill(
                        status=500,
                        content_type="application/json",
                        body=json.dumps({"error": "La IA no está disponible."}),
                    )
                    return
                if "/api/voice/" in url:
                    AI_REQUESTS.append(
                        {"kind": "voice-other", "url": url, "body": request.post_data}
                    )
                    route.abort()
                    return
                if not is_local(url) and not url.startswith(("data:", "blob:")):
                    BLOCKED_EXTERNAL.append(url)
                    route.abort()
                    return
                if request.method == "POST" and urlparse(url).path == "/api/orders":
                    SALE_PAYLOADS.append(request.post_data_json or {})
                route.continue_()

            page.route("**/*", gate)

            # ---------------------------------------------------------------
            # 1 · Parser 500 + venta manual de 2 ítems + $100 sobre $90.
            # ---------------------------------------------------------------
            reset(page)
            before = order_ids(page)
            page.get_by_label("Escribe la venta").fill(
                "Dos quesadillas de 35 y un agua de 20"
            )
            page.get_by_role("button", name="Interpretar").click()

            error_alert = page.locator("p[role='alert']").filter(
                has_text="No pude interpretar la venta"
            )
            expect(error_alert).to_be_visible()
            error_text = error_alert.inner_text()
            check(
                "el fallo del parser explica qué hacer",
                "No pude interpretar la venta" in error_text
                and "La IA no está disponible" in error_text
                and "agrégalo a mano" in error_text,
                error_text,
            )
            check(
                "el fallo muestra la acción manual sin borrar nada",
                page.get_by_role("button", name="Agregar a mano").is_visible()
                and page.get_by_role("button", name="Escribir productos").is_visible()
                and page.get_by_role("textbox", name="Producto").count() == 0,
            )
            screenshot(page, "01-parser-500.png")

            page.get_by_role("button", name="Agregar a mano").click()
            page.wait_for_timeout(120)
            expect(page.get_by_role("textbox", name="Producto")).to_have_count(1)
            focused = page.evaluate("document.activeElement && document.activeElement.id")
            check(
                "Agregar a mano enfoca el producto del renglón nuevo",
                str(focused).startswith("draft-description-"),
                f"foco={focused}",
            )

            fill_item(page, 0, "Quesadilla", 2, "35")
            page.get_by_role("button", name="Agregar a mano").click()
            page.wait_for_timeout(120)
            expect(page.get_by_role("textbox", name="Producto")).to_have_count(2)
            fill_item(page, 1, "Agua", 1, "20")

            page.wait_for_function(
                "() => document.querySelector('#confirmar')?.innerText.includes('90.00')",
                timeout=5_000,
            )
            check(
                "dos renglones manuales suman $90",
                "90.00" in page.locator("#confirmar").inner_text(),
            )

            page.get_by_label("Efectivo recibido en pesos").fill("100")
            expect(page.locator("#cash-change")).to_contain_text("Cambio $10.00")
            check(
                "recibir $100 sobre $90 muestra cambio $10 antes de cobrar",
                "Cambio $10.00" in page.locator("#cash-change").inner_text()
                and "Se aplican $90.00" in page.locator("#cash-change").inner_text(),
            )
            screenshot(page, "02-venta-manual-90.png")

            with page.expect_response(
                lambda response: response.url.endswith("/api/orders")
                and response.request.method == "POST",
                timeout=15_000,
            ) as response_info:
                page.get_by_role("button", name="Confirmar venta").click()
            assert response_info.value.status == 201, response_info.value.text()

            dialog = page.get_by_role("dialog")
            expect(dialog).to_be_visible()
            expect(dialog.get_by_text("Resultado del cobro")).to_be_visible()
            expect(dialog.get_by_text("Cambio $10.00")).to_be_visible()
            expect(dialog.get_by_text("Efectivo recibido")).to_be_visible()
            screenshot(page, "03-cobro-cambio-10.png")

            orders = page.request.get(f"{BASE}/api/orders").json()["orders"]
            created = [order for order in orders if order["id"] not in before]
            check(
                "se crea una sola orden manual de $90 pagada en efectivo",
                len(created) == 1
                and created[0]["totalCents"] == 9000
                and created[0]["paidCents"] == 9000
                and created[0]["creditCents"] == 0
                and created[0]["status"] == "paid"
                and len(created[0]["items"]) == 2,
                json.dumps(created[0], ensure_ascii=False) if created else "sin orden",
            )
            check(
                "el POST lleva los 2 ítems manuales y solo $90 aplicados",
                len(SALE_PAYLOADS) == 1
                and len(SALE_PAYLOADS[0].get("items", [])) == 2
                and SALE_PAYLOADS[0].get("cashCents") == 9000,
                json.dumps(SALE_PAYLOADS[-1], ensure_ascii=False)
                if SALE_PAYLOADS
                else "sin payload",
            )

            page.keyboard.press("Escape")
            expect(dialog).to_be_hidden()
            check(
                "completar la venta no dispara otra llamada al parser",
                len(AI_REQUESTS) == 1
                and AI_REQUESTS[0]["kind"] == "parse"
                and "Dos quesadillas" in (AI_REQUESTS[0]["body"] or ""),
                f"llamadas={len(AI_REQUESTS)}",
            )

            # ---------------------------------------------------------------
            # 2 · Borrador recuperado: Seguir y Empezar de nuevo con confirmación.
            # ---------------------------------------------------------------
            reset(page)
            page.get_by_role("button", name="Agregar a mano").click()
            page.wait_for_timeout(120)
            fill_item(page, 0, "Borrador sin IA", 2, "10")
            page.get_by_role("button", name="Agregar a mano").click()
            page.wait_for_timeout(120)
            fill_item(page, 1, "Agua", 1, "10")
            page.wait_for_function(
                f"() => localStorage.getItem('{DRAFT_KEY}') !== null"
            )
            page.reload(wait_until="networkidle")
            wait_ready(page)

            banner = page.locator("div[role='status'][aria-live='polite']").filter(
                has_text="Recuperé tu venta"
            )
            expect(banner).to_be_visible()
            banner_text = banner.inner_text()
            check(
                "el banner dice qué se recuperó y desde cuándo",
                "Recuperé tu venta" in banner_text
                and "2 productos" in banner_text
                and "$30.00" in banner_text
                and "Nada se envía hasta que confirmes" in banner_text,
                banner_text.replace("\n", " · "),
            )
            check(
                "el banner ofrece Seguir y Empezar de nuevo",
                page.get_by_role("button", name="Seguir").count() == 1
                and page.get_by_role("button", name="Empezar de nuevo").count() == 1,
            )
            check(
                "las acciones del banner cumplen 48 px",
                min_height(page, "#restored-draft-keep") >= 48
                and min_height(page, "#restored-draft-restart") >= 48,
                f"seguir={min_height(page, '#restored-draft-keep')} "
                f"reiniciar={min_height(page, '#restored-draft-restart')}",
            )
            screenshot(page, "04-borrador-recuperado.png")

            page.get_by_role("button", name="Seguir").click()
            page.wait_for_timeout(150)
            check(
                "Seguir conserva la venta y oculta el banner",
                page.get_by_text(re.compile(r"Recuperé tu venta")).count() == 0
                and page.get_by_role("textbox", name="Producto").first.input_value()
                == "Borrador sin IA"
                and page.evaluate(f"localStorage.getItem('{DRAFT_KEY}')") is not None,
            )
            focused = page.evaluate("document.activeElement && document.activeElement.id")
            check(
                "Seguir deja el foco en el primer producto",
                str(focused).startswith("draft-description-"),
                f"foco={focused}",
            )

            page.reload(wait_until="networkidle")
            wait_ready(page)
            expect(page.get_by_text(re.compile(r"Recuperé tu venta"))).to_be_visible()

            page.get_by_role("button", name="Empezar de nuevo").click()
            page.wait_for_timeout(120)
            expect(
                page.get_by_text("Se borrará esta venta. No se puede deshacer.")
            ).to_be_visible()
            check(
                "Empezar de nuevo pide confirmación antes de borrar",
                page.get_by_role("textbox", name="Producto").count() == 2
                and page.evaluate(f"localStorage.getItem('{DRAFT_KEY}')") is not None
                and min_height(page, "#restored-draft-confirm") >= 48,
            )
            screenshot(page, "05-confirmar-empezar.png")

            page.get_by_role("button", name="Cancelar").click()
            page.wait_for_timeout(120)
            focused = page.evaluate("document.activeElement && document.activeElement.id")
            check(
                "Cancelar no borra y devuelve el foco a Empezar de nuevo",
                page.get_by_role("textbox", name="Producto").count() == 2
                and page.evaluate(f"localStorage.getItem('{DRAFT_KEY}')") is not None
                and focused == "restored-draft-restart",
                f"foco={focused}",
            )

            page.get_by_role("button", name="Empezar de nuevo").click()
            page.get_by_role("button", name="Sí, empezar de nuevo").click()
            page.wait_for_timeout(150)
            focused = page.evaluate("document.activeElement && document.activeElement.id")
            check(
                "Empezar de nuevo confirmado limpia la venta y el almacenamiento",
                page.get_by_role("textbox", name="Producto").count() == 0
                and page.get_by_text(re.compile(r"Recuperé tu venta")).count() == 0
                and page.evaluate(f"localStorage.getItem('{DRAFT_KEY}')") is None
                and focused == "draft-add-empty",
                f"foco={focused}",
            )

            # ---------------------------------------------------------------
            # 3 · Teclado, 48 px y texto ampliado a 360 px.
            # ---------------------------------------------------------------
            page.set_viewport_size({"width": 360, "height": 800})
            page.evaluate(
                "localStorage.setItem('mercado-cero:text-size', 'xlarge')"
            )
            page.reload(wait_until="networkidle")
            wait_ready(page)
            check(
                "con texto ampliado y 360 px, Agregar a mano sigue visible y a 48 px",
                page.get_by_role("button", name="Agregar a mano").is_visible()
                and min_height(page, "#sale-manual") >= 48,
                f"alto={min_height(page, '#sale-manual')}",
            )
            screenshot(page, "06-texto-grande-360.png")

            page.locator("#sale-manual").focus()
            page.keyboard.press("Enter")
            page.wait_for_timeout(150)
            focused = page.evaluate("document.activeElement && document.activeElement.id")
            check(
                "Agregar a mano funciona con teclado y enfoca el producto",
                page.get_by_role("textbox", name="Producto").count() == 1
                and str(focused).startswith("draft-description-"),
                f"foco={focused}",
            )
            page.evaluate("localStorage.setItem('mercado-cero:text-size', 'normal')")

            check(
                "no hubo ninguna llamada de transcripción ni de IA para completar",
                len(AI_REQUESTS) == 1
                and AI_REQUESTS[0]["kind"] == "parse"
                and not any(item["kind"] != "parse" for item in AI_REQUESTS),
                f"llamadas={json.dumps(AI_REQUESTS, ensure_ascii=False)}",
            )
            note(
                "red externa bloqueada",
                f"{len(BLOCKED_EXTERNAL)} solicitudes fuera de {BASE} abortadas",
            )

            browser.close()

        ok = all(result["ok"] for result in RESULTS if result["ok"] is not None)
    except Exception as error:  # noqa: BLE001 - el reporte debe incluir el fallo
        failure = f"{type(error).__name__}: {error}"
        print(f"ERROR {failure}")
        ok = False
    finally:
        if log is not None:
            log.close()
        stop_server(proc)

        payload = {
            "ok": ok and not failure,
            "baseUrl": BASE,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "failure": failure,
            "aiRequests": AI_REQUESTS,
            "blockedExternal": BLOCKED_EXTERNAL[:20],
            "salePayloads": SALE_PAYLOADS,
            "screenshots": SCREENSHOTS,
            "results": RESULTS,
            "passed": sum(1 for item in RESULTS if item["ok"] is True),
            "failed": sum(1 for item in RESULTS if item["ok"] is False),
            "notes": sum(1 for item in RESULTS if item["ok"] is None),
        }
        out = TEMP_ROOT / "sin-ia-e2e.json"
        out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(
            f"RESULT {'PASS' if payload['ok'] else 'FAIL'} · "
            f"{payload['passed']} pass · {payload['failed']} fail · "
            f"{payload['notes']} notes"
        )
        print(f"JSON  {out}")

    return 0 if ok and not failure else 1


if __name__ == "__main__":
    raise SystemExit(main())
