#!/usr/bin/env python3
"""E2E del carril P0-INTEGRACION.

Cubre la integración de los tres módulos ya construidos:
  - P0-E: franja de cobros pendientes, refresco al volver a la pestaña.
  - P0-G: quinto tab "Pendientes" y tareas crear/completar/reabrir/posponer/eliminar.
  - P0-C.1: consultas de fiado por voz, método del abono y venta mixta
    ($30 efectivo + $20 fiado + $40 digital).

Requisitos:
  pip install playwright
  python -m playwright install chromium

Uso (desde web/, con `npm run build` ya ejecutado):
  python scripts/p0-integracion-e2e.py

Por defecto levanta su propio `npm start` en :3101 con una base temporal.
Nunca apunta a :3000. Escribe harness/evidence/p0-integracion-e2e.json.
"""

from __future__ import annotations

import hashlib
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
    raise SystemExit("P0-INTEGRACION E2E se niega a correr contra :3000.")
if "localhost" not in BASE and "127.0.0.1" not in BASE:
    raise SystemExit("P0-INTEGRACION E2E exige un servidor local aislado.")

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
OUT = ROOT / "harness" / "evidence" / "p0-integracion-e2e.json"
SHOT_360 = ROOT / "harness" / "evidence" / "p0-integracion-360.png"
SHOT_200 = ROOT / "harness" / "evidence" / "p0-integracion-360-text200.png"
EXTERNAL = os.environ.get("P0_EXTERNAL_SERVER") == "1"
KEEP_DB = os.environ.get("P0_KEEP_DB") == "1"
DB_PATH: Path | None = (
    Path(os.environ["P0_DB_PATH"]).expanduser()
    if os.environ.get("P0_DB_PATH")
    else None
)
SERVER: subprocess.Popen | None = None
RUN_DIR: Path | None = None

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")


def note(name: str, detail: str = "") -> None:
    results.append({"name": name, "ok": None, "detail": detail})
    print(f"KNOWN  {name}{(' — ' + detail) if detail else ''}")


