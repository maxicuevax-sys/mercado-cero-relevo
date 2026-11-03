#!/usr/bin/env python3
"""E2E de la verdad visible del pago (P0-2 a P0-5).

Corre en un servidor aislado en :3304 con DB temporal y DEMO_MODE=true.
Nunca toca :3000, :3230 ni la preview.

Cubre:
  a) venta demo + CoDi simulado: título demo, sin “Listo para entregar”,
     botón “Cerrar demo” sin PATCH fulfill; API devuelve 409.
  b) /success de un pedido pendiente no afirma débito ni retiene.
  c) cabecera “Ventas registradas hoy · Cobrado confirmado · Por cobrar de hoy”
     y “Cobrado confirmado” excluye pendiente/demo.
  d) /success de un pago demo dice demo/simulado, no verificado.

Capturas: %TEMP%\\opencode\\verdad-pago\\
"""

from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
PORT = int(os.environ.get("PAYMENT_TRUTH_PORT", "3304"))
BASE = os.environ.get(
    "PAYMENT_TRUTH_BASE_URL", f"http://127.0.0.1:{PORT}"
).rstrip("/")
CAPTURES = Path(tempfile.gettempdir()) / "opencode" / "verdad-pago"
KEEP_DB = os.environ.get("PAYMENT_TRUTH_KEEP_DB") == "1"

SERVER: subprocess.Popen | None = None
RUN_DIR: Path | None = None
results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")


def port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.4)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def which_npm() -> str:
    for name in ("npm.cmd", "npm"):
        found = shutil.which(name)
        if found:
            return found
    raise RuntimeError("No encontré npm en PATH.")


def request(method: str, path: str, data: dict | None = None) -> tuple[int, dict]:
    body = None if data is None else json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read() or b"{}")
        except Exception:
            return error.code, {}


def start_server() -> None:
    global SERVER, RUN_DIR
    if port_in_use(PORT):
        raise RuntimeError(f"El puerto {PORT} ya está ocupado; no lo reinicio.")
    RUN_DIR = Path(tempfile.mkdtemp(prefix="mercado-cero-verdad-pago-"))
    db_path = RUN_DIR / "mercado-cero.db"
    log_path = RUN_DIR / "server.log"
    env = os.environ.copy()
    env.update(
        {
            "PORT": str(PORT),
            "HOSTNAME": "127.0.0.1",
            "DATABASE_PATH": str(db_path),
            "DEMO_MODE": "true",
            "PEY_WEBHOOK_SECRET": "whsec_verdad_pago_e2e",
            "PEY_API_KEY": "",
            "OPENAI_API_KEY": "",
            "APP_URL": BASE,
        }
    )
    log = log_path.open("w", encoding="utf-8", errors="replace")
    kwargs: dict = {
        "cwd": str(WEB),
        "env": env,
        "stdout": log,
        "stderr": subprocess.STDOUT,
        "text": True,
    }
    if os.name == "nt":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    else:
        kwargs["start_new_session"] = True
    SERVER = subprocess.Popen([which_npm(), "start"], **kwargs)
    deadline = time.time() + 90
    while time.time() < deadline:
        if SERVER.poll() is not None:
            log.close()
            raise RuntimeError(
                f"El servidor terminó al arrancar.\n{log_path.read_text(errors='replace')[-4000:]}"
            )
        try:
            status, _ = request("GET", "/api/health")
            if status == 200:
                log.close()
                return
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(0.6)
    stop_server()
    log.close()
    raise RuntimeError(
        f"El servidor no respondió en 90 s.\n{log_path.read_text(errors='replace')[-4000:]}"
    )


def stop_server() -> None:
    global SERVER
    if not SERVER or SERVER.poll() is not None:
        SERVER = None
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(SERVER.pid), "/T", "/F"],
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
        else:
            os.killpg(os.getpgid(SERVER.pid), 15)
            SERVER.wait(timeout=10)
    except Exception:
        try:
            SERVER.kill()
        except Exception:
            pass
    SERVER = None


def cleanup() -> None:
    stop_server()
    if RUN_DIR and not KEEP_DB:
        shutil.rmtree(RUN_DIR, ignore_errors=True)


