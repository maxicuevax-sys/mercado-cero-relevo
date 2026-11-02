#!/usr/bin/env python3
"""E2E reproducible del carril P0-D — corte no destructivo y cierre versionado.

Requisitos:
  pip install playwright
  python -m playwright install chromium

Uso:
  # desde web/, con el build de producción ya generado:
  python scripts/p0-corte-e2e.py

  # opcional: usar un servidor ya levantado en :3101
  $env:P0_EXTERNAL_SERVER="1"
  $env:P0_DB_PATH="C:\\ruta\\temporal\\p0-corte.db"
  python scripts/p0-corte-e2e.py

Por defecto el script levanta su propio `npm start` en :3101 con una base
temporal y la elimina al final. Nunca apunta a :3000.
Escribe harness/evidence/p0-corte-e2e.json.
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
    raise SystemExit("P0-CORTE E2E se niega a correr contra :3000.")
if "localhost" not in BASE and "127.0.0.1" not in BASE:
    raise SystemExit("P0-CORTE E2E exige un servidor local aislado.")

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
OUT = ROOT / "harness" / "evidence" / "p0-corte-e2e.json"
SHOT_360 = ROOT / "harness" / "evidence" / "p0-corte-360.png"
SHOT_200 = ROOT / "harness" / "evidence" / "p0-corte-360-200.png"
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
    run_dir = Path(tempfile.mkdtemp(prefix="mercado-cero-p0-corte-"))
    DB_PATH = run_dir / "mercado-cero.db"
    log_path = run_dir / "server.log"
    env = os.environ.copy()
    env.update(
        {
            "PORT": str(PORT),
            "DATABASE_PATH": str(DB_PATH),
            "DEMO_MODE": "true",
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
    process = subprocess.Popen([which_npm(), "start"], **kwargs)
    deadline = time.time() + 90
    while time.time() < deadline:
        if process.poll() is not None:
            log.close()
            raise RuntimeError(
                f"El servidor terminó al arrancar.\n{log_path.read_text(errors='replace')[-4000:]}"
            )
        try:
            with urllib.request.urlopen(f"{BASE}/api/dashboard", timeout=2) as response:
                if response.status == 200:
                    log.close()
                    return process
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.6)
    stop_server(process)
    log.close()
    raise RuntimeError(
        f"El servidor no respondió en 90 s.\n{log_path.read_text(errors='replace')[-4000:]}"
    )


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


def db_rows(sql: str, params: tuple = ()) -> list[tuple]:
    if not DB_PATH or not Path(DB_PATH).exists():
        raise RuntimeError("No hay DATABASE_PATH para inspeccionar SQLite.")
    connection = sqlite3.connect(str(DB_PATH), timeout=5)
    try:
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection.execute(sql, params).fetchall()
    finally:
        connection.close()


def cash(page) -> dict:
    response = page.request.get(f"{BASE}/api/cash")
    assert response.ok, response.text()
    return response.json()


def reset(page) -> None:
    response = page.request.post(f"{BASE}/api/demo/reset")
    assert response.ok, f"demo/reset falló: {response.status} {response.text()}"
    page.goto(BASE, wait_until="networkidle")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")


def open_corte(page) -> None:
    page.get_by_role("button", name="Corte", exact=True).first.click()
    page.get_by_role("heading", name="Cuenta el efectivo de hoy").wait_for(timeout=8000)


def counted_input(page):
    return page.get_by_role("textbox", name="Total contado en pesos")


def base_input(page):
    return page.get_by_role("textbox", name="Base para mañana en pesos")


def fill_draft(page) -> dict[str, str]:
    page.get_by_role("textbox", name="Base inicial en pesos").fill("500")
    page.get_by_role("textbox", name="Gastos de caja en pesos").fill("12")
    page.get_by_role("textbox", name="Retiros en pesos").fill("8")
    counted_input(page).fill("123.45")
    base_input(page).fill("40")
    page.wait_for_timeout(200)
    return {
        "opening": page.get_by_role("textbox", name="Base inicial en pesos").input_value(),
        "expenses": page.get_by_role("textbox", name="Gastos de caja en pesos").input_value(),
        "withdrawals": page.get_by_role("textbox", name="Retiros en pesos").input_value(),
        "counted": counted_input(page).input_value(),
        "base": base_input(page).input_value(),
    }


def input_values(page) -> dict[str, str]:
    return {
        "opening": page.get_by_role("textbox", name="Base inicial en pesos").input_value(),
        "expenses": page.get_by_role("textbox", name="Gastos de caja en pesos").input_value(),
        "withdrawals": page.get_by_role("textbox", name="Retiros en pesos").input_value(),
        "counted": counted_input(page).input_value(),
        "base": base_input(page).input_value(),
    }


def create_cash_order(page, cents: int, description: str = "Venta E2E corte") -> None:
    response = page.request.post(
        f"{BASE}/api/orders",
        data={
            "items": [
                {"description": description, "quantity": 1, "unitPriceCents": cents}
            ],
            "cashCents": cents,
        },
    )
    assert response.ok, response.text()


def create_credit_order(page, cents: int, customer: str) -> None:
    response = page.request.post(
        f"{BASE}/api/orders",
        data={
            "items": [
                {"description": "Fiado E2E corte", "quantity": 1, "unitPriceCents": cents}
            ],
            "cashCents": 0,
            "creditCents": cents,
            "customerName": customer,
        },
    )
    assert response.ok, response.text()


def open_confirm(page) -> None:
    page.get_by_role("button", name="Guardar corte", exact=True).click()
    dialog = page.get_by_role("dialog")
    dialog.wait_for(timeout=8000)
    dialog.get_by_text("Diferencia calculada por el servidor").wait_for(timeout=8000)


def save_confirm(page, label: str = "Guardar corte") -> None:
    dialog = page.get_by_role("dialog")
    dialog.get_by_role("button", name=label, exact=True).click()


def broken_words(page) -> list[dict]:
    return page.evaluate(
        """() => {
          const found = [];
          const seen = new Set();
          const visible = el => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none';
          };
          const re = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/g;
          for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,button,a,label,li,dt,dd')) {
            if (!visible(el)) continue;
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
              const text = node.textContent || '';
              re.lastIndex = 0;
              let match;
              while ((match = re.exec(text))) {
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                const tops = new Set(
                  Array.from(range.getClientRects()).filter(r => r.width > 0).map(r => Math.round(r.top))
                );
                if (tops.size > 1) {
                  const key = match[0] + '@' + Math.min(...tops);
                  if (!seen.has(key)) {
                    seen.add(key);
                    found.push({ word: match[0], text: (el.innerText || '').trim().slice(0, 50) });
                  }
                }
              }
            }
          }
          return found;
        }"""
    )


def main() -> int:
    global SERVER, RUN_DIR
    started_at = datetime.now(timezone.utc)
    start_commit = git_value("rev-parse", "HEAD")
    start_branch = git_value("rev-parse", "--abbrev-ref", "HEAD")
    start_dirty = bool(git_value("status", "--porcelain"))
    close_posts: list[str] = []
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
                if request.method == "POST" and re.search(r"/api/cash/close$", request.url):
                    close_posts.append(request.url)
                if re.search(r":3000(?:/|$)", request.url):
                    requests_to_3000.append(request.url)

            page.on("request", track_request)

            # 1 · El borrador no se pierde con refresh, venta ni cambio de tab.
            reset(page)
            open_corte(page)
            before_sale = cash(page)
            draft = fill_draft(page)
            check(
                "contar marca los cambios sin guardar",
                page.get_by_text("Hay cambios sin guardar.").count() >= 1,
                json.dumps(draft),
            )
            page.evaluate("window.dispatchEvent(new Event('mercado:refresh'))")
            page.wait_for_timeout(700)
            check(
                "mercado:refresh no pisa el conteo",
                input_values(page) == draft,
                json.dumps(input_values(page)),
            )

            create_cash_order(page, 5000)
            page.evaluate("window.dispatchEvent(new Event('mercado:refresh'))")
            page.wait_for_timeout(700)
            check(
                "una venta no pisa el conteo",
                input_values(page) == draft,
                json.dumps(input_values(page)),
            )
            check(
                "la venta no se envía sola al corte",
                len(close_posts) == 0,
                f"{len(close_posts)} POST /api/cash/close",
            )

            with page.expect_response(
                lambda response: re.search(r"/api/cash$", response.url) is not None
            ):
                page.get_by_role("button", name="Actualizar totales", exact=True).click()
            page.wait_for_timeout(300)
            after_sale = cash(page)
            values_after_refresh = input_values(page)
            check(
                "Actualizar totales refresca los totales del servidor",
                after_sale["cashSalesCents"] == before_sale["cashSalesCents"] + 5000
                and values_after_refresh == draft,
                f"antes {before_sale['cashSalesCents']} · después {after_sale['cashSalesCents']}",
            )
            check(
                "el conteo sigue tras el refresco de totales",
                values_after_refresh == draft,
                json.dumps(values_after_refresh),
            )

            page.get_by_role("button", name="Caja", exact=True).first.click()
            page.wait_for_timeout(250)
            page.get_by_role("button", name="Corte", exact=True).first.click()
            page.wait_for_timeout(300)
            check(
                "el borrador sobrevive al cambio de tab",
                input_values(page) == draft,
                json.dumps(input_values(page)),
            )

            # 2 · Validación inline: vacío, cero, base mayor y base inválida.
            reset(page)
            open_corte(page)
            close_posts.clear()
            page.get_by_role("button", name="Guardar corte", exact=True).click()
            page.wait_for_timeout(200)
            check(
                "contado vacío no guarda y enfoca el campo",
                page.get_by_text(
                    "Escribe cuánto contaste. El total contado debe ser mayor que cero."
                ).count()
                >= 1
                and page.evaluate("document.activeElement && document.activeElement.id")
                == "corte-contado"
                and len(close_posts) == 0,
                f"POST {len(close_posts)}",
            )

            counted_input(page).fill("0")
            page.get_by_role("button", name="Guardar corte", exact=True).click()
            page.wait_for_timeout(200)
            check(
                "contado cero no guarda",
                page.get_by_text(
                    "Escribe cuánto contaste. El total contado debe ser mayor que cero."
                ).count()
                >= 1
                and len(close_posts) == 0,
                f"POST {len(close_posts)}",
            )

            counted_input(page).fill("1")
            page.wait_for_timeout(200)
            check(
                "base $400 con contado $1 advierte y bloquea",
                page.get_by_text(
                    "La base para mañana no puede ser mayor que el total contado."
                ).count()
                >= 1
                and page.get_by_role("button", name="Guardar corte", exact=True).is_disabled()
                and len(close_posts) == 0,
                f"POST {len(close_posts)}",
            )

            base_input(page).fill("abc")
            page.get_by_role("button", name="Guardar corte", exact=True).click()
            page.wait_for_timeout(200)
            check(
                "base no numérica no guarda y enfoca el campo",
                page.get_by_text("La base para mañana debe ser un número.").count() >= 1
                and page.evaluate("document.activeElement && document.activeElement.id")
                == "corte-base-next"
                and len(close_posts) == 0,
                f"POST {len(close_posts)}",
            )

            base_input(page).fill("-5")
            page.get_by_role("button", name="Guardar corte", exact=True).click()
            page.wait_for_timeout(200)
            check(
                "base negativa no guarda",
                page.get_by_text("La base para mañana: escribe un monto de cero o más.").count()
                >= 1
                and len(close_posts) == 0,
                f"POST {len(close_posts)}",
            )

            # 2b · La confirmación no usa la copia local aunque la tarjeta esté vieja.
            reset(page)
            open_corte(page)
            stale_status = cash(page)
            stale_expected = (
                stale_status["openingCents"]
                + stale_status["cashSalesCents"]
                + stale_status["cashCreditCents"]
            )
            counted_input(page).fill(f"{stale_expected / 100:.2f}")
            base_input(page).fill("400")
            page.wait_for_timeout(200)
            check(
                "la copia local dice que cuadra antes de la venta",
                page.get_by_text("Cuadra").count() >= 1,
            )
            create_cash_order(page, 5000, "Venta entre conteo y confirmacion")
            page.get_by_role("button", name="Guardar corte", exact=True).click()
            dialog = page.get_by_role("dialog")
            dialog.wait_for(timeout=8000)
            dialog.get_by_text("Diferencia calculada por el servidor").wait_for(timeout=8000)
            stale_dialog_text = dialog.inner_text()
            check(
                "la confirmación usa la diferencia del servidor, no la copia local",
                "Falta" in stale_dialog_text
                and "$50.00" in stale_dialog_text
                and f"${(stale_expected + 5000) / 100:,.2f}" in stale_dialog_text,
                stale_dialog_text.replace("\n", " · ")[:280],
            )
            dialog.get_by_role("button", name="Volver a contar", exact=True).click()
            page.wait_for_timeout(200)
            check(
                "calcular la diferencia del servidor no guarda el corte",
                len(close_posts) == 0,
                f"POST {len(close_posts)}",
            )

            # 3 · Primer cierre: versión 1, confirmación y snapshot.
            reset(page)
            open_corte(page)
            status = cash(page)
            date_key = status["date"]
            opening_cents = status["openingCents"]
            page.get_by_role("textbox", name="Gastos de caja en pesos").fill("10")
            page.get_by_role("textbox", name="Retiros en pesos").fill("5")
            expected_cents = opening_cents + status["cashSalesCents"] + status["cashCreditCents"] - 1000 - 500
            counted_input(page).fill(f"{expected_cents / 100:.2f}")
            base_input(page).fill("400")
            page.wait_for_timeout(200)
            check(
                "la diferencia local muestra que cuadra",
                page.get_by_text("Cuadra").count() >= 1
                and page.get_by_text("El efectivo cuadra con lo esperado.").count() >= 1,
            )

            close_posts.clear()
            open_confirm(page)
            dialog = page.get_by_role("dialog")
            dialog_text = dialog.inner_text()
            check(
                "la confirmación muestra gastos, retiros y debería haber",
                "Gastos de caja" in dialog_text
                and "Retiros" in dialog_text
                and "Debería haber" in dialog_text
                and f"${expected_cents / 100:,.2f}" in dialog_text,
                dialog_text.replace("\n", " · ")[:260],
            )
            check(
                "la confirmación usa la diferencia del servidor",
                "Diferencia calculada por el servidor" in dialog_text
                and "Cuadra" in dialog_text,
                dialog_text.replace("\n", " · ")[:260],
            )

            save_confirm(page)
            page.get_by_role("heading", name="Corte #1").wait_for(timeout=8000)
            summary = page.get_by_role("heading", name="Corte #1").locator("..").locator("..")
            summary_text = summary.inner_text()
            check(
                "el resumen posterior muestra efectivo, fiado, digital, contado y diferencia",
                "Efectivo del día" in summary_text
                and "Fiado pendiente" in summary_text
                and "Pendiente digital" in summary_text
                and "Contado" in summary_text
                and "Diferencia" in summary_text
                and "Cuadra" in summary_text,
                summary_text.replace("\n", " · ")[:300],
            )
            check(
                "el resumen incluye la fecha del cierre",
                re.search(r"(Hoy|Ayer|\d{1,2}\s+\w+)", summary_text) is not None,
                summary_text.replace("\n", " · ")[:200],
            )

            rows = db_rows(
                "SELECT version, reason, counted_cents, expected_cents, difference_cents, "
                "snapshot_cash_cents, snapshot_credit_cents, snapshot_pending_digital_cents "
                "FROM cash_closes WHERE date = ? ORDER BY version",
                (date_key,),
            )
            v1 = rows[0] if rows else None
            check(
                "el primer cierre crea la versión 1 en SQLite",
                v1 is not None
                and int(v1[0]) == 1
                and v1[1] is None
                and int(v1[2]) == expected_cents
                and int(v1[3]) == expected_cents
                and int(v1[4]) == 0,
                json.dumps(rows),
            )
            check(
                "la versión 1 guarda el snapshot de efectivo, fiado y digital",
                v1 is not None
                and int(v1[5]) == status["cashSalesCents"] + status["cashCreditCents"]
                and int(v1[6]) >= 0
                and int(v1[7]) >= 0,
                json.dumps(rows),
            )
            audit_rows = db_rows(
                "SELECT detail FROM audit_log WHERE action = 'cash.close' ORDER BY rowid DESC LIMIT 1"
            )
            audit_detail = json.loads(audit_rows[0][0]) if audit_rows and audit_rows[0][0] else {}
            check(
                "audit cash.close registra versión 1 sin motivo",
                audit_detail.get("version") == 1 and audit_detail.get("reason") is None,
                json.dumps(audit_detail)[:260],
            )

            # 4 · Corrección: motivo obligatorio, versión 2 y versión 1 intacta.
            page.get_by_role("button", name="Corregir corte", exact=True).click()
            dialog = page.get_by_role("dialog")
            dialog.get_by_role("textbox", name=re.compile("Motivo de la corrección")).wait_for(
                timeout=8000
            )
            dialog.get_by_role("button", name="Guardar corrección", exact=True).click()
            page.wait_for_timeout(250)
            check(
                "corregir sin motivo no guarda y enfoca el motivo",
                page.get_by_text(
                    "Escribe el motivo de la corrección. No se puede guardar sin motivo."
                ).count()
                >= 1
                and page.evaluate("document.activeElement && document.activeElement.id")
                == "corte-reason"
                and len(
                    db_rows(
                        "SELECT version FROM cash_closes WHERE date = ? ORDER BY version",
                        (date_key,),
                    )
                )
                == 1,
            )

            dialog.get_by_role("button", name="Volver a contar", exact=True).click()
            page.wait_for_timeout(250)
            counted_input(page).fill(f"{(expected_cents + 50) / 100:.2f}")
            page.get_by_role("button", name="Corregir corte", exact=True).click()
            dialog = page.get_by_role("dialog")
            motive = "Conté de nuevo: había un billete de $50."
            dialog.get_by_role("textbox", name=re.compile("Motivo de la corrección")).fill(motive)
            dialog.get_by_role("button", name="Guardar corrección", exact=True).click()
            page.get_by_role("heading", name="Corte #2").wait_for(timeout=8000)
            rows2 = db_rows(
                "SELECT version, reason, counted_cents, difference_cents FROM cash_closes "
                "WHERE date = ? ORDER BY version",
                (date_key,),
            )
            check(
                "el segundo guardado crea la versión 2 con motivo",
                len(rows2) == 2
                and int(rows2[1][0]) == 2
                and rows2[1][1] == motive
                and int(rows2[1][2]) == expected_cents + 50,
                json.dumps(rows2),
            )
            check(
                "la versión 1 sigue visible e intacta",
                len(rows2) == 2
                and int(rows2[0][0]) == 1
                and rows2[0][1] is None
                and int(rows2[0][2]) == expected_cents,
                json.dumps(rows2),
            )
            history_text = page.get_by_text("Cierres de hoy").locator("..").inner_text()
            check(
                "el historial muestra la versión 1 y el motivo de la 2",
                "Corte #1" in history_text
                and "Corte #2" in history_text
                and motive in history_text,
                history_text.replace("\n", " · ")[:300],
            )
            audit_rows2 = db_rows(
                "SELECT detail FROM audit_log WHERE action = 'cash.close' ORDER BY rowid DESC LIMIT 1"
            )
            audit_detail2 = (
                json.loads(audit_rows2[0][0]) if audit_rows2 and audit_rows2[0][0] else {}
            )
            check(
                "audit cash.close registra versión 2 y su motivo",
                audit_detail2.get("version") == 2
                and audit_detail2.get("reason") == motive,
                json.dumps(audit_detail2)[:300],
            )
            status_after_v2 = cash(page)
            check(
                "el estado sirve la versión 2 como corte vigente",
                status_after_v2["saved"]["version"] == 2
                and [item["version"] for item in status_after_v2["history"]] == [2, 1],
                json.dumps(
                    {
                        "saved": status_after_v2["saved"]["version"],
                        "history": [item["version"] for item in status_after_v2["history"]],
                    }
                ),
            )

            # 5 · La foto del cierre no cambia con movimientos posteriores.
            saved_v2 = dict(status_after_v2["saved"])
            create_cash_order(page, 5000, "Venta posterior al cierre")
            create_credit_order(page, 3000, "Cliente Posterior")
            page.evaluate("window.dispatchEvent(new Event('mercado:refresh'))")
            page.wait_for_timeout(800)
            status_after_moves = cash(page)
            saved_after_moves = status_after_moves["saved"]
            check(
                "una venta posterior no altera el snapshot del cierre",
                saved_after_moves["snapshotCashCents"] == saved_v2["snapshotCashCents"]
                and saved_after_moves["countedCents"] == saved_v2["countedCents"]
                and saved_after_moves["differenceCents"] == saved_v2["differenceCents"]
                and saved_after_moves["createdAt"] == saved_v2["createdAt"]
                and status_after_moves["cashSalesCents"]
                > status_after_v2["cashSalesCents"],
                json.dumps(
                    {
                        "snapshot antes": saved_v2["snapshotCashCents"],
                        "snapshot después": saved_after_moves["snapshotCashCents"],
                        "ventas vivas": status_after_moves["cashSalesCents"],
                    }
                ),
            )
            check(
                "un fiado posterior no altera el snapshot de fiado",
                saved_after_moves["snapshotCreditCents"]
                == saved_v2["snapshotCreditCents"],
                f"{saved_v2['snapshotCreditCents']} → {saved_after_moves['snapshotCreditCents']}",
            )
            rows_after = db_rows(
                "SELECT version, counted_cents, snapshot_cash_cents, snapshot_credit_cents "
                "FROM cash_closes WHERE date = ? ORDER BY version",
                (date_key,),
            )
            check(
                "SQLite conserva la foto aunque la caja tenga movimientos nuevos",
                len(rows_after) == 2
                and int(rows_after[1][1]) == saved_v2["countedCents"]
                and int(rows_after[1][2]) == saved_v2["snapshotCashCents"]
                and int(rows_after[1][3]) == saved_v2["snapshotCreditCents"],
                json.dumps(rows_after),
            )
            page.wait_for_timeout(300)
            check(
                "el resumen en pantalla sigue mostrando el corte #2",
                page.get_by_role("heading", name="Corte #2").count() == 1,
            )

            # 6 · 360 px y 360 px a 200 % sin overflow ni palabras partidas.
            context360 = browser.new_context(viewport={"width": 360, "height": 800})
            page360 = context360.new_page()
            page360.on("request", track_request)
            reset(page360)
            open_corte(page360)
            status360 = cash(page360)
            expected360 = (
                status360["openingCents"]
                + status360["cashSalesCents"]
                + status360["cashCreditCents"]
            )
            counted_input(page360).fill(f"{expected360 / 100:.2f}")
            base_input(page360).fill("400")
            page360.get_by_role(
                "button", name="Contar por billetes y monedas", exact=True
            ).click()
            page360.wait_for_timeout(300)
            SHOT_360.parent.mkdir(parents=True, exist_ok=True)
            page360.screenshot(path=str(SHOT_360), full_page=True)
            metrics360 = page360.evaluate(
                """() => ({
                    innerWidth: window.innerWidth,
                    scrollWidth: document.documentElement.scrollWidth,
                    bodyWidth: document.body.scrollWidth,
                })"""
            )
            broken360 = broken_words(page360)
            check(
                "el corte a 360 px no desborda horizontalmente",
                metrics360["scrollWidth"] <= metrics360["innerWidth"] + 1
                and metrics360["bodyWidth"] <= metrics360["innerWidth"] + 1,
                json.dumps(metrics360),
            )
            check(
                "el corte a 360 px no parte palabras",
                not broken360,
                ", ".join(item["word"] for item in broken360[:6]),
            )

            page360.add_style_tag(content="html { font-size: 200% !important; }")
            page360.wait_for_timeout(700)
            page360.screenshot(path=str(SHOT_200), full_page=True)
            metrics200 = page360.evaluate(
                """() => ({
                    innerWidth: window.innerWidth,
                    scrollWidth: document.documentElement.scrollWidth,
                    bodyWidth: document.body.scrollWidth,
                })"""
            )
            broken200 = broken_words(page360)
            check(
                "el corte a 360/200 no desborda horizontalmente",
                metrics200["scrollWidth"] <= metrics200["innerWidth"] + 1
                and metrics200["bodyWidth"] <= metrics200["innerWidth"] + 1,
                json.dumps(metrics200),
            )
            check(
                "el corte a 360/200 no parte palabras",
                not broken200,
                ", ".join(item["word"] for item in broken200[:6]),
            )
            context360.close()

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
        "suite": "p0-corte-e2e",
        "baseUrl": BASE,
        "command": "python web/scripts/p0-corte-e2e.py",
        "artifacts": [
            "harness/evidence/p0-corte-360.png",
            "harness/evidence/p0-corte-360-200.png",
        ],
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
    print(f"\nP0 CORTE E2E — {passed} PASS · {failed} FAIL · {known} KNOWN")
    print(f"EVIDENCIA {OUT}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
