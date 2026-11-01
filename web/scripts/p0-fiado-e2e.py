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


def reset(page) -> None:
    response = page.request.post(f"{BASE}/api/demo/reset")
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
    pay_posts: list[str] = []
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
            selected = dialog.locator('[data-selected="true"]')
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
            check(
                "el sobrepago muestra aplicado y devuelto",
                dialog.get_by_text("Se aplican $50.00").count() >= 1
                and dialog.get_by_text("devuelve $50.00").count() >= 1,
                dialog.inner_text().replace("\n", " · ")[:220],
            )
            dialog.get_by_role("button", name="Registrar abono").click()
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
            dialog.get_by_role("button", name="Registrar abono").click()
            try:
                page.get_by_text("ya está saldado").first.wait_for(timeout=4000)
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

            # 5 · Ambigüedad: dos deudas de Juan no eligen una al azar.
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

            # 6 · Detalle, hoja y actividad leen el saldo vivo; liquidado dice Saldado.
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

            partial = page.request.post(
                f"{BASE}/api/credits/{credit_id}/pay",
                data={"amountCents": 4000, "method": "codi"},
            )
            assert partial.ok, partial.text()
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(500)
            activity = page.get_by_role("button", name=re.compile(r"Prueba fiado")).first
            check(
                "la actividad sigue el saldo después de un abono",
                "saldo $60.00" in activity.inner_text(),
                activity.inner_text().replace("\n", " · "),
            )

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
                "la hoja de abono muestra el saldo vivo, no el original",
                "Saldo vivo: $60.00" in sheet_text
                and "original $100.00" in sheet_text
                and "Saldo pendiente" not in sheet_text,
                sheet_text.replace("\n", " · ")[:220],
            )
            sheet.get_by_role("button", name="Cerrar", exact=True).click()
            page.wait_for_timeout(300)

            final = page.request.post(
                f"{BASE}/api/credits/{credit_id}/pay",
                data={"amountCents": 6000, "method": "cash"},
            )
            assert final.ok, final.text()
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

            # 7 · Aislamiento: ninguna petición del navegador a :3000.
            check(
                "el navegador no habló con :3000",
                len(requests_to_3000) == 0,
                f"{len(requests_to_3000)} peticiones",
            )
            check("el carril corre en :3101", PORT == 3101, BASE)

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
        "requires": [
            "pip install playwright",
            "python -m playwright install chromium",
            "npm run build",
        ],
        "code": {
            "commit": git_value("rev-parse", "HEAD"),
            "branch": git_value("rev-parse", "--abbrev-ref", "HEAD"),
            "dirty": bool(git_value("status", "--porcelain")),
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
