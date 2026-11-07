#!/usr/bin/env python3
"""E2E del carril P1-1: preferencias de acompañamiento.

Verifica la sección "¿Cómo quieres que te ayude?" dentro de la hoja de Ayuda:
  - valores por defecto y aria-pressed;
  - apagado de "Sugerencias para revisar" con teclado;
  - persistencia en mercado-cero:companion:v1 y en la llave espejo
    mercado-cero:companion:suggestions;
  - que un cobro pendiente (aviso crítico de dinero) siga visible con las
    sugerencias apagadas;
  - encendido de nuevo y persistencia;
  - controles de 48 px, texto ampliado y 360 px sin desbordes.

Requisitos:
  pip install playwright
  python -m playwright install chromium

Uso (desde web/, con `npm run build` ya ejecutado):
  python scripts/companion-preferences-e2e.py

Levanta su propio `npm start` en :3305 con DATABASE_PATH temporal y
DEMO_MODE=true. Nunca apunta a :3000 ni a :3230. Las capturas se guardan en
%TEMP%\\opencode\\preferencias\\.
"""

from __future__ import annotations

import hashlib
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
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.environ.get(
    "COMPANION_BASE_URL",
    os.environ.get("BASE_URL", "http://localhost:3305"),
).rstrip("/")
PORT = urlparse(BASE).port or 80
if PORT in (3000, 3230):
    raise SystemExit("P1-1 E2E se niega a correr contra :3000 o :3230.")
if "localhost" not in BASE and "127.0.0.1" not in BASE:
    raise SystemExit("P1-1 E2E exige un servidor local aislado.")
if PORT != 3305:
    raise SystemExit("P1-1 E2E usa exclusivamente el puerto aislado :3305.")

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "web"
OUT = ROOT / "harness" / "evidence" / "companion-preferences-e2e.json"
SHOT_DIR = Path(os.environ.get("TEMP", tempfile.gettempdir())) / "opencode" / "preferencias"
EXTERNAL = os.environ.get("COMPANION_EXTERNAL_SERVER") == "1"
KEEP_DB = os.environ.get("COMPANION_KEEP_DB") == "1"
DB_PATH: Path | None = (
    Path(os.environ["COMPANION_DB_PATH"]).expanduser()
    if os.environ.get("COMPANION_DB_PATH")
    else None
)
SERVER: subprocess.Popen | None = None
RUN_DIR: Path | None = None

results: list[dict] = []
shots: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")


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
            "COMPANION_EXTERNAL_SERVER=1 con COMPANION_DB_PATH."
        )
    RUN_DIR = Path(tempfile.mkdtemp(prefix="mercado-cero-preferencias-"))
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


