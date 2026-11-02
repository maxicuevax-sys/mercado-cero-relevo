#!/usr/bin/env python3
"""E2E reproducible del carril P0-C — abono confirmado y saldo vivo.

Requisitos:
  pip install playwright
  python -m playwright install chromium

Uso:
  # desde web/, con el build de producción ya generado:
  python scripts/p0-fiado-e2e.py

  # opcional: usar un servidor ya levantado en :3101
  $env:P0_EXTERNAL_SERVER="1"
  $env:P0_DB_PATH="C:\\ruta\\temporal\\p0-fiado.db"
  python scripts/p0-fiado-e2e.py

Por defecto el script levanta su propio `npm start` en :3101 con una base
temporal, la reinicia entre casos con /api/demo/reset y la elimina al final.
Nunca apunta a :3000. Escribe harness/evidence/p0-fiado-e2e.json.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.environ.get("P0_BASE_URL", "http://localhost:3101").rstrip("/")
PORT = urlparse(BASE).port or 80
if PORT == 3000:
    raise SystemExit("P0-FIADO E2E se niega a correr contra :3000.")
if "localhost" not in BASE and "127.0.0.1" not in BASE:
    raise SystemExit("P0-FIADO E2E exige un servidor local aislado.")

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
OUT = ROOT / "harness" / "evidence" / "p0-fiado-e2e.json"
SHOT = ROOT / "harness" / "evidence" / "p0-fiado-360.png"
EXTERNAL = os.environ.get("P0_EXTERNAL_SERVER") == "1"
KEEP_DB = os.environ.get("P0_KEEP_DB") == "1"
RUN_DIR: Path | None = None
DB_PATH = Path(os.environ.get("P0_DB_PATH", "")).expanduser() if os.environ.get("P0_DB_PATH") else None
SERVER: subprocess.Popen | None = None


def git_value(*args: str) -> str:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception:
        return ""


results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")


def note(name: str, detail: str = "") -> None:
    results.append({"name": name, "ok": None, "detail": detail})
    print(f"KNOWN  {name}{(' — ' + detail) if detail else ''}")


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


def start_server() -> subprocess.Popen:
    global DB_PATH
    if port_in_use(PORT):
        raise RuntimeError(
            f"El puerto {PORT} ya está ocupado. Cierra el servidor anterior o usa "
            "P0_EXTERNAL_SERVER=1 con P0_DB_PATH."
        )
    run_dir = Path(tempfile.mkdtemp(prefix="mercado-cero-p0-fiado-"))
    DB_PATH = run_dir / "mercado-cero.db"
    log_path = run_dir / "server.log"
    env = os.environ.copy()
    env.update(
        {
            "PORT": str(PORT),
            "DATABASE_PATH": str(DB_PATH),
            "DEMO_MODE": "true",
            # El parser local hace deterministas las frases del E2E.
            "OPENAI_API_KEY": "",
            # No dependemos de una APP_URL de :3000 para nada del flujo.
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
    process = subprocess.Popen([which_npm(), "start"], **kwargs)
    deadline = time.time() + 90
    while time.time() < deadline:
        if process.poll() is not None:
            log.close()
            raise RuntimeError(f"El servidor terminó al arrancar.\n{log_path.read_text(errors='replace')[-4000:]}")
        try:
            with urllib.request.urlopen(f"{BASE}/api/dashboard", timeout=2) as response:
                if response.status == 200:
                    log.close()
                    return process
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.6)
    stop_server(process)
    log.close()
    raise RuntimeError(f"El servidor no respondió en 90 s.\n{log_path.read_text(errors='replace')[-4000:]}")


def stop_server(process: subprocess.Popen | None) -> None:
    if not process or process.poll() is not None:
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
        else:
            os.killpg(os.getpgid(process.pid), 15)
            process.wait(timeout=10)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass


def cleanup() -> None:
    global RUN_DIR
    stop_server(SERVER)
    if RUN_DIR and not KEEP_DB:
        shutil.rmtree(RUN_DIR, ignore_errors=True)


def dashboard(page) -> dict:
    response = page.request.get(f"{BASE}/api/dashboard")
    assert response.ok, response.text()
    return response.json()


def credits(page) -> list[dict]:
    return dashboard(page)["credits"]


def credit_by_name(page, name: str) -> dict | None:
    for credit in credits(page):
        if (credit.get("customerName") or "").lower() == name.lower():
            return credit
    return None


def db_rows(sql: str, params: tuple = ()) -> list[tuple]:
    if not DB_PATH or not Path(DB_PATH).exists():
        raise RuntimeError("No hay DATABASE_PATH para inspeccionar credit_payments.")
    connection = sqlite3.connect(str(DB_PATH), timeout=5)
    try:
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection.execute(sql, params).fetchall()
    finally:
        connection.close()


def credit_payments(credit_id: str) -> list[dict]:
    rows = db_rows(
        "SELECT amount_cents, method FROM credit_payments WHERE credit_id = ? ORDER BY created_at ASC",
        (credit_id,),
    )
    return [{"amountCents": int(row[0]), "method": row[1]} for row in rows]


_reset_client = 0


def reset(page) -> None:
    # Cada reset simula un cliente distinto para no agotar el rate limit de la
    # demo (5/min por IP) durante el setup repetido de los casos.
    global _reset_client
    _reset_client += 1
    headers = {"x-forwarded-for": f"198.51.100.{(_reset_client % 200) + 1}"}
    response = page.request.post(f"{BASE}/api/demo/reset", headers=headers)
    assert response.ok, f"demo/reset falló: {response.status} {response.text()}"
    page.goto(BASE, wait_until="networkidle")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")


def wait_credit_balance(page, credit_id: str, expected: int, timeout: int = 8000) -> dict:
    deadline = time.time() + timeout / 1000
    latest: dict = {}
    while time.time() < deadline:
        latest = next(
            (item for item in credits(page) if item["id"] == credit_id),
            latest,
        )
        if latest.get("balanceCents") == expected:
            return latest
        page.wait_for_timeout(150)
    return latest


def open_voice_sheet(page) -> None:
    page.get_by_role("button", name="Juan me pagó 50 del fiado").click()
    page.get_by_role("dialog").wait_for(timeout=8000)


def create_credit_order(page, customer: str, cents: int, description: str) -> dict:
    response = page.request.post(
        f"{BASE}/api/orders",
        data={
            "items": [
                {
                    "description": description,
                    "quantity": 1,
                    "unitPriceCents": cents,
                }
            ],
            "cashCents": 0,
            "creditCents": cents,
            "customerName": customer,
        },
    )
    assert response.ok, response.text()
    order = response.json()["order"]
    assert order.get("creditId"), order
    return order


def main() -> int:
    global SERVER, RUN_DIR
    started_at = datetime.now(timezone.utc)
    start_commit = git_value("rev-parse", "HEAD")
    start_branch = git_value("rev-parse", "--abbrev-ref", "HEAD")
    start_dirty = bool(git_value("status", "--porcelain"))
    pay_posts: list[str] = []
    pay_bodies: list[dict] = []
    requests_to_3000: list[str] = []
    try:
        if not EXTERNAL:
            SERVER = start_server()
            RUN_DIR = Path(DB_PATH).parent if DB_PATH else None
        else:
            if not DB_PATH:
                raise RuntimeError("Con P0_EXTERNAL_SERVER=1 debes pasar P0_DB_PATH.")
            if not port_in_use(PORT):
                raise RuntimeError(f"No hay servidor en {BASE}.")
            with urllib.request.urlopen(f"{BASE}/api/dashboard", timeout=3) as response:
                if response.status != 200:
                    raise RuntimeError(f"{BASE}/api/dashboard respondió {response.status}.")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 1000})
            page = context.new_page()

            def track_request(request) -> None:
                if request.method == "POST" and re.search(r"/api/credits/[^/]+/pay$", request.url):
                    pay_posts.append(request.url)
                    try:
                        pay_bodies.append(json.loads(request.post_data or "{}"))
                    except Exception:
                        pay_bodies.append({})
                if re.search(r":3000(?:/|$)", request.url):
                    requests_to_3000.append(request.url)

            page.on("request", track_request)

            # 0 · La puerta de la voz no escribe: hoja abierta y saldo intacto.
            reset(page)
            juan = credit_by_name(page, "Juan")
            assert juan, "La demo debe sembrar el fiado de Juan."
            before = credit_payments(juan["id"])
            open_voice_sheet(page)
            dialog = page.get_by_role("dialog")
            text = dialog.inner_text()
            check(
                "la hoja muestra saldo vivo de Juan",
                "Saldo vivo: $50.00" in text and "original $50.00" in text,
                text.replace("\n", " · ")[:180],
            )
            check(
                "el monto interpretado prellena $50",
                page.get_by_role("spinbutton", name="Monto del abono en pesos").input_value()
                == "50.00",
            )
            page.wait_for_timeout(900)
            after = wait_credit_balance(page, juan["id"], 5000, timeout=1000)
            check(
                "el chip no modifica el saldo hasta confirmar",
                after.get("balanceCents") == 5000
                and len(credit_payments(juan["id"])) == len(before),
                f"saldo {after.get('balanceCents')} · abonos {len(before)}",
            )

            # 1 · Cancelar (incluido el borrador sucio) no toca el saldo.
            page.get_by_role("spinbutton", name="Monto del abono en pesos").fill("30")
            dialog.get_by_role("button", name="Cerrar").click()
            check(
                "cerrar con cambios pide confirmación",
                dialog.get_by_text("Tienes un abono sin guardar").count() == 1,
            )
            dialog.get_by_role("button", name="Descartar abono").click()
            page.wait_for_timeout(400)
            check(
                "descartar deja el saldo intacto",
                credit_by_name(page, "Juan")["balanceCents"] == 5000
                and len(credit_payments(juan["id"])) == len(before),
            )

            # 2 · Confirmar registra un abono con el método elegido.
            reset(page)
            juan = credit_by_name(page, "Juan")
            open_voice_sheet(page)
            dialog = page.get_by_role("dialog")
            dialog.get_by_text("Digital", exact=True).click()
            selected = dialog.locator('label[data-selected="true"]')
            check(
                "el método elegido se ve con check y estado",
                selected.count() == 1
                and "digital" in selected.inner_text().lower()
                and "elegido" in selected.inner_text().lower(),
                selected.inner_text().replace("\n", " · "),
            )
            dialog.get_by_role("button", name="Registrar abono").click()
            toast = page.get_by_text(re.compile(r"debe \$0\.00"))
            try:
                toast.first.wait_for(timeout=4000)
                toast_ok = True
            except Exception:
                toast_ok = False
            settled = wait_credit_balance(page, juan["id"], 0)
            rows = credit_payments(juan["id"])
            check(
                "confirmar registra exactamente un abono",
                len(rows) == 1 and rows[0]["amountCents"] == 5000,
                json.dumps(rows),
            )
            check(
                "el abono conserva el método elegido",
                len(rows) == 1 and rows[0]["method"] == "codi",
                json.dumps(rows),
            )
            check(
                "la confirmación deja el saldo en cero",
                settled.get("balanceCents") == 0,
                str(settled.get("balanceCents")),
            )
            check(
                "el aviso dice que Juan debe $0.00",
                toast_ok,
            )

            # 3 · Sobrepago: se aplica el saldo y se devuelve el resto.
            reset(page)
            juan = credit_by_name(page, "Juan")
            open_voice_sheet(page)
            dialog = page.get_by_role("dialog")
            page.get_by_role("spinbutton", name="Monto del abono en pesos").fill("100")
            page.wait_for_timeout(200)
            dialog.get_by_text("Efectivo", exact=True).click()
            check(
                "el sobrepago muestra aplicado y devuelto",
                dialog.get_by_text("Se aplican $50.00").count() >= 1
                and dialog.get_by_text("devuelve $50.00").count() >= 1,
                dialog.inner_text().replace("\n", " · ")[:220],
            )
            with page.expect_response(
                lambda response: response.request.method == "POST"
                and re.search(r"/api/credits/[^/]+/pay$", response.url) is not None
            ) as overpay_info:
                dialog.get_by_role("button", name="Registrar abono").click()
            overpay_response = overpay_info.value
            overpay_data = overpay_response.json()
            check(
                "la API del sobrepago reporta aplicado y devuelto",
                overpay_response.status == 200
                and overpay_data.get("appliedCents") == 5000
                and overpay_data.get("overpayCents") == 5000
                and overpay_data.get("duplicate") is False,
                json.dumps(overpay_data)[:260],
            )
            settled = wait_credit_balance(page, juan["id"], 0)
            rows = credit_payments(juan["id"])
            balances = db_rows("SELECT balance_cents FROM credits WHERE id = ?", (juan["id"],))
            check(
                "el sobrepago no registra más que el saldo",
                len(rows) == 1 and rows[0]["amountCents"] == 5000,
                json.dumps(rows),
            )
            check(
                "ningún saldo queda negativo",
                settled.get("balanceCents") == 0
                and balances
                and int(balances[0][0]) >= 0,
                f"saldo {settled.get('balanceCents')}",
            )

            # 4 · Doble clic: un solo POST y un solo abono.
            reset(page)
            juan = credit_by_name(page, "Juan")
            pay_posts.clear()
            open_voice_sheet(page)
            dialog = page.get_by_role("dialog")
            dialog.get_by_text("Efectivo", exact=True).click()
            dialog.get_by_role("button", name="Registrar abono").dblclick()
            wait_credit_balance(page, juan["id"], 0)
            page.wait_for_timeout(400)
            rows = credit_payments(juan["id"])
            check(
                "el doble clic no duplica el abono",
                len(rows) == 1 and rows[0]["amountCents"] == 5000,
                json.dumps(rows),
            )
            check(
                "el doble clic no manda dos POST",
                len(pay_posts) == 1,
                f"{len(pay_posts)} POST · {pay_posts}",
            )

            # 4b · Si otra pestaña liquidó el fiado, no se anuncia un abono falso.
            reset(page)
            juan = credit_by_name(page, "Juan")
            open_voice_sheet(page)
            external = page.request.post(
                f"{BASE}/api/credits/{juan['id']}/pay",
                data={"amountCents": 5000, "method": "cash"},
            )
            assert external.ok, external.text()
            dialog = page.get_by_role("dialog")
            dialog.get_by_text("Efectivo", exact=True).click()
            with page.expect_response(
                lambda response: response.request.method == "POST"
                and re.search(r"/api/credits/[^/]+/pay$", response.url) is not None
            ) as settled_info:
                dialog.get_by_role("button", name="Registrar abono").click()
            settled_response = settled_info.value
            check(
                "un fiado ya saldado responde 409 credit_settled",
                settled_response.status == 409
                and settled_response.json().get("code") == "credit_settled",
                f"{settled_response.status} · {settled_response.text()[:180]}",
            )
            try:
                page.get_by_text("ya está saldado").last.wait_for(timeout=4000)
                stale_ok = True
            except Exception:
                stale_ok = False
            page.wait_for_timeout(400)
            rows = credit_payments(juan["id"])
            check(
                "un saldo liquidado en otra pestaña no duplica el abono",
                len(rows) == 1 and rows[0]["amountCents"] == 5000,
                json.dumps(rows),
            )
            check(
                "un saldo liquidado en otra pestaña no anuncia falso éxito",
                stale_ok,
            )

            # 4c · El saldo cambió entre abrir la hoja y confirmar: 409 explícito.
            reset(page)
            juan = credit_by_name(page, "Juan")
            open_voice_sheet(page)
            external = page.request.post(
                f"{BASE}/api/credits/{juan['id']}/pay",
                data={"amountCents": 2000, "method": "cash", "requestId": "e2e-race-open"},
            )
            assert external.ok, external.text()
            dialog = page.get_by_role("dialog")
            dialog.get_by_text("Efectivo", exact=True).click()
            with page.expect_response(
                lambda response: response.request.method == "POST"
                and re.search(r"/api/credits/[^/]+/pay$", response.url) is not None
            ) as changed_info:
                dialog.get_by_role("button", name="Registrar abono").click()
            changed_response = changed_info.value
            check(
                "un saldo cambiado responde 409 balance_changed",
                changed_response.status == 409
                and changed_response.json().get("code") == "balance_changed",
                f"{changed_response.status} · {changed_response.text()[:180]}",
            )
            try:
                page.get_by_text("El saldo cambió a $30.00").first.wait_for(timeout=4000)
                changed_ok = True
            except Exception:
                changed_ok = False
            page.wait_for_timeout(400)
            rows = credit_payments(juan["id"])
            check(
                "un saldo cambiado entre apertura y POST responde explícito",
                changed_ok,
            )
            check(
                "un saldo cambiado entre apertura y POST no duplica el abono",
                len(rows) == 1 and rows[0]["amountCents"] == 2000,
                json.dumps(rows),
            )

            # 5 · Nombre exacto del parser y baseline real del borrador.
            reset(page)
            create_credit_order(page, "Juana", 20000, "Deuda de Juana")
            create_credit_order(page, "Ana", 3000, "Deuda de Ana")
            page.reload(wait_until="networkidle")
            phrase = "Me pagó a Juana 50 del fiado de Ana"
            parsed_response = page.request.post(
                f"{BASE}/api/voice/parse",
                data={"transcript": phrase},
            )
            assert parsed_response.ok, parsed_response.text()
            parsed = parsed_response.json()
            check(
                "mockParse devuelve customerName exacto",
                parsed.get("intent") == "credit_payment" and parsed.get("customerName") == "Juana",
                f"intent={parsed.get('intent')} · cliente={parsed.get('customerName')}",
            )
            juana = credit_by_name(page, "Juana")
            assert juana, "Falta el crédito de Juana."
            before = credit_payments(juana["id"])
            page.locator("#sale-text").fill(phrase)
            page.get_by_role("button", name="Interpretar", exact=True).click()
            dialog = page.get_by_role("dialog")
            dialog.wait_for(timeout=8000)
            dialog_text = dialog.inner_text()
            check(
                "la rama de nombre exacto abre la deuda de Juana, no la de Ana",
                "Juana" in dialog_text
                and "Saldo vivo: $200.00" in dialog_text
                and "Ana" not in dialog_text,
                dialog_text.replace("\n", " · ")[:220],
            )
            check(
                "la voz prellena $50 sobre un saldo de $200",
                page.get_by_role("spinbutton", name="Monto del abono en pesos").input_value()
                == "50.00",
            )
            dialog.get_by_role("button", name="Cerrar", exact=True).click()
            page.wait_for_timeout(300)
            check(
                "cerrar sin editar el monto prellenado no pide confirmación",
                page.get_by_role("dialog").count() == 0
                and credit_by_name(page, "Juana")["balanceCents"] == 20000
                and len(credit_payments(juana["id"])) == len(before),
            )
            page.get_by_role("button", name="Interpretar", exact=True).click()
            dialog = page.get_by_role("dialog")
            dialog.wait_for(timeout=8000)
            page.get_by_role("spinbutton", name="Monto del abono en pesos").fill("60")
            dialog.get_by_role("button", name="Cerrar", exact=True).click()
            check(
                "editar a $60 sí pide confirmación",
                dialog.get_by_text("Tienes un abono sin guardar").count() == 1,
            )
            dialog.get_by_role("button", name="Descartar abono").click()
            page.wait_for_timeout(300)
            check(
                "descartar el borrador editado no escribe el abono",
                credit_by_name(page, "Juana")["balanceCents"] == 20000
                and len(credit_payments(juana["id"])) == len(before),
            )

            # 6 · Ambigüedad: dos deudas de Juan no eligen una al azar.
            reset(page)
            create_credit_order(page, "Juan", 8000, "Segunda deuda de Juan")
            page.reload(wait_until="networkidle")
            juans = [c for c in credits(page) if (c.get("customerName") or "").lower() == "juan"]
            assert len(juans) >= 2, juans
            pay_posts.clear()
            page.get_by_role("button", name="Juan me pagó 50 del fiado").click()
            page.wait_for_timeout(700)
            check(
                "dos deudas de Juan no ejecutan un abono",
                page.get_by_role("dialog").count() == 0
                and page.get_by_text(re.compile(r"fiados abiertos")).count() >= 1
                and len(pay_posts) == 0
                and all(c["balanceCents"] == c["originalCents"] for c in juans),
                f"POST {len(pay_posts)}",
            )

            # 7 · Detalle, hoja y actividad leen el saldo vivo; liquidado dice Saldado.
            reset(page)
            order = create_credit_order(page, "Cliente Detalle", 10000, "Prueba fiado")
            credit_id = order["creditId"]
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(500)
            activity = page.get_by_role("button", name=re.compile(r"Prueba fiado")).first
            check(
                "la actividad muestra el saldo vivo",
                "saldo $100.00" in activity.inner_text(),
                activity.inner_text().replace("\n", " · "),
            )
            activity.click()
            detail = page.get_by_role("dialog")
            detail_text = detail.inner_text()
            check(
                "el detalle muestra saldo vivo y original",
                "Saldo vivo: $100.00" in detail_text
                and "original $100.00" in detail_text
                and "Saldo pendiente" not in detail_text,
                detail_text.replace("\n", " · ")[:220],
            )
            detail.get_by_role("button", name="Cerrar", exact=True).click()
            page.wait_for_timeout(300)

            page.get_by_role("button", name="Fiado", exact=True).first.click()
            page.wait_for_timeout(300)
            card = (
                page.locator("div.rounded-2xl")
                .filter(has=page.get_by_text("Cliente Detalle", exact=True))
                .last
            )
            card.get_by_role("button", name="Registrar abono").click()
            sheet = page.get_by_role("dialog")
            sheet_text = sheet.inner_text()
            check(
                "la hoja de abono muestra el saldo vivo antes del parcial",
                "Saldo vivo: $100.00" in sheet_text
                and "original $100.00" in sheet_text
                and "Saldo pendiente" not in sheet_text,
                sheet_text.replace("\n", " · ")[:220],
            )
            pay_bodies.clear()
            page.get_by_role("spinbutton", name="Monto del abono en pesos").fill("40")
            sheet.get_by_text("Efectivo", exact=True).click()
            sheet.get_by_role("button", name="Registrar abono").click()
            partial_balance = wait_credit_balance(page, credit_id, 6000)
            partial_rows = credit_payments(credit_id)
            check(
                "confirmar desde la hoja registra un abono parcial",
                len(partial_rows) == 1
                and partial_rows[0]["amountCents"] == 4000
                and partial_balance.get("balanceCents") == 6000,
                json.dumps(partial_rows),
            )
            check(
                "el POST de la hoja lleva requestId y saldo esperado",
                len(pay_bodies) == 1
                and bool(pay_bodies[0].get("requestId"))
                and pay_bodies[0].get("expectedBalanceCents") == 10000
                and pay_bodies[0].get("amountCents") == 4000,
                json.dumps(pay_bodies),
            )
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(500)
            activity = page.get_by_role("button", name=re.compile(r"Prueba fiado")).first
            check(
                "la actividad sigue el saldo después del parcial",
                "saldo $60.00" in activity.inner_text(),
                activity.inner_text().replace("\n", " · "),
            )
            activity.click()
            detail = page.get_by_role("dialog")
            detail_text = detail.inner_text()
            check(
                "el detalle muestra el saldo vivo después del parcial",
                "Saldo vivo: $60.00" in detail_text
                and "original $100.00" in detail_text
                and "Saldo pendiente" not in detail_text,
                detail_text.replace("\n", " · ")[:220],
            )
            detail.get_by_role("button", name="Cerrar", exact=True).click()
            page.wait_for_timeout(300)

            page.get_by_role("button", name="Fiado", exact=True).first.click()
            page.wait_for_timeout(300)
            card = (
                page.locator("div.rounded-2xl")
                .filter(has=page.get_by_text("Cliente Detalle", exact=True))
                .last
            )
            card.get_by_role("button", name="Registrar abono").click()
            sheet = page.get_by_role("dialog")
            sheet_text = sheet.inner_text()
            check(
                "la hoja de abono muestra saldo vivo, original y abonado",
                "Saldo vivo: $60.00" in sheet_text
                and "original $100.00" in sheet_text
                and "abonado $40.00" in sheet_text
                and "Saldo pendiente" not in sheet_text,
                sheet_text.replace("\n", " · ")[:220],
            )
            pay_bodies.clear()
            page.get_by_role("spinbutton", name="Monto del abono en pesos").fill("60")
            sheet.get_by_text("Efectivo", exact=True).click()
            sheet.get_by_role("button", name="Registrar abono").click()
            final_balance = wait_credit_balance(page, credit_id, 0)
            final_rows = credit_payments(credit_id)
            check(
                "liquidar desde la hoja registra el abono final",
                len(final_rows) == 2
                and sum(row["amountCents"] for row in final_rows) == 10000
                and final_balance.get("balanceCents") == 0,
                json.dumps(final_rows),
            )
            order_credit = db_rows(
                "SELECT credit_cents FROM orders WHERE id = ?",
                (order["id"],),
            )
            check(
                "orders.credit_cents sigue siendo el original tras liquidar",
                bool(order_credit) and int(order_credit[0][0]) == 10000,
                f"credit_cents={order_credit[0][0] if order_credit else 'sin fila'}",
            )
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(500)
            activity = page.get_by_role("button", name=re.compile(r"Prueba fiado")).first
            check(
                "la actividad dice Saldado al liquidar",
                "Saldado" in activity.inner_text(),
                activity.inner_text().replace("\n", " · "),
            )
            activity.click()
            detail = page.get_by_role("dialog")
            detail_text = detail.inner_text()
            check(
                "el detalle dice Saldado y conserva el original",
                "Saldado" in detail_text
                and "original $100.00" in detail_text
                and "Saldo pendiente" not in detail_text,
                detail_text.replace("\n", " · ")[:220],
            )
            detail.get_by_role("button", name="Cerrar", exact=True).click()

            # 8 · La misma requestId no duplica el abono.
            reset(page)
            juan = credit_by_name(page, "Juan")
            request_id = "e2e-request-id-1"
            first_pay = page.request.post(
                f"{BASE}/api/credits/{juan['id']}/pay",
                data={
                    "amountCents": 2000,
                    "method": "cash",
                    "requestId": request_id,
                    "expectedBalanceCents": 5000,
                },
            )
            first_data = first_pay.json()
            check(
                "el primer abono con requestId se aplica una vez",
                first_pay.status == 200
                and first_data.get("duplicate") is False
                and first_data.get("appliedCents") == 2000
                and first_data.get("balanceCents") == 3000
                and first_data.get("overpayCents") == 0,
                json.dumps(first_data)[:260],
            )
            second_pay = page.request.post(
                f"{BASE}/api/credits/{juan['id']}/pay",
                data={
                    "amountCents": 3000,
                    "method": "codi",
                    "requestId": request_id,
                },
            )
            second_data = second_pay.json()
            rows = credit_payments(juan["id"])
            stored_request = db_rows(
                "SELECT request_id FROM credit_payments WHERE credit_id = ?",
                (juan["id"],),
            )
            check(
                "reintentar con otro monto no duplica ni inventa devuelto",
                second_pay.status == 200
                and second_data.get("duplicate") is True
                and second_data.get("appliedCents") == 2000
                and second_data.get("overpayCents") == 0
                and second_data.get("balanceCents") == 3000
                and len(rows) == 1
                and rows[0]["amountCents"] == 2000
                and stored_request
                and stored_request[0][0] == request_id,
                json.dumps({"rows": rows, "second": second_data})[:340],
            )

            # 8b · La misma requestId en otro fiado no se acepta.
            other_order = create_credit_order(page, "Otra Persona", 3000, "Otra deuda")
            other_credit_id = other_order["creditId"]
            conflict_pay = page.request.post(
                f"{BASE}/api/credits/{other_credit_id}/pay",
                data={"amountCents": 1000, "method": "cash", "requestId": request_id},
            )
            conflict_data = conflict_pay.json()
            check(
                "la misma requestId en otro fiado responde request_id_conflict",
                conflict_pay.status == 409
                and conflict_data.get("code") == "request_id_conflict"
                and len(credit_payments(other_credit_id)) == 0,
                f"{conflict_pay.status} · {json.dumps(conflict_data)[:220]}",
            )

            # 9 · Respuesta perdida: el reintento de la misma hoja no muestra “devuelve”.
            reset(page)
            juan = credit_by_name(page, "Juan")
            open_voice_sheet(page)
            dialog = page.get_by_role("dialog")
            dialog.get_by_text("Efectivo", exact=True).click()
            lost_request_id: str | None = None
            pay_bodies.clear()

            def lose_first_response(route):
                nonlocal lost_request_id
                try:
                    body = json.loads(route.request.post_data or "{}")
                    lost_request_id = body.get("requestId")
                    route.fetch()
                finally:
                    route.abort()

            page.route("**/api/credits/*/pay", lose_first_response)
            dialog.get_by_role("button", name="Registrar abono").click()
            try:
                page.get_by_text(re.compile("Revisa tu conexión")).first.wait_for(timeout=5000)
                lost_visible = True
            except Exception:
                lost_visible = False
            page.unroute("**/api/credits/*/pay")
            lost_balance = wait_credit_balance(page, juan["id"], 0)
            dialog.get_by_role("button", name="Registrar abono").click()
            try:
                page.get_by_text("Abono ya registrado").first.wait_for(timeout=5000)
                duplicate_toast = page.get_by_text("Abono ya registrado").first.inner_text()
                duplicate_visible = True
            except Exception:
                duplicate_toast = ""
                duplicate_visible = False
            page.wait_for_timeout(300)
            rows = credit_payments(juan["id"])
            check(
                "una respuesta perdida deja un solo abono y conserva el requestId",
                lost_visible
                and lost_request_id is not None
                and lost_balance.get("balanceCents") == 0
                and len(rows) == 1
                and rows[0]["amountCents"] == 5000
                and len(pay_bodies) >= 2
                and pay_bodies[-1].get("requestId") == lost_request_id,
                f"requestId={lost_request_id} · rows={json.dumps(rows)}",
            )
            check(
                "el reintento dice Abono ya registrado sin devuelve",
                duplicate_visible
                and "Se aplicaron $50.00" in duplicate_toast
                and "devuelve" not in duplicate_toast.lower(),
                duplicate_toast[:260],
            )

            # 9 · Chequeo 360 px con artefacto.
            context360 = browser.new_context(viewport={"width": 360, "height": 800})
            page360 = context360.new_page()
            page360.on("request", track_request)
            reset(page360)
            open_voice_sheet(page360)
            page360.wait_for_timeout(250)
            SHOT.parent.mkdir(parents=True, exist_ok=True)
            page360.screenshot(path=str(SHOT))
            metrics360 = page360.evaluate(
                """() => {
                    const dialog = document.querySelector('[role="dialog"]');
                    return {
                        innerWidth: window.innerWidth,
                        documentScrollWidth: document.documentElement.scrollWidth,
                        dialogScrollWidth: dialog ? dialog.scrollWidth : 0,
                    };
                }"""
            )
            check(
                "la hoja a 360 px no desborda horizontalmente",
                metrics360["documentScrollWidth"] <= metrics360["innerWidth"] + 1
                and metrics360["dialogScrollWidth"] <= metrics360["innerWidth"] + 1,
                json.dumps(metrics360),
            )
            page360.get_by_role("dialog").get_by_text("Efectivo", exact=True).click()
            check(
                "la hoja a 360 px muestra el método con estado",
                page360.get_by_role("dialog").get_by_text("ELEGIDO").count() >= 1,
            )
            context360.close()

            # 10 · Aislamiento: ninguna petición del navegador a :3000.
            check(
                "el navegador no habló con :3000",
                len(requests_to_3000) == 0,
                f"{len(requests_to_3000)} peticiones",
            )
            check(
                "el carril corre en un puerto aislado, no en :3000",
                PORT != 3000,
                BASE,
            )

            browser.close()
    finally:
        cleanup()

    passed = sum(1 for item in results if item["ok"] is True)
    failed = sum(1 for item in results if item["ok"] is False)
    known = sum(1 for item in results if item["ok"] is None)
    summary = {"pass": passed, "fail": failed, "known": known, "total": len(results)}
    try:
        next_version = json.loads((WEB / "package.json").read_text(encoding="utf-8"))["dependencies"]["next"]
    except Exception:
        next_version = "desconocida"
    payload = {
        "schemaVersion": 1,
        "suite": "p0-fiado-e2e",
        "baseUrl": BASE,
        "command": "python web/scripts/p0-fiado-e2e.py",
        "artifacts": ["harness/evidence/p0-fiado-360.png"],
        "requires": [
            "pip install playwright",
            "python -m playwright install chromium",
            "npm run build",
        ],
        "code": {
            "commit": start_commit,
            "branch": start_branch,
            "dirty": start_dirty,
        },
        "build": {"next": next_version, "command": "npm run build"},
        "startedAt": started_at.isoformat(),
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "summary": summary,
        "results": results,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nP0 FIADO E2E — {passed} PASS · {failed} FAIL · {known} KNOWN")
    print(f"EVIDENCIA {OUT}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
