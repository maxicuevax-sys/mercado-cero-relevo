#!/usr/bin/env python3
"""E2E de “Antes de cerrar” (checklist de Corte), sin IA.

Requiere un servidor YA levantado, con una base desechable y DEMO_MODE=true.

Uso:
  $env:BASE_URL="http://localhost:3302"
  python web/scripts/closing-checklist-e2e.py

Opcional:
  python web/scripts/closing-checklist-e2e.py --base-url http://localhost:3302

El script crea sus propios pendientes por API, verifica la tarjeta con
Playwright usando solo roles y nombres accesibles, y deja capturas en
%TEMP%\\opencode\\cierre-cognitivo\\.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

MEXICO = timezone(timedelta(hours=-6))
DISMISS_KEY = "mercado-cero:antes-de-cerrar:oculto:v1"
SHOT_DIR = Path(tempfile.gettempdir()) / "opencode" / "cierre-cognitivo"
RESULTS: list[dict[str, object]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{' — ' + detail if detail else ''}")


def note(name: str, detail: str = "") -> None:
    RESULTS.append({"name": name, "ok": None, "detail": detail})
    print(f"INFO  {name}{' — ' + detail if detail else ''}")


def mexico_now() -> datetime:
    return datetime.now(timezone.utc).astimezone(MEXICO)


def mexico_key(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%d")


def api(
    base_url: str,
    method: str,
    path: str,
    payload: dict | None = None,
) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}{path}",
        data=data,
        method=method,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"{method} {path} respondió {error.code}: {detail[:300]}"
        ) from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"No pude conectar a {base_url}: {error.reason}") from error


def create_task(base_url: str, title: str, due_key: str) -> dict:
    result = api(
        base_url,
        "POST",
        "/api/tasks",
        {"title": title, "dueAt": due_key, "note": "Creado por el E2E."},
    )
    task = result.get("task")
    if not isinstance(task, dict) or not task.get("id"):
        raise RuntimeError(f"La API no devolvió el pendiente creado: {result}")
    return task


def delete_task(base_url: str, task_id: str) -> None:
    try:
        api(base_url, "DELETE", f"/api/tasks/{task_id}")
    except RuntimeError as error:
        print(f"WARN  No pude borrar {task_id}: {error}")


def wait_for_hydration(page) -> None:
    # La fecha del topbar se calcula en un efecto: si ya está, React escuchó
    # el clic de la pestaña. Evita perder el primer clic en un build frío.
    page.get_by_text(
        re.compile(r"lunes|martes|miércoles|jueves|viernes|sábado|domingo"),
        exact=False,
    ).first.wait_for()


def open_corte(page, wait_card: bool = True) -> None:
    wait_for_hydration(page)
    page.get_by_role("navigation", name="Navegación principal").get_by_role(
        "button", name="Corte", exact=True
    ).click()
    if wait_card:
        page.get_by_role("heading", name="Antes de cerrar", level=2).wait_for()
    else:
        page.get_by_role("heading", name="Corte de caja", level=1).wait_for()


def reload_and_open_corte(page, base_url: str) -> None:
    page.goto(base_url, wait_until="domcontentloaded")
    page.get_by_role("heading", name="Caja", level=1).wait_for()
    open_corte(page)


def card(page):
    return page.get_by_role("region", name="Antes de cerrar")


def row(page, title: str):
    return card(page).get_by_role("listitem").filter(has_text=title)


def shot(page, name: str) -> None:
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SHOT_DIR / name), full_page=True)


def fail(message: str) -> None:
    check("Servidor disponible", False, message)
    print("\nFAIL: no hay un servidor utilizable. Levanta uno aislado, por ejemplo:")
    print('  $env:DATABASE_PATH="$env:TEMP\\cierre-e2e.db"')
    print('  $env:DEMO_MODE="true"')
    print("  cd web; npm start -- -p 3302")
    sys.exit(1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("BASE_URL", "http://localhost:3302"),
    )
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")
    parsed = urlparse(base_url)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port in (3000, 3230):
        raise SystemExit(
            f"Este E2E no corre contra :{port}. Usa un servidor aislado, p. ej. :3302."
        )

    SHOT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Servidor y modo demo.
    try:
        health = api(base_url, "GET", "/api/health")
    except Exception as error:  # noqa: BLE001 - el mensaje debe ser claro
        fail(f"{base_url} no responde: {error}")
        raise AssertionError("inalcanzable") from error
    if not health.get("ok"):
        fail(f"/api/health no está ok: {health}")
    dashboard = api(base_url, "GET", "/api/dashboard")
    demo_mode = bool(dashboard.get("demoMode"))
    check("Servidor aislado responde", True, f"build {health.get('buildSha', '?')}")
    check("DEMO_MODE activo", demo_mode, "necesario para limpiar cobros demo")
    if not demo_mode:
        print(
            "FAIL: el estado vacío necesita DEMO_MODE=true para poder cerrar "
            "los cobros demo sin tocar datos reales."
        )
        return 1

    initial_pending = dashboard.get("pendingOrders") or []
    check(
        "Dashboard entrega cobros pendientes",
        len(initial_pending) > 0,
        f"{len(initial_pending)} cobro(s) inicial(es)",
    )

    today = mexico_key(mexico_now())
    tomorrow = mexico_key(mexico_now() + timedelta(days=1))
    future = mexico_key(mexico_now() + timedelta(days=6))
    suffix = mexico_now().strftime("%H%M%S")
    title_today = f"E2E cobrar proveedor {suffix}"
    title_postpone = f"E2E llamar cliente {suffix}"
    title_future = f"E2E revisar vitrina {suffix}"
    title_hide = f"E2E reponer cambio {suffix}"

    created_ids: list[str] = []
    task_today = create_task(base_url, title_today, today)
    created_ids.append(task_today["id"])
    task_postpone = create_task(base_url, title_postpone, today)
    created_ids.append(task_postpone["id"])
    task_future = create_task(base_url, title_future, future)
    created_ids.append(task_future["id"])
    task_hide = create_task(base_url, title_hide, today)
    created_ids.append(task_hide["id"])
    check("Pendientes de prueba creados por API", True, "4 pendientes")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={"width": 1280, "height": 1000})
        page = context.new_page()
        page.set_default_timeout(20_000)

        page.goto(base_url, wait_until="domcontentloaded")
        page.get_by_role("heading", name="Caja", level=1).wait_for()
        open_corte(page)

        # 2. La tarjeta aparece arriba del formulario y muestra cobros.
        expect(card(page)).to_be_visible()
        expect(
            card(page).get_by_text("Esperando confirmación").first
        ).to_be_visible()
        check(
            "Corte muestra “Antes de cerrar”",
            True,
            "con cobro demo esperando confirmación",
        )
        shot(page, "01-corte-con-pendientes.png")

        # 3. Pendiente de hoy: aparece y se puede completar.
        expect(row(page, title_today)).to_have_count(1)
        expect(
            row(page, title_today).get_by_role(
                "link", name="Ver en Pendientes", exact=True
            )
        ).to_be_visible()
        check("Cada pendiente ofrece “Ver en Pendientes”", True)
        shot(page, "02-pendiente-de-hoy.png")
        row(page, title_today).get_by_role(
            "button", name=re.compile(r"^Completar:")
        ).click()
        expect(row(page, title_today)).to_have_count(0)
        tasks_after_complete = api(base_url, "GET", "/api/tasks?limit=200")
        completed = next(
            (
                item
                for item in tasks_after_complete.get("tasks", [])
                if item.get("id") == task_today["id"]
            ),
            None,
        )
        check(
            "Completar quita el pendiente",
            completed is not None and completed.get("status") == "done",
            f"estado={completed.get('status') if completed else 'ausente'}",
        )
        shot(page, "03-completado.png")

        # 4. Posponer a mañana: se mueve al grupo “Para mañana” y la API
        # guarda mañana 09:00 de México.
        expect(row(page, title_postpone)).to_have_count(1)
        row(page, title_postpone).get_by_role(
            "button", name=re.compile(r"^Posponer a mañana:")
        ).click()
        expect(row(page, title_today)).to_have_count(0)
        today_section = card(page).get_by_role("region", name="Para hoy")
        expect(
            today_section.get_by_role("listitem").filter(has_text=title_postpone)
        ).to_have_count(0)
        tomorrow_section = card(page).get_by_role("region", name="Para mañana")
        expect(tomorrow_section).to_be_visible()
        expect(
            tomorrow_section.get_by_role("listitem").filter(has_text=title_postpone)
        ).to_have_count(1)
        tasks_after_postpone = api(base_url, "GET", "/api/tasks?limit=200")
        postponed = next(
            (
                item
                for item in tasks_after_postpone.get("tasks", [])
                if item.get("id") == task_postpone["id"]
            ),
            None,
        )
        postponed_local = (
            datetime.fromisoformat(postponed["postponedUntil"]).astimezone(MEXICO)
            if postponed and postponed.get("postponedUntil")
            else None
        )
        check(
            "Posponer manda el pendiente a mañana 09:00",
            postponed_local is not None
            and postponed_local.strftime("%Y-%m-%d") == tomorrow
            and postponed_local.hour == 9
            and postponed_local.minute == 0,
            postponed_local.isoformat() if postponed_local else "sin fecha",
        )
        shot(page, "04-pospuesto-manana.png")

        # 5. Un pendiente futuro no entra a la lista.
        expect(row(page, title_future)).to_have_count(0)
        check("No muestra pendientes futuros", True, "6 días no aparece")

        # 6. “Ver” de un cobro abre el pedido, sin afirmar que está pagado.
        card(page).get_by_role(
            "button", name=re.compile(r"^Ver cobro:")
        ).first.click()
        dialog = page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        expect(dialog.get_by_text("$120.00").first).to_be_visible()
        check("“Ver” abre el cobro pendiente", True, "sin marcarlo como pagado")
        dialog.get_by_role("button", name="Cerrar", exact=True).click()
        expect(dialog).to_have_count(0)
        page.get_by_role("navigation", name="Navegación principal").get_by_role(
            "button", name="Corte", exact=True
        ).click()
        page.get_by_role("heading", name="Antes de cerrar", level=2).wait_for()

        # 7. “Ahora no” oculta la tarjeta en esta sesión, sin borrar datos y
        # sin ocultar los avisos de dinero de Caja.
        expect(row(page, title_hide)).to_have_count(1)
        card(page).get_by_role("button", name="Ahora no", exact=True).click()
        expect(card(page)).to_have_count(0)
        session_flag = page.evaluate(
            "key => window.sessionStorage.getItem(key)", DISMISS_KEY
        )
        hide_task = next(
            (
                item
                for item in api(base_url, "GET", "/api/tasks?limit=200").get(
                    "tasks", []
                )
                if item.get("id") == task_hide["id"]
            ),
            None,
        )
        check(
            "“Ahora no” oculta la tarjeta sin borrar",
            session_flag == "1" and hide_task and hide_task.get("status") == "open",
            f"sessionStorage={session_flag}, estado={hide_task.get('status') if hide_task else 'ausente'}",
        )
        shot(page, "05-ahora-no-corte.png")

        page.get_by_role("navigation", name="Navegación principal").get_by_role(
            "button", name="Caja", exact=True
        ).click()
        expect(
            page.get_by_role("heading", name="Cobros pendientes", level=2)
        ).to_be_visible()
        check(
            "Los avisos críticos de dinero siguen en Caja",
            True,
            "“Cobros pendientes” visible tras “Ahora no”",
        )
        shot(page, "06-caja-avisos-siguen.png")

        # La ocultación sobrevive a una recarga dentro de la misma sesión.
        page.reload()
        page.get_by_role("heading", name="Caja", level=1).wait_for()
        open_corte(page, wait_card=False)
        expect(card(page)).to_have_count(0)
        check("“Ahora no” se conserva al recargar la sesión", True)

        # 8. La preferencia de sugerencias apagada oculta solo esta tarjeta;
        # los avisos críticos de dinero siguen en Caja.
        prefs_context = browser.new_context(viewport={"width": 1280, "height": 1000})
        prefs_page = prefs_context.new_page()
        prefs_page.goto(base_url, wait_until="domcontentloaded")
        prefs_page.get_by_role("heading", name="Caja", level=1).wait_for()
        prefs_page.evaluate(
            "key => window.localStorage.setItem(key, 'off')",
            "mercado-cero:companion:suggestions",
        )
        prefs_page.reload()
        prefs_page.get_by_role("heading", name="Caja", level=1).wait_for()
        open_corte(prefs_page, wait_card=False)
        expect(card(prefs_page)).to_have_count(0)
        expect(
            prefs_page.get_by_role(
                "heading", name="Cuenta el efectivo de hoy", level=2
            )
        ).to_be_visible()
        prefs_page.get_by_role("navigation", name="Navegación principal").get_by_role(
            "button", name="Caja", exact=True
        ).click()
        expect(
            prefs_page.get_by_role("heading", name="Cobros pendientes", level=2)
        ).to_be_visible()
        check(
            "Sugerencias apagadas ocultan la tarjeta, no los avisos de dinero",
            True,
            "corte y cobros siguen visibles",
        )
        shot(prefs_page, "09-sugerencias-off.png")

        prefs_page.evaluate(
            "key => window.localStorage.removeItem(key)",
            "mercado-cero:companion:suggestions",
        )
        reload_and_open_corte(prefs_page, base_url)
        expect(card(prefs_page)).to_be_visible()
        check("Sin la llave, la tarjeta aparece", True, "se asume encendida")
        prefs_context.close()

        # 9. Estado vacío: limpiar lo creado y los cobros demo por la API
        # oficial de demo. No se toca la lógica de dinero.
        page.evaluate(
            "key => window.sessionStorage.removeItem(key)", DISMISS_KEY
        )
        for task_id in created_ids:
            delete_task(base_url, task_id)
        dashboard = api(base_url, "GET", "/api/dashboard")
        for order in dashboard.get("pendingOrders") or []:
            if not str(order.get("id", "")).startswith("demo_"):
                print(
                    "FAIL: hay un cobro no demo pendiente; el estado vacío "
                    "no se puede probar sin tocar datos reales."
                )
                return 1
            api(
                base_url,
                "POST",
                "/api/demo/pay",
                {"orderId": order["id"], "method": "card"},
            )
        remaining = [
            item
            for item in api(base_url, "GET", "/api/tasks?limit=200").get(
                "tasks", []
            )
            if item.get("status") == "open"
        ]
        remaining_pending = api(base_url, "GET", "/api/dashboard").get(
            "pendingOrders"
        ) or []
        check(
            "Datos de prueba limpios",
            len(remaining) == 0 and len(remaining_pending) == 0,
            f"{len(remaining)} pendiente(s), {len(remaining_pending)} cobro(s)",
        )

        reload_and_open_corte(page, base_url)
        empty_message = page.get_by_text(
            "No hay pendientes para hoy. Puedes cerrar cuando quieras.",
            exact=True,
        )
        expect(empty_message).to_be_visible()
        check("Lista vacía muestra el mensaje neutral", True)
        shot(page, "07-lista-vacia.png")

        # 10. Si la red falla, la tarjeta lo dice sin bloquear el corte.
        error_context = browser.new_context(viewport={"width": 1280, "height": 1000})
        error_page = error_context.new_page()
        error_page.route("**/api/tasks*", lambda route: route.abort())
        error_page.goto(base_url, wait_until="domcontentloaded")
        error_page.get_by_role("heading", name="Caja", level=1).wait_for()
        open_corte(error_page)
        expect(
            error_page.get_by_text(
                "No pude leer los pendientes. Puedes cerrar igual.", exact=True
            )
        ).to_be_visible()
        expect(
            error_page.get_by_role(
                "heading", name="Cuenta el efectivo de hoy", level=2
            )
        ).to_be_visible()
        check(
            "Fallo de red no bloquea el corte",
            True,
            "mensaje neutral y formulario visible",
        )
        shot(error_page, "08-error-red.png")
        error_context.close()

        browser.close()

    output = SHOT_DIR / "closing-checklist-e2e.json"
    output.write_text(
        json.dumps(
            {
                "baseUrl": base_url,
                "screenshots": sorted(path.name for path in SHOT_DIR.glob("*.png")),
                "results": RESULTS,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    failures = [item for item in RESULTS if item["ok"] is False]
    print(f"\nCapturas: {SHOT_DIR}")
    print(f"Resultado: {'PASS' if not failures else 'FAIL'} ({len(failures)} fallo(s))")
    return 0 if not failures else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"FAIL: {error}")
        raise SystemExit(1) from error