def screenshot(page, name: str) -> None:
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    path = SHOT_DIR / name
    page.screenshot(path=str(path), full_page=False)
    shots.append(
        {
            "path": str(path),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
    )
    print(f"SHOT  {path}")


def preferences_state(page) -> dict:
    return page.evaluate(
        """() => {
          let prefs = null;
          try {
            prefs = JSON.parse(localStorage.getItem('mercado-cero:companion:v1'));
          } catch {}
          return {
            prefs,
            mirror: localStorage.getItem('mercado-cero:companion:suggestions'),
          };
        }"""
    )


def open_help(page) -> None:
    page.get_by_role("button", name="Ayuda y accesibilidad", exact=True).click()
    page.get_by_role("dialog").wait_for(timeout=8000)
    page.get_by_role("heading", name="¿Cómo quieres que te ayude?").wait_for(
        timeout=8000
    )


def close_help(page) -> None:
    page.get_by_role("dialog").get_by_role("button", name="Cerrar", exact=True).click()
    page.get_by_role("dialog").wait_for(state="detached", timeout=5000)


def section_button(page, title: str):
    section = page.locator("#companion-preferences")
    return section.locator("button").filter(has_text=title).first


def pressed(page, title: str) -> str:
    return section_button(page, title).get_attribute("aria-pressed") or ""


def main() -> int:
    global SERVER
    started_at = datetime.now(timezone.utc)
    start_commit = git_value("rev-parse", "HEAD")
    start_branch = git_value("rev-parse", "--abbrev-ref", "HEAD")
    start_dirty = bool(git_value("status", "--porcelain"))
    requests_to_wrong_ports: list[str] = []

    if SHOT_DIR.exists():
        for old in SHOT_DIR.glob("*.png"):
            old.unlink()

    try:
        if not EXTERNAL:
            SERVER = start_server()
        else:
            if not DB_PATH:
                raise RuntimeError("Con COMPANION_EXTERNAL_SERVER=1 debes pasar COMPANION_DB_PATH.")
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
                if re.search(r":(3000|3230)(?:/|$)", request.url):
                    requests_to_wrong_ports.append(request.url)

            page.on("request", track_request)

            page.goto(BASE, wait_until="domcontentloaded")
            page.evaluate("localStorage.clear()")
            page.reload(wait_until="domcontentloaded")
            page.get_by_role("button", name="Ayuda y accesibilidad", exact=True).wait_for(
                timeout=15000
            )

            # 1 · La sección existe dentro de Ayuda y abre con los valores por defecto.
            open_help(page)
            section = page.locator("#companion-preferences")
            section.wait_for(state="visible", timeout=8000)
            heading = page.get_by_role("heading", name="¿Cómo quieres que te ayude?")
            check("la hoja de Ayuda muestra “¿Cómo quieres que te ayude?”", heading.count() == 1)
            check(
                "los tres controles abren activados por defecto",
                all(
                    pressed(page, title) == "true"
                    for title in (
                        "Sugerencias para revisar",
                        "Recordatorios de pendientes",
                        "Explicaciones en contexto",
                    )
                ),
                json.dumps(
                    {
                        title: pressed(page, title)
                        for title in (
                            "Sugerencias para revisar",
                            "Recordatorios de pendientes",
                            "Explicaciones en contexto",
                        )
                    },
                    ensure_ascii=False,
                ),
            )

            # 2 · Referencia de voz y privacidad verificable contra voice.ts.
            section_text = section.inner_text()
            check(
                "la voz se integra como referencia, sin duplicar controles",
                "La voz ya se ajusta arriba" in section_text
                and "Velocidad de la voz" in section_text,
            )
            check(
                "la nota de privacidad nombra a OpenAI y no promete retención del audio",
                "se envía a OpenAI" in section_text
                and "La app no guarda el audio" in section_text,
            )
            check(
                "la sección aclara que no apaga avisos críticos de dinero",
                "no apagan los avisos críticos de dinero" in section_text,
            )

            # 3 · Targets de 48 px y estructura accesible.
            sizes = section.locator("button").evaluate_all(
                """(nodes) => nodes.map((node) => ({
                  label: node.innerText.split('\\n')[0],
                  height: Math.round(node.getBoundingClientRect().height),
                  width: Math.round(node.getBoundingClientRect().width),
                  describedBy: node.getAttribute('aria-describedby'),
                }))"""
            )
            check(
                "los tres controles miden al menos 48 px de alto",
                len(sizes) == 3
                and all(item["height"] >= 48 and item["width"] >= 48 for item in sizes),
                json.dumps(sizes, ensure_ascii=False),
            )
            check(
                "cada control expone aria-pressed y aria-describedby",
                all(item["describedBy"] for item in sizes)
                and all(
                    section_button(page, title).get_attribute("aria-pressed") is not None
                    for title in (
                        "Sugerencias para revisar",
                        "Recordatorios de pendientes",
                        "Explicaciones en contexto",
                    )
                ),
            )

            section.scroll_into_view_if_needed()
            screenshot(page, "01-ayuda-abierta.png")

            page.evaluate(
                """() => {
                  window.__companionEvents = [];
                  window.addEventListener('mercado-cero:companion-changed', (event) => {
                    window.__companionEvents.push(event.detail);
                  });
                }"""
            )

            # 4 · Apagar con teclado, verificar el JSON versionado y el espejo.
            suggestions = section_button(page, "Sugerencias para revisar")
            suggestions.focus()
            page.keyboard.press("Space")
            page.wait_for_timeout(200)
            state = preferences_state(page)
            events = page.evaluate("window.__companionEvents || []")
            check(
                "Space apaga Sugerencias y actualiza aria-pressed",
                pressed(page, "Sugerencias para revisar") == "false",
                pressed(page, "Sugerencias para revisar"),
            )
            check(
                "el cambio publica el evento para la tarjeta Antes de cerrar",
                events
                and events[-1]
                == {
                    "v": 1,
                    "suggestions": False,
                    "reminders": True,
                    "explanations": True,
                },
                json.dumps(events[-1] if events else None, ensure_ascii=False),
            )
            check(
                "el JSON versionado guarda sólo Sugerencias apagada",
                state["prefs"]
                == {
                    "v": 1,
                    "suggestions": False,
                    "reminders": True,
                    "explanations": True,
                },
                json.dumps(state["prefs"], ensure_ascii=False),
            )
            check(
                "la llave compartida de sugerencias queda en off",
                state["mirror"] == "off",
                str(state["mirror"]),
            )
            section.scroll_into_view_if_needed()
            screenshot(page, "02-sugerencias-apagadas.png")

            # 5 · Recargar: la preferencia sigue apagada.
            page.reload(wait_until="domcontentloaded")
            page.get_by_role("button", name="Ayuda y accesibilidad", exact=True).wait_for(
                timeout=15000
            )
            open_help(page)
            page.locator("#companion-preferences").scroll_into_view_if_needed()
            state = preferences_state(page)
            check(
                "tras recargar, Sugerencias sigue apagada",
                pressed(page, "Sugerencias para revisar") == "false"
                and state["prefs"]["suggestions"] is False
                and state["mirror"] == "off",
                json.dumps(state, ensure_ascii=False),
            )
            check(
                "recargar no enciende Recordatorios ni Explicaciones",
                pressed(page, "Recordatorios de pendientes") == "true"
                and pressed(page, "Explicaciones en contexto") == "true",
            )
            screenshot(page, "03-recarga-apagada.png")

            # 6 · Cobro pendiente con Sugerencias apagadas: el aviso crítico sigue.
            close_help(page)
            seeded = page.request.post(
                f"{BASE}/api/orders",
                data={
                    "items": [
                        {
                            "description": "Cobro crítico E2E",
                            "quantity": 1,
                            "unitPriceCents": 6500,
                        }
                    ],
                    "cashCents": 0,
                    "creditCents": 0,
                },
            )
            assert seeded.ok, seeded.text()
            created = seeded.json()["order"]
            check(
                "el cobro pendiente se creó sin pago",
                created["status"] in ("confirmed", "payment_pending")
                and created["paidCents"] == 0,
                f"status={created['status']} paidCents={created['paidCents']}",
            )
            page.evaluate("window.dispatchEvent(new Event('focus'))")
            page.locator("#cobros-pendientes").wait_for(state="visible", timeout=12000)
            try:
                page.locator("#cobros-pendientes").get_by_text(
                    "Cobro crítico E2E", exact=False
                ).wait_for(timeout=12000)
            except Exception:
                # La comprobación de abajo reporta el texto real si no llegó.
                pass
            critical = page.locator("#cobros-pendientes")
            critical_text = critical.inner_text()
            check(
                "con Sugerencias apagadas, el aviso crítico de cobros sigue visible",
                "Cobros pendientes" in critical_text
                and "Cobro crítico E2E" in critical_text
                and "Total pendiente" in critical_text,
                critical_text[:220].replace("\n", " · "),
            )
            state = preferences_state(page)
            check(
                "el aviso crítico no reactiva la preferencia de Sugerencias",
                state["prefs"]["suggestions"] is False and state["mirror"] == "off",
                json.dumps(state, ensure_ascii=False),
            )
            critical.scroll_into_view_if_needed()
            page.wait_for_timeout(250)
            screenshot(page, "04-cobro-pendiente-sugerencias-apagadas.png")

            # 7 · Encender de nuevo y verificar persistencia.
            open_help(page)
            page.locator("#companion-preferences").scroll_into_view_if_needed()
            suggestions = section_button(page, "Sugerencias para revisar")
            suggestions.focus()
            page.keyboard.press("Enter")
            page.wait_for_timeout(200)
            state = preferences_state(page)
            check(
                "Enter enciende Sugerencias y actualiza aria-pressed",
                pressed(page, "Sugerencias para revisar") == "true",
                pressed(page, "Sugerencias para revisar"),
            )
            check(
                "el JSON y el espejo vuelven a on",
                state["prefs"]["suggestions"] is True and state["mirror"] == "on",
                json.dumps(state, ensure_ascii=False),
            )
            screenshot(page, "05-sugerencias-encendidas.png")

            page.reload(wait_until="domcontentloaded")
            page.get_by_role("button", name="Ayuda y accesibilidad", exact=True).wait_for(
                timeout=15000
            )
            open_help(page)
            page.locator("#companion-preferences").scroll_into_view_if_needed()
            state = preferences_state(page)
            check(
                "tras recargar, Sugerencias sigue encendida",
                pressed(page, "Sugerencias para revisar") == "true"
                and state["prefs"]["suggestions"] is True
                and state["mirror"] == "on",
                json.dumps(state, ensure_ascii=False),
            )

            # 8 · Las otras dos preferencias también persisten de forma independiente.
            section_button(page, "Recordatorios de pendientes").click()
            section_button(page, "Explicaciones en contexto").click()
            page.wait_for_timeout(150)
            state = preferences_state(page)
            check(
                "Recordatorios y Explicaciones se guardan por separado",
                state["prefs"]
                == {
                    "v": 1,
                    "suggestions": True,
                    "reminders": False,
                    "explanations": False,
                },
                json.dumps(state["prefs"], ensure_ascii=False),
            )
            page.reload(wait_until="domcontentloaded")
            page.get_by_role("button", name="Ayuda y accesibilidad", exact=True).wait_for(
                timeout=15000
            )
            open_help(page)
            page.locator("#companion-preferences").scroll_into_view_if_needed()
            check(
                "Recordatorios y Explicaciones siguen apagadas tras recargar",
                pressed(page, "Recordatorios de pendientes") == "false"
                and pressed(page, "Explicaciones en contexto") == "false",
            )
            section_button(page, "Recordatorios de pendientes").click()
            section_button(page, "Explicaciones en contexto").click()

            # 9 · Si localStorage falla, el control sigue respondiendo en memoria.
            page.evaluate(
                """() => {
                  window.__mcSetItem = Storage.prototype.setItem;
                  Storage.prototype.setItem = function () {
                    throw new DOMException('Sin espacio', 'QuotaExceededError');
                  };
                }"""
            )
            section_button(page, "Sugerencias para revisar").click()
            page.wait_for_timeout(150)
            check(
                "si localStorage falla, el control cambia y la app sigue",
                pressed(page, "Sugerencias para revisar") == "false",
                pressed(page, "Sugerencias para revisar"),
            )
            page.evaluate(
                """() => {
                  if (window.__mcSetItem) Storage.prototype.setItem = window.__mcSetItem;
                }"""
            )
            section_button(page, "Sugerencias para revisar").click()
            page.wait_for_timeout(150)
            check(
                "al recuperar el almacenamiento, la preferencia vuelve a on",
                pressed(page, "Sugerencias para revisar") == "true"
                and preferences_state(page)["mirror"] == "on",
                pressed(page, "Sugerencias para revisar"),
            )

            # 10 · Texto ampliado y 360 px: nada se sale ni pierde el control.
            page.set_viewport_size({"width": 360, "height": 800})
            page.get_by_role("dialog").get_by_role("button", name="Muy grande", exact=True).click()
            page.wait_for_timeout(300)
            page.locator("#companion-preferences").scroll_into_view_if_needed()
            page.wait_for_timeout(200)
            sizes = page.locator("#companion-preferences button").evaluate_all(
                """(nodes) => nodes.map((node) => ({
                  height: Math.round(node.getBoundingClientRect().height),
                  width: Math.round(node.getBoundingClientRect().width),
                }))"""
            )
            check(
                "a 360 px y texto grande los controles conservan 48 px",
                len(sizes) == 3
                and all(item["height"] >= 48 and item["width"] >= 48 for item in sizes),
                json.dumps(sizes, ensure_ascii=False),
            )
            check(
                "a 360 px y texto grande no hay desborde horizontal",
                page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
                page.evaluate(
                    "`${document.documentElement.scrollWidth}/${innerWidth}`"
                ),
            )
            screenshot(page, "06-360-texto-grande.png")

            context.close()
            browser.close()

    except Exception as error:
        check("E2E completó sin excepción", False, f"{type(error).__name__}: {error}")
    finally:
        cleanup()

    check(
        "ninguna petición a :3000 ni a :3230",
        len(requests_to_wrong_ports) == 0,
        json.dumps(requests_to_wrong_ports[:3]),
    )
    passed = sum(1 for item in results if item["ok"] is True)
    failed = sum(1 for item in results if item["ok"] is False)
    summary = {
        "startedAt": started_at.isoformat(),
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": BASE,
        "port": PORT,
        "database": str(DB_PATH) if DB_PATH else None,
        "gitAtStart": {
            "sha": start_commit,
            "branch": start_branch,
            "dirty": start_dirty,
        },
        "totals": {"pass": passed, "fail": failed},
        "screenshots": shots,
        "results": results,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n{passed} PASS · {failed} FAIL")
    print(f"Evidencia: {OUT}")
    print(f"Capturas: {SHOT_DIR}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