def create_order(description: str, amount_cents: int) -> dict:
    payload = {
        "items": [
            {
                "description": description,
                "quantity": 1,
                "unitPriceCents": amount_cents,
            }
        ],
        "requestId": f"verdad-pago-{time.time_ns()}",
    }
    status, body = request("POST", "/api/orders", payload)
    if status != 201:
        raise RuntimeError(f"No se pudo crear la venta: {status} {body}")
    return body["order"]


def create_link(order_id: str) -> dict:
    status, body = request("POST", f"/api/orders/{order_id}/pay", {"mode": "link"})
    if status != 200:
        raise RuntimeError(f"No se pudo generar el link: {status} {body}")
    return body["order"]


def order_detail(order_id: str) -> dict:
    status, body = request("GET", f"/api/orders/{order_id}")
    if status != 200:
        raise RuntimeError(f"No se pudo leer el pedido: {status} {body}")
    return body["order"]


def dashboard() -> dict:
    status, body = request("GET", "/api/dashboard")
    if status != 200:
        raise RuntimeError(f"No se pudo leer el dashboard: {status} {body}")
    return body


def mxn(cents: int) -> str:
    return f"${cents / 100:,.2f}"


def parse_header(text: str) -> re.Match[str] | None:
    return re.search(
        r"Ventas registradas hoy \$([\d,]+\.\d{2})"
        r" · Cobrado confirmado \$([\d,]+\.\d{2})"
        r" · Por cobrar de hoy \$([\d,]+\.\d{2})",
        text,
    )


def cents(value: str) -> int:
    return int(round(float(value.replace(",", "")) * 100))


def visible_text(page) -> str:
    return page.locator("body").inner_text()