def git_value(*args: str) -> str:
    try:
        result = subprocess.run(
            ["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=10, check=False
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception:
        return ""


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


def start_server() -> subprocess.Popen:
    global DB_PATH, RUN_DIR
    if port_in_use(PORT):
        raise RuntimeError(
            f"El puerto {PORT} ya está ocupado. Cierra el servidor anterior o usa "
            "P0_EXTERNAL_SERVER=1 con P0_DB_PATH."
        )
    RUN_DIR = Path(tempfile.mkdtemp(prefix="mercado-cero-p0-integracion-"))
    DB_PATH = RUN_DIR / "mercado-cero.db"
    log_path = RUN_DIR / "server.log"
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
                "El servidor terminó al arrancar.\n"
                + log_path.read_text(errors="replace")[-4000:]
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


def cleanup() -> None:
    stop_server(SERVER)
    if RUN_DIR and not KEEP_DB:
        shutil.rmtree(RUN_DIR, ignore_errors=True)


def db_rows(sql: str, params: tuple = ()) -> list[tuple]:
    if not DB_PATH or not Path(DB_PATH).exists():
        raise RuntimeError("No hay DATABASE_PATH para inspeccionar la base.")
    connection = sqlite3.connect(str(DB_PATH), timeout=5)
    try:
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection.execute(sql, params).fetchall()
    finally:
        connection.close()


def reset(page) -> None:
    response = page.request.post(f"{BASE}/api/demo/reset")
    assert response.ok, f"demo/reset falló: {response.status} {response.text()}"
    page.goto(BASE, wait_until="networkidle")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")
    page.wait_for_selector("h1:has-text('Caja')", timeout=30000)
    page.wait_for_timeout(250)


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
          for (const el of document.querySelectorAll('h1,h2,h3,h4,p,span,button,a,label,li')) {
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


def text200(page) -> None:
    page.add_style_tag(content="html { font-size: 200% !important; }")
    page.wait_for_timeout(500)


def interpret(page, phrase: str) -> None:
    page.locator("#sale-text").fill(phrase)
    page.locator("#sale-text").press("Enter")


def wait_for_text(page, text: str, timeout: int = 8000):
    return page.get_by_text(text, exact=False).first.wait_for(timeout=timeout)


def main() -> int:
    global SERVER
    started_at = datetime.now(timezone.utc)
    start_commit = git_value("rev-parse", "HEAD")
    start_branch = git_value("rev-parse", "--abbrev-ref", "HEAD")
    start_dirty = bool(git_value("status", "--porcelain"))
    requests_to_3000: list[str] = []
    credit_pay_posts: list[str] = []
    dashboard_calls: list[str] = []

    try:
        if not EXTERNAL:
            SERVER = start_server()
        else:
            if not DB_PATH:
                raise RuntimeError("Con P0_EXTERNAL_SERVER=1 debes pasar P0_DB_PATH.")
            if not port_in_use(PORT):
                raise RuntimeError(f"No hay servidor en {BASE}.")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1280, "height": 1000},
                locale="es-MX",
            )
            page = context.new_page()

            def track_request(request) -> None:
                if re.search(r":3000(?:/|$)", request.url):
                    requests_to_3000.append(request.url)
                if request.method == "POST" and re.search(
                    r"/api/credits/[^/]+/pay$", request.url
                ):
                    credit_pay_posts.append(request.url)
                if "/api/dashboard" in request.url:
                    dashboard_calls.append(request.url)

            page.on("request", track_request)

            # ------------------------------------------------------------------
            # 1 · Cinco destinos + tareas (P0-G).
            # ------------------------------------------------------------------
            reset(page)
            sidebar_labels = page.evaluate(
                """() => Array.from(
                  document.querySelectorAll('aside nav[aria-label="Navegación principal"] button')
                ).map(b => b.innerText.trim())"""
            )
            check(
                "sidebar muestra los cinco destinos",
                sidebar_labels == ["Caja", "Fiado", "Corte", "Meta", "Pendientes"],
                json.dumps(sidebar_labels, ensure_ascii=False),
            )
            page.locator('aside button:visible', has_text="Pendientes").first.click()
            page.wait_for_selector("h1:has-text('Pendientes')", timeout=10000)
            check(
                "el quinto tab monta el panel de pendientes",
                page.get_by_text("Lo que queda para después.").count() == 1,
            )

            # El scroll de Caja se conserva al ir y volver de otro tab.
            page.locator('aside button:visible', has_text="Caja").first.click()
            page.wait_for_timeout(400)
            # El alto de Caja depende de los datos demo; usa el máximo real en
            # vez de exigir 500 px cuando la página es más corta.
            target_scroll = page.evaluate(
                "Math.min(500, Math.max(0, document.documentElement.scrollHeight - innerHeight))"
            )
            page.evaluate(f"window.scrollTo(0, {target_scroll})")
            page.wait_for_timeout(200)
            page.locator('aside button:visible', has_text="Pendientes").first.click()
            page.wait_for_timeout(350)
            page.locator('aside button:visible', has_text="Caja").first.click()
            page.wait_for_timeout(400)
            restored_scroll = page.evaluate("window.scrollY")
            check(
                "el scroll de Caja se conserva al cambiar de tab",
                target_scroll > 0 and abs(restored_scroll - target_scroll) <= 24,
                f"scrollY={restored_scroll} · objetivo={target_scroll}",
            )
            page.locator('aside button:visible', has_text="Pendientes").first.click()
            page.wait_for_timeout(300)

            page.get_by_role("button", name="Anotar pendiente").first.click()
            page.get_by_label(re.compile("¿Qué quieres recordar?")).fill("Pagar al proveedor")
            page.get_by_label(re.compile("Nota")).fill("Tomás pasa a las 11")
            page.get_by_role("button", name="Guardar", exact=True).click()
            wait_for_text(page, "Pagar al proveedor", 8000)
            check(
                "crear pendiente lo muestra en la lista abierta",
                page.get_by_text("Pagar al proveedor", exact=True).count() >= 1,
            )

            page.get_by_role("checkbox", name="Completar: Pagar al proveedor").click()
            page.get_by_role("button", name=re.compile("Hechas")).wait_for(timeout=8000)
            page.wait_for_timeout(400)
            check(
                "completar mueve la tarea a Hechas",
                page.get_by_role("button", name="Reabrir").count() == 1,
            )
            page.get_by_role("button", name="Reabrir").click()
            page.wait_for_timeout(500)
            check(
                "reabrir devuelve la tarea a pendientes",
                page.get_by_role("button", name="Reabrir").count() == 0
                and page.get_by_text("Pagar al proveedor", exact=True).count() == 1,
            )

            page.get_by_role("button", name="Posponer").click()
            page.get_by_role("button", name="Mañana", exact=True).click()
            page.wait_for_timeout(600)
            check(
                "posponer deja la tarea abierta con marca Pospuesto",
                page.get_by_text("Pospuesto", exact=True).count() == 1,
            )
            check(
                "posponer persiste postponedUntil en la API",
                bool(
                    next(
                        (
                            task
                            for task in page.request.get(f"{BASE}/api/tasks").json()["tasks"]
                            if task["title"] == "Pagar al proveedor"
                        ),
                        None,
                    )
                    and next(
                        task
                        for task in page.request.get(f"{BASE}/api/tasks").json()["tasks"]
                        if task["title"] == "Pagar al proveedor"
                    )["postponedUntil"]
                ),
            )

            page.get_by_role("button", name="Eliminar").click()
            page.get_by_role("button", name="Sí, eliminar").click()
            page.wait_for_timeout(700)
            check(
                "eliminar saca la tarea de la lista",
                page.get_by_text("Pagar al proveedor", exact=True).count() == 0,
            )

            # 1c · Reset de demo con Pendientes visible: el panel se remonta y
            # no deja tareas fantasma del servidor anterior.
            page.get_by_role("button", name="Anotar pendiente").first.click()
            page.get_by_label(re.compile("¿Qué quieres recordar?")).fill(
                "Tarea que el reset debe borrar"
            )
            page.get_by_role("button", name="Guardar", exact=True).click()
            wait_for_text(page, "Tarea que el reset debe borrar", 8000)
            page.get_by_role("button", name="Demo", exact=True).click()
            page.get_by_role("button", name="Reiniciar datos de demo").click()
            page.get_by_role("button", name="Sí, reiniciar").click()
            page.wait_for_timeout(1400)
            check(
                "el reset de demo limpia las tareas visibles",
                page.get_by_text("Tarea que el reset debe borrar", exact=True).count() == 0,
            )

            # ------------------------------------------------------------------
            # 2 · P0-E: franja de cobros pendientes + refresco.
            # ------------------------------------------------------------------
            reset(page)
            wait_for_text(page, "Cobros pendientes", 10000)
            page.locator("#sale-text").fill("dos quesadillas")
            page.evaluate("window.dispatchEvent(new Event('focus'))")
            page.wait_for_timeout(700)
            check(
                "el refresco de la pestaña no borra la venta en curso",
                page.locator("#sale-text").input_value() == "dos quesadillas"
                and page.get_by_role("dialog").count() == 0,
            )
            page.locator("#sale-text").fill("")

            # El polling de fondo tampoco debe reiniciar el conteo del corte.
            page.locator('aside button:visible', has_text="Corte").first.click()
            page.wait_for_timeout(500)
            page.get_by_label("Total contado en pesos").fill("500")
            page.evaluate("window.dispatchEvent(new Event('focus'))")
            page.wait_for_timeout(700)
            check(
                "el refresco de la pestaña no borra el conteo del corte",
                page.get_by_label("Total contado en pesos").input_value() == "500",
                page.get_by_label("Total contado en pesos").input_value(),
            )
            page.locator('aside button:visible', has_text="Caja").first.click()
            page.wait_for_timeout(400)
            check(
                "la franja muestra el pendiente sembrado",
                page.get_by_text("Pedido para llevar", exact=False).count() >= 1,
            )
            check(
                "el pendiente distingue Esperando banco",
                page.get_by_text("Esperando banco", exact=False).count() >= 1,
            )
            check("no hay hoja abierta al cargar Caja", page.get_by_role("dialog").count() == 0)
            check(
                "la franja muestra última comprobación",
                page.get_by_text(re.compile(r"Última comprobación: (Hoy|Ayer)")).count() >= 1,
            )

            # Un pedido nuevo aparece tras volver a la pestaña (focus).
            seeded = page.request.post(
                f"{BASE}/api/orders",
                data={
                    "items": [
                        {"description": "Refresco pendiente", "quantity": 1, "unitPriceCents": 2200}
                    ],
                    "cashCents": 0,
                    "creditCents": 0,
                },
            )
            assert seeded.ok, seeded.text()
            page.evaluate("window.dispatchEvent(new Event('focus'))")
            wait_for_text(page, "Refresco pendiente", 8000)
            check("el refresco por focus trae el pendiente nuevo", True)

            # Otro pedido + visibilitychange simulado.
            seeded2 = page.request.post(
                f"{BASE}/api/orders",
                data={
                    "items": [
                        {"description": "Pedido de ayer", "quantity": 1, "unitPriceCents": 1000}
                    ],
                    "cashCents": 0,
                    "creditCents": 0,
                },
            )
            assert seeded2.ok, seeded2.text()
            page.wait_for_timeout(500)
            page.evaluate(
                """() => {
                  Object.defineProperty(document, 'visibilityState', {
                    configurable: true,
                    get: () => 'visible',
                  });
                  document.dispatchEvent(new Event('visibilitychange'));
                }"""
            )
            wait_for_text(page, "Pedido de ayer", 8000)
            check("el refresco por visibilitychange trae el pendiente nuevo", True)

            activity_time = page.evaluate(
                """() => {
                  const heading = [...document.querySelectorAll('h2')].find(
                    el => (el.innerText || '').includes('Últimos movimientos')
                  );
                  const card = heading ? heading.closest('div.rounded-2xl') : null;
                  const time = card ? card.querySelector('time') : null;
                  return time ? time.innerText : '';
                }"""
            )
            check(
                "la actividad usa fecha relativa, no solo hora",
                activity_time.startswith(("Hoy", "Ayer"))
                or bool(re.match(r"\d{1,2} \w{3}", activity_time)),
                activity_time,
            )

            page.get_by_role("button", name=re.compile("Ver cobro")).first.click()
            page.get_by_role("dialog").wait_for(timeout=8000)
            dialog_text = page.get_by_role("dialog").inner_text()
            check(
                "Ver abre el cobro explícitamente",
                "Cobro · Pedido" in dialog_text and "$120.00" in dialog_text,
                dialog_text.replace("\n", " · ")[:180],
            )
            page.get_by_role("dialog").get_by_role("button", name="Cerrar", exact=True).click()
            page.wait_for_timeout(300)

            # Fiado también usa fecha relativa.
            page.locator('aside button:visible', has_text="Fiado").first.click()
            page.wait_for_timeout(500)
            check(
                "Fiado muestra desde con fecha relativa",
                page.get_by_text(re.compile(r"desde (Hoy|Ayer|\d)")).count() >= 1,
            )

            # ------------------------------------------------------------------
            # 3 · P0-C.1: dos deudas de Juan y consulta general.
            # ------------------------------------------------------------------
            reset(page)
            second = page.request.post(
                f"{BASE}/api/orders",
                data={
                    "items": [
                        {"description": "Tlayuda fiada", "quantity": 1, "unitPriceCents": 8000}
                    ],
                    "cashCents": 0,
                    "creditCents": 8000,
                    "customerName": "Juan",
                },
            )
            assert second.ok, second.text()
            # El dashboard del cliente debe releer los fiados creados por API.
            page.evaluate("window.dispatchEvent(new Event('focus'))")
            page.wait_for_timeout(800)
            credit_pay_posts.clear()
            interpret(page, "¿Cuánto me debe Juan?")
            wait_for_text(page, "$130.00 en 2 fiados", 8000)
            check("dos deudas de Juan suman $130.00 en 2 fiados", True)
            check("una consulta de voz no manda POST de abono", len(credit_pay_posts) == 0)
            interpret(page, "¿Cuánto me deben?")
            wait_for_text(page, "$130.00 en 2 fiados", 8000)
            check("la consulta general suma el total abierto", True)

            # ------------------------------------------------------------------
            # 4 · P0-C.1: método del abono según la frase.
            # ------------------------------------------------------------------
            reset(page)
            interpret(page, "Juan me transfirió 50")
            page.get_by_role("dialog").wait_for(timeout=8000)
            dialog = page.get_by_role("dialog")
            selected = dialog.locator('[data-selected="true"]')
            check(
                "me transfirió preselecciona Digital",
                selected.count() == 1 and "Digital" in selected.inner_text(),
                selected.inner_text().replace("\n", " · ") if selected.count() else "sin selección",
            )
            check(
                "con método elegido se puede registrar",
                dialog.get_by_role("button", name="Registrar abono").is_enabled(),
            )
            dialog.get_by_role("button", name="Cerrar", exact=True).click()
            page.wait_for_timeout(300)

            interpret(page, "Juan me pagó 50")
            page.get_by_role("dialog").wait_for(timeout=8000)
            dialog = page.get_by_role("dialog")
            check(
                "sin método no se preselecciona efectivo",
                dialog.locator('[data-selected="true"]').count() == 0,
            )
            check(
                "sin método Registrar abono queda deshabilitado",
                dialog.get_by_role("button", name="Registrar abono").is_disabled(),
            )
            dialog.get_by_role("button", name="Cerrar", exact=True).click()
            page.wait_for_timeout(300)

            interpret(page, "Juan me pagó 50 en efectivo")
            page.get_by_role("dialog").wait_for(timeout=8000)
            dialog = page.get_by_role("dialog")
            selected = dialog.locator('[data-selected="true"]')
            check(
                "en efectivo preselecciona Efectivo",
                selected.count() == 1 and "Efectivo" in selected.inner_text(),
                selected.inner_text().replace("\n", " · ") if selected.count() else "sin selección",
            )
            dialog.get_by_role("button", name="Cerrar", exact=True).click()
            page.wait_for_timeout(300)

            # ------------------------------------------------------------------
            # 4a · La frase fija de $50 usa Kokoro, no Piper ni la voz del
            # navegador. Es la regresión que reportó el usuario.
            # ------------------------------------------------------------------
            reset(page)
            page.evaluate(
                """() => {
                  window.__audio = [];
                  window.__speech = [];
                  HTMLMediaElement.prototype.play = function () {
                    window.__audio.push(this.src);
                    return Promise.resolve();
                  };
                  window.speechSynthesis.speak = (u) => { window.__speech.push(u.text); };
                  window.speechSynthesis.cancel = () => {};
                }"""
            )
            page.get_by_role("button", name="Juan me pagó 50 del fiado").click()
            page.wait_for_timeout(1600)
            audio_srcs = page.evaluate("window.__audio")
            speech_calls = page.evaluate("window.__speech")
            wav = ROOT / "web" / "public" / "tts" / "revisa-abono-50-juan.wav"
            served = page.request.get(f"{BASE}/tts/revisa-abono-50-juan.wav?v=2")
            wav_ok = (
                served.ok
                and hashlib.sha256(served.body()).hexdigest()
                == hashlib.sha256(wav.read_bytes()).hexdigest()
            )
            check(
                "el botón de $50 usa el WAV Kokoro y no la voz del navegador",
                any("/tts/revisa-abono-50-juan.wav?v=2" in src for src in audio_srcs)
                and wav_ok
                and len(speech_calls) == 0,
                f"audio={audio_srcs} · speech={speech_calls} · wav={wav_ok}",
            )
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)

            # ------------------------------------------------------------------
            # 4b · Carrera: una lectura vieja del dashboard no puede revivir
            # el saldo que se acaba de cobrar.
            # ------------------------------------------------------------------
            reset(page)
            page.wait_for_timeout(800)
            stale_dashboard = page.request.get(f"{BASE}/api/dashboard").json()
            juan_credit = next(
                credit
                for credit in stale_dashboard["credits"]
                if credit["customerName"] == "Juan" and credit["status"] != "settled"
            )
            held: list = []
            calls = {"count": 0}

            def hold_first_dashboard(route):
                calls["count"] += 1
                if calls["count"] == 1:
                    # Se libera recién después del abono, como un poll lento.
                    held.append(route)
                else:
                    route.continue_()

            page.route("**/api/dashboard", hold_first_dashboard)
            page.evaluate("window.dispatchEvent(new Event('focus'))")
            page.wait_for_timeout(500)
            page.locator('aside button:visible', has_text="Fiado").first.click()
            page.wait_for_timeout(400)
            page.get_by_role("button", name="Registrar abono").first.click()
            sheet = page.get_by_role("dialog")
            sheet.wait_for(timeout=8000)
            sheet.get_by_text("Efectivo", exact=True).click()
            sheet.get_by_role("button", name="Registrar abono").click()
            page.wait_for_timeout(1200)

            for route in held:
                try:
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps(stale_dashboard),
                    )
                except Exception:
                    # La petición ya fue abortada por el refresco forzado.
                    pass
            page.wait_for_timeout(900)
            page.unroute("**/api/dashboard", hold_first_dashboard)

            juan_after = next(
                credit
                for credit in page.request.get(f"{BASE}/api/dashboard").json()["credits"]
                if credit["id"] == juan_credit["id"]
            )
            fiado_text = page.locator(
                'section:has(h1:has-text("Fiado"))'
            ).inner_text()
            check(
                "un poll viejo no revive el saldo después del abono",
                juan_after["balanceCents"] == 0
                and "Juan" not in fiado_text
                and "Sin fiados pendientes" in fiado_text
                and calls["count"] >= 2,
                f"balance={juan_after['balanceCents']} · calls={calls['count']} · {fiado_text[:160]}",
            )

            # ------------------------------------------------------------------
            # 5 · Venta mixta $30 efectivo + $20 fiado + $40 digital.
            # ------------------------------------------------------------------
            reset(page)
            page.locator("#draft-add-empty").click()
            page.get_by_label("Producto", exact=True).fill("Quesadillas")
            page.get_by_label("Precio unitario", exact=True).fill("90")
            page.locator("#cash-received").fill("30")
            page.locator("#fiado-amount").fill("20")
            page.locator("#fiado-customer").fill("Juan")
            page.get_by_role("button", name="Confirmar venta").click()
            page.get_by_role("dialog").wait_for(timeout=10000)
            dialog = page.get_by_role("dialog")
            text = dialog.inner_text()
            check(
                "la venta mixta muestra el remanente de $40",
                "$40.00" in text and "Falta cobrar $40.00" in text,
                text.replace("\n", " · ")[:240],
            )
            check(
                "la venta mixta muestra fiado, cobrado y link/QR",
                "Fiado $20.00" in text
                and "Cobrado $30.00" in text
                and "Link de pago" in text
                and "QR CoDi directo" in text,
                text.replace("\n", " · ")[:240],
            )
            check("la venta mixta no dice Quedó anotado por el total", "Quedó anotado" not in text)

            dialog.get_by_role("button", name=re.compile("Link de pago")).click()
            page.wait_for_selector("text=Simular CoDi", timeout=10000)
            check(
                "el link del remanente habilita la simulación demo",
                page.get_by_text("Simular CoDi", exact=True).count() >= 1,
            )
            page.get_by_role("button", name=re.compile("Simular CoDi")).click()
            # El aviso de Actividad también dice "Pago mixto"; esperamos la hoja.
            result_dialog = page.get_by_role("dialog")
            result_dialog.get_by_role(
                "heading", name="Pago mixto", exact=True
            ).wait_for(timeout=10000)
            result_text = result_dialog.inner_text()
            check(
                "pagar el digital deja el resultado Pago mixto",
                "Pago mixto" in result_text,
                result_text.replace("\n", " · ")[:220],
            )
            check(
                "el resultado declara Fiado + demo, no Quedó anotado",
                "Fiado $20.00" in result_text
                and "demo" in result_text
                and "Quedó anotado" not in result_text,
                result_text.replace("\n", " · ")[:220],
            )

            order_row = db_rows(
                "SELECT id, status, paid_cents, credit_cents FROM orders "
                "WHERE total_cents = 9000 ORDER BY created_at DESC LIMIT 1"
            )
            digital_row = (
                db_rows(
                    "SELECT COALESCE(SUM(amount_cents), 0) FROM payments "
                    "WHERE order_id = ? AND method != 'cash' AND status = 'paid'",
                    (order_row[0][0],),
                )
                if order_row
                else [(0,)]
            )
            credit_row = (
                db_rows(
                    "SELECT original_cents, balance_cents FROM credits WHERE order_id = ?",
                    (order_row[0][0],),
                )
                if order_row
                else []
            )
            check(
                "la base conserva la venta mixta correcta",
                bool(order_row)
                and order_row[0][1] == "demo_paid"
                and int(order_row[0][2]) == 7000
                and int(order_row[0][3]) == 2000
                and int(digital_row[0][0]) == 4000,
                json.dumps(order_row) + " digital=" + json.dumps(digital_row),
            )
            check(
                "el fiado original sigue intacto después del digital",
                bool(credit_row)
                and int(credit_row[0][0]) == 2000
                and int(credit_row[0][1]) == 2000,
                json.dumps(credit_row),
            )

            # ------------------------------------------------------------------
            # 6 · 360 px y 200 % (P0-G + shell).
            # ------------------------------------------------------------------
            context.close()
            context = browser.new_context(
                viewport={"width": 360, "height": 800},
                locale="es-MX",
                is_mobile=True,
                has_touch=True,
            )
            page = context.new_page()
            reset(page)
            page.wait_for_timeout(700)

            tabs = page.evaluate(
                """() => {
                  const nav = document.querySelector('nav[aria-label="Navegación inferior"]');
                  return Array.from(nav.querySelectorAll('button')).map(b => {
                    const r = b.getBoundingClientRect();
                    const label = b.querySelector('.mobile-tab-label');
                    return {
                      name: b.getAttribute('aria-label'),
                      text: label ? label.innerText.trim() : '',
                      left: Math.round(r.left),
                      right: Math.round(r.right),
                      width: Math.round(r.width),
                      labelFits: label ? label.getBoundingClientRect().width <= r.width - 2 : false,
                    };
                  });
                }"""
            )
            check(
                "a 360 px hay cinco tabs visibles",
                len(tabs) == 5 and all(tab["width"] > 0 for tab in tabs),
                json.dumps(tabs, ensure_ascii=False),
            )
            check(
                "los cinco tabs caben en el viewport",
                len(tabs) == 5
                and tabs[0]["left"] >= 0
                and tabs[-1]["right"] <= 360
                and all(tab["labelFits"] for tab in tabs),
                json.dumps(tabs, ensure_ascii=False),
            )
            check(
                "los labels móviles son cortos y completos",
                [tab["text"] for tab in tabs] == ["Caja", "Fiado", "Corte", "Meta", "Tareas"],
                json.dumps([tab["text"] for tab in tabs], ensure_ascii=False),
            )
            check(
                "a 360 px no hay scroll horizontal",
                page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
                str(
                    page.evaluate(
                        "[document.documentElement.scrollWidth, innerWidth]"
                    )
                ),
            )
            page.screenshot(path=str(SHOT_360))

            pendientes_tab = page.get_by_role(
                "button", name="Tareas (Pendientes)", exact=True
            )
            check(
                "el nombre accesible del tab incluye su texto visible",
                pendientes_tab.count() == 1,
            )
            pendientes_tab.click()
            page.wait_for_selector("h1:has-text('Pendientes')", timeout=10000)
            page.wait_for_timeout(400)
            focus_id = page.evaluate(
                "document.activeElement ? document.activeElement.id : ''"
            )
            check(
                "el foco va al título de Pendientes",
                focus_id == "pendientes-heading",
                str(focus_id),
            )
            text200(page)
            broken = broken_words(page)
            check(
                "Pendientes a 360/200 sin palabras partidas",
                not broken,
                ", ".join(item["word"] for item in broken[:5]),
            )
            check(
                "Pendientes a 360/200 sin overflow horizontal",
                page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
            )
            tabs200 = page.evaluate(
                """() => {
                  const nav = document.querySelector('nav[aria-label="Navegación inferior"]');
                  return Array.from(nav.querySelectorAll('button')).map(b => {
                    const r = b.getBoundingClientRect();
                    const label = b.querySelector('.mobile-tab-label');
                    return {
                      name: b.getAttribute('aria-label'),
                      width: Math.round(r.width),
                      labelFits: label ? label.getBoundingClientRect().width <= r.width - 2 : false,
                    };
                  });
                }"""
            )
            check(
                "a 360/200 los cinco tabs siguen completos",
                len(tabs200) == 5
                and all(tab["width"] > 0 and tab["labelFits"] for tab in tabs200),
                json.dumps(tabs200, ensure_ascii=False),
            )
            page.screenshot(path=str(SHOT_200))

            # La franja de cobros también se prueba a 200 % en Caja.
            page.get_by_role("button", name="Caja", exact=True).click()
            page.wait_for_timeout(500)
            broken_home = broken_words(page)
            check(
                "Caja a 360/200 sin palabras partidas",
                not broken_home,
                ", ".join(item["word"] for item in broken_home[:5]),
            )
            check(
                "Caja a 360/200 sin overflow horizontal",
                page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
            )

            context.close()
            browser.close()

    except Exception as error:
        check("E2E completó sin excepción", False, f"{type(error).__name__}: {error}")
    finally:
        cleanup()

    check("ninguna petición a :3000", len(requests_to_3000) == 0, json.dumps(requests_to_3000[:3]))
    passed = sum(1 for item in results if item["ok"] is True)
    failed = sum(1 for item in results if item["ok"] is False)
    known = sum(1 for item in results if item["ok"] is None)
    summary = {
        "startedAt": started_at.isoformat(),
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE,
        "gitAtStart": {
            "sha": start_commit,
            "branch": start_branch,
            "dirty": start_dirty,
        },
        "totals": {"pass": passed, "fail": failed, "known": known},
        "requestsTo3000": requests_to_3000,
        "dashboardCalls": len(dashboard_calls),
        "results": results,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{passed} PASS · {failed} FAIL · {known} KNOWN")
    print(f"Evidencia: {OUT}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