def main() -> int:
    CAPTURES.mkdir(parents=True, exist_ok=True)
    start_server()
    console_errors: list[str] = []
    page_errors: list[str] = []
    fulfill_requests: list[str] = []

    try:
        pending = create_order("E2E pedido pendiente", 6000)
        demo = create_order("E2E venta demo", 9000)
        create_link(demo["id"])

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1280, "height": 900},
                locale="es-MX",
            )
            page = context.new_page()
            # La consulta local no depende de la IA: el parser responde “query”
            # y answerLocal arma la misma verdad que la cabecera.
            page.route(
                "**/api/voice/parse",
                lambda route: route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=json.dumps(
                        {
                            "intent": "query",
                            "items": [],
                            "cashCents": 0,
                            "customerName": None,
                            "creditCents": 0,
                            "creditMethod": None,
                            "query": "¿Cuánto vendí hoy?",
                            "confidence": 1,
                            "reply": "",
                        }
                    ),
                ),
            )
            page.on(
                "console",
                lambda message: console_errors.append(message.text)
                if message.type == "error"
                else None,
            )
            page.on("pageerror", lambda error: page_errors.append(str(error)))
            page.on(
                "request",
                lambda req: fulfill_requests.append(f"{req.method} {req.url}")
                if req.method == "PATCH" and "/api/orders/" in req.url
                else None,
            )

            # ------------------------------------------------------------------
            # c) Cabecera: tres cifras unívocas.
            # ------------------------------------------------------------------
            page.goto(BASE, wait_until="domcontentloaded")
            page.get_by_text("Ventas registradas hoy", exact=False).first.wait_for(
                timeout=20000
            )
            heading = page.locator(".screen-heading__subtitle").first.inner_text()
            before = dashboard()["summary"]
            before_confirmed = before["cashCents"] + before["verifiedDigitalCents"]
            match = parse_header(heading)
            check("cabecera muestra las tres etiquetas", match is not None, heading)
            if match:
                check(
                    "cabecera: ventas registradas = total del día",
                    cents(match.group(1)) == before["salesCents"],
                    f"UI {match.group(1)} vs API {mxn(before['salesCents'])}",
                )
                check(
                    "cabecera: cobrado confirmado = efectivo + pey",
                    cents(match.group(2)) == before_confirmed,
                    f"UI {match.group(2)} vs esperado {mxn(before_confirmed)}",
                )
                check(
                    "cabecera: por cobrar de hoy = pendiente de hoy",
                    cents(match.group(3)) == before["pendingCents"],
                    f"UI {match.group(3)} vs API {mxn(before['pendingCents'])}",
                )
                check(
                    "cobrado confirmado no incluye pendiente",
                    cents(match.group(2)) != before["pendingCents"]
                    or before["pendingCents"] == 0,
                    f"confirmado {match.group(2)}, pendiente {mxn(before['pendingCents'])}",
                )
            check(
                "franja de cobros dice todas las fechas",
                page.get_by_text("Cobros pendientes (todas las fechas)", exact=False).count()
                > 0,
            )
            check(
                "libreta separa cobrado confirmado de por cobrar",
                page.get_by_text("Cobrado confirmado de hoy", exact=False).count() > 0,
            )
            page.screenshot(path=str(CAPTURES / "01-cabecera.png"), full_page=True)

            # ------------------------------------------------------------------
            # a) Demo: simular CoDi y cerrar sin entrega.
            # ------------------------------------------------------------------
            demo_row = page.locator(".activity-list button").filter(
                has_text="E2E venta demo"
            ).first
            check("la venta demo aparece en Actividad", demo_row.count() == 1)
            demo_row.click()
            dialog = page.get_by_role("dialog")
            dialog.get_by_role("button", name=re.compile("Simular CoDi")).wait_for(
                timeout=10000
            )
            dialog.get_by_role("button", name=re.compile("Simular CoDi")).click()
            demo_title = dialog.get_by_text(
                re.compile(r"Pago (demo|simulado)"), exact=False
            )
            demo_title.first.wait_for(timeout=12000)
            dialog_text = dialog.inner_text()
            check(
                "el resultado demo se llama Pago demo/simulado",
                re.search(r"Pago (demo|simulado)", dialog_text, re.IGNORECASE)
                is not None,
            )
            check(
                "el resultado demo no ofrece Listo para entregar",
                "Listo para entregar" not in dialog_text,
                dialog_text[:200],
            )
            check(
                "el resultado demo se cierra con Cerrar demo",
                dialog.get_by_role("button", name=re.compile("Cerrar demo")).count() == 1,
            )
            page.screenshot(path=str(CAPTURES / "02-demo-resultado.png"), full_page=True)
            dialog.get_by_role("button", name=re.compile("Cerrar demo")).click()
            dialog.wait_for(state="hidden", timeout=10000)
            check(
                "cerrar demo no hace PATCH fulfill",
                len(fulfill_requests) == 0,
                ", ".join(fulfill_requests),
            )
            check(
                "el pedido demo queda en demo_paid",
                order_detail(demo["id"])["status"] == "demo_paid",
                order_detail(demo["id"])["status"],
            )
            api_status, api_body = request(
                "PATCH", f"/api/orders/{demo['id']}", {"action": "fulfill"}
            )
            check(
                "la API rechaza entregar un demo con 409",
                api_status == 409
                and api_body.get("code") == "demo_not_deliverable",
                f"{api_status} {api_body.get('code')}",
            )
            check(
                "el pedido demo sigue sin entregar tras el 409",
                order_detail(demo["id"])["status"] == "demo_paid",
            )

            # ------------------------------------------------------------------
            # b) Success de pedido pendiente: espera firma, no afirma débito.
            # ------------------------------------------------------------------
            page.goto(f"{BASE}/pay/{pending['id']}/success", wait_until="domcontentloaded")
            page.get_by_role("heading", level=1).first.wait_for(timeout=15000)
            pending_text = visible_text(page)
            check(
                "success pendiente dice que espera la confirmación firmada",
                "esperando la confirmación firmada de pey" in pending_text,
            )
            check(
                "success pendiente permite cerrar",
                "Puedes cerrar" in pending_text,
            )
            check(
                "success pendiente no dice que el pago salió del banco",
                "salió del banco" not in pending_text,
            )
            check(
                "success pendiente no obliga a quedarse",
                "No cierres" not in pending_text,
            )
            check(
                "success pendiente no se muestra como pagado",
                "Pago verificado por pey" not in pending_text
                and "Listo para entregar" not in pending_text,
            )
            page.screenshot(
                path=str(CAPTURES / "03-success-pendiente.png"), full_page=True
            )

            # ------------------------------------------------------------------
            # d) Success de pago demo: simulado, nunca verificado.
            # ------------------------------------------------------------------
            page.goto(f"{BASE}/pay/{demo['id']}/success", wait_until="domcontentloaded")
            page.get_by_role("heading", level=1).first.wait_for(timeout=15000)
            demo_success = visible_text(page)
            check(
                "success demo dice Pago demo (simulado)",
                "Pago demo (simulado)" in demo_success,
            )
            check(
                "success demo dice que no es dinero real",
                "No es dinero real" in demo_success
                or "no es dinero real" in demo_success,
            )
            check(
                "success demo no se muestra como verificado",
                "Pago verificado por pey" not in demo_success,
            )
            check(
                "success demo no ofrece entregar",
                "Listo para entregar" not in demo_success,
            )
            page.screenshot(path=str(CAPTURES / "04-success-demo.png"), full_page=True)

            # ------------------------------------------------------------------
            # c bis) Tras el demo, “Cobrado confirmado” sigue sin demo.
            # ------------------------------------------------------------------
            page.goto(BASE, wait_until="domcontentloaded")
            page.get_by_text("Ventas registradas hoy", exact=False).first.wait_for(
                timeout=20000
            )
            after_heading = page.locator(".screen-heading__subtitle").first.inner_text()
            after = dashboard()["summary"]
            after_confirmed = after["cashCents"] + after["verifiedDigitalCents"]
            demo_cents = after["demoCashCents"] + after["demoDigitalCents"]
            after_match = parse_header(after_heading)
            check("cabecera sigue mostrando las tres etiquetas", after_match is not None)
            if after_match:
                check(
                    "cobrado confirmado no cambió con el pago demo",
                    cents(after_match.group(2)) == before_confirmed,
                    f"antes {mxn(before_confirmed)} · después {after_match.group(2)}",
                )
                check(
                    "cobrado confirmado no incluye demo",
                    demo_cents <= 0
                    or cents(after_match.group(2)) != before_confirmed + 9000,
                    f"demo {mxn(demo_cents)}",
                )
                check(
                    "por cobrar de hoy ya no incluye la venta demo",
                    cents(after_match.group(3)) == after["pendingCents"],
                    f"UI {after_match.group(3)} vs API {mxn(after['pendingCents'])}",
                )

            # ------------------------------------------------------------------
            # c bis) Respuesta local por voz: misma verdad canónica.
            # ------------------------------------------------------------------
            # Silenciar evita que el E2E dependa de Piper/TTS y no cambia el
            # texto de la respuesta local.
            page.get_by_role("button", name="Silenciar voz").click()
            page.locator("#sale-text").fill("¿Cuánto vendí hoy?")
            page.get_by_role("button", name=re.compile("Interpretar")).click()
            answer = page.locator(".transcript-note").first.inner_text()
            check(
                "voz local ya no dice Hoy llevas",
                "Hoy llevas" not in answer,
                answer,
            )
            check(
                "voz local: ventas registradas hoy",
                f"Ventas registradas hoy {mxn(after['salesCents'])}" in answer,
                answer,
            )
            check(
                "voz local: cobrado confirmado solo efectivo + pey",
                f"Cobrado confirmado {mxn(after_confirmed)}" in answer,
                answer,
            )
            check(
                "voz local: por cobrar de hoy",
                f"Por cobrar de hoy {mxn(after['pendingCents'])}" in answer,
                answer,
            )
            check(
                "voz local: demo se declara como no dinero real",
                demo_cents <= 0
                or f"Demo {mxn(demo_cents)} (no es dinero real)" in answer,
                answer,
            )
            page.screenshot(path=str(CAPTURES / "05-voz-local.png"), full_page=True)

            check("sin errores de consola", not console_errors, "; ".join(console_errors[:3]))
            check("sin errores de página", not page_errors, "; ".join(page_errors[:3]))
            context.close()
            browser.close()
    finally:
        cleanup()

    failed = [item for item in results if not item["ok"]]
    print(f"\n{len(results) - len(failed)}/{len(results)} PASS")
    print(f"Capturas: {CAPTURES}")
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
