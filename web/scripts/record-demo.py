"""
Graba el respaldo silencioso del guion de 3 minutos de Mercado Cero.

Uso:
  cd web
  python scripts/record-demo.py

Variables de entorno:
  DEMO_BASE_URL / BASE_URL  URL del servidor (obligatoria; el carril aislado
                            usa http://127.0.0.1:3310). No hay puerto por
                            defecto.
  DEMO_OUT_DIR              carpeta de salida. Por defecto <repo>/demo.
                            En pruebas aisladas usa una carpeta temporal.
  DEMO_RESET_TOKEN          token opcional para /api/demo/reset
  DEMO_HEADED=1             abre Chromium visible (debug)

Salidas por defecto:
  demo/mercado-cero-demo.mp4
  demo/stageshow/01-caja-en-reposo.png ... 08-meta.png
  demo/record-demo.json          (manifiesto con checks y duración)
  demo/record-demo-error.png/json si algo falla

No toca la app: solo usa roles y nombres visibles. El corte se valida contra
/api/cash ($550.00) y contra el texto visible ("Cuadra" y
"El efectivo cuadra con lo esperado.").
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

from demo_ui import (
    BASE,
    MP4,
    OUT,
    RECORD_MANIFEST,
    STAGESHOW,
    STAGE_FRAMES,
    DemoFailure,
    api_get,
    blur,
    click_named,
    click_text,
    close_sheets,
    display_path,
    ensure_dirs,
    fill_named,
    last_dialog,
    open_app,
    open_tab,
    probe_video,
    require_base,
    reset_demo_quiet,
    transcode,
    wait_any_text,
    wait_app_ready,
    wait_dialog,
    wait_regex,
    wait_text,
    write_json,
)

ERROR_PNG = OUT / "record-demo-error.png"
ERROR_JSON = OUT / "record-demo-error.json"
VIDEO_DIR = OUT / "video"


def caption(page: Page, text: str) -> None:
    page.evaluate(
        """(text) => {
            let el = document.getElementById('demo-caption');
            if (!el) {
                el = document.createElement('div');
                el.id = 'demo-caption';
                document.body.appendChild(el);
            }
            el.textContent = text;
            el.style.cssText = [
                'position:fixed',
                'left:50%',
                'bottom:22px',
                'transform:translateX(-50%)',
                'z-index:9999',
                'background:#f3eee5',
                'color:#1b241f',
                'border:2px solid #0b5a43',
                'padding:10px 16px',
                'font:600 15px/1.35 system-ui, sans-serif',
                'max-width:78vw',
                'text-align:center',
                'box-shadow:0 6px 18px rgba(0,0,0,.14)',
            ].join(';');
        }""",
        text,
    )


def card(page: Page, title: str, subtitle: str) -> None:
    page.evaluate(
        """({ title, subtitle }) => {
            const old = document.getElementById('demo-card');
            if (old) old.remove();
            const el = document.createElement('div');
            el.id = 'demo-card';
            el.innerHTML = `
              <div style="text-align:center">
                <div style="font:700 52px/0.95 Georgia, serif; letter-spacing:-0.03em; color:#1b241f">${title}</div>
                <div style="margin-top:14px; font:500 18px/1.4 system-ui, sans-serif; color:#5f6b63">${subtitle}</div>
              </div>`;
            el.style.cssText = [
                'position:fixed',
                'inset:0',
                'z-index:10000',
                'background:#f3eee5',
                'display:grid',
                'place-items:center',
                'padding:24px',
            ].join(';');
            document.body.appendChild(el);
        }""",
        {"title": title, "subtitle": subtitle},
    )


def remove_card(page: Page) -> None:
    page.evaluate("document.getElementById('demo-card')?.remove()")


def hold(page: Page, seconds: float) -> None:
    page.wait_for_timeout(int(seconds * 1000))


def stage_shot(page: Page, slug: str, anchor: str | None = None) -> Path:
    """Captura limpia (sin subtítulo ni tarjeta) para el stageshow."""
    page.evaluate(
        """() => {
            for (const id of ['demo-caption', 'demo-card']) {
              const el = document.getElementById(id);
              if (el) el.style.visibility = 'hidden';
            }
        }"""
    )
    if anchor:
        try:
            page.get_by_text(anchor, exact=False).first.evaluate(
                "el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })"
            )
            page.wait_for_timeout(220)
        except Exception:
            pass
    page.wait_for_timeout(150)
    target = STAGESHOW / STAGE_FRAMES[slug]
    target.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(target))
    page.evaluate(
        """() => {
            for (const id of ['demo-caption', 'demo-card']) {
              const el = document.getElementById(id);
              if (el) el.style.visibility = '';
            }
        }"""
    )
    return target


def run(page: Page, checks: list[dict], console_errors: list[str]) -> None:
    def check(name: str, ok: bool, detail: str = "") -> None:
        item = {"name": name, "ok": bool(ok), "detail": detail}
        checks.append(item)
        print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f" — {detail}" if detail else ""))
        if not ok:
            raise DemoFailure(f"Falló la verificación: {name}. {detail}")

    ip = open_app(page, tag="record")
    print(f"  base={BASE} reset_ip={ip}")
    check("app en Caja", True, page.url)

    health = api_get(page, "/api/health")
    print(f"  buildSha={health.get('buildSha')}")
    check(
        "servidor con build identificado",
        bool(health.get("buildSha")) and health.get("buildSha") != "unknown",
        f"buildSha={health.get('buildSha')}",
    )

    # Copy de la UI definitiva: el subtítulo de Caja y la captura manual.
    wait_text(page, "Ventas registradas hoy", 15_000, description="'Ventas registradas hoy'")
    wait_text(page, "Cobrado confirmado", 15_000, description="'Cobrado confirmado'")
    wait_text(page, "Por cobrar de hoy", 15_000, description="'Por cobrar de hoy'")
    wait_text(page, "¿Qué vendiste?", 15_000, description="'¿Qué vendiste?'")
    wait_text(page, "Agregar a mano", 15_000, description="'Agregar a mano'")
    visible = page.evaluate(
        "() => (document.body?.innerText || '').replace(/\\s+/g, ' ').trim()"
    )
    check(
        "UI definitiva en Caja",
        "Mostrador claro" not in visible,
        "Ventas registradas hoy · Cobrado confirmado · Por cobrar de hoy · Agregar a mano",
    )

    # Beat 01: caja en reposo, sin overlays.
    stage_shot(page, "01")
    card(page, "Mercado Cero", "La caja que habla · demo de respaldo")
    hold(page, 1.2)
    # La tarjeta tapa la pantalla: verifica las pestañas sin ensuciar el video.
    page.evaluate(
        "() => { const el = document.getElementById('demo-card'); "
        "if (el) el.style.pointerEvents = 'none'; }"
    )
    try:
        for tab, markers in (
            ("Fiado", ("Saldo pendiente",)),
            ("Corte", ("Corte de caja", "Antes de cerrar")),
            ("Meta", ("Mi camino", "Una meta a la vez.")),
            ("Pendientes", ("Pendientes", "Lo que queda para después.")),
        ):
            open_tab(page, tab)
            for marker in markers:
                wait_text(page, marker, 10_000, description=f"la pestaña {tab}")
        open_tab(page, "Caja")
        wait_app_ready(page)
        check(
            "pestañas Caja/Fiado/Corte/Meta/Pendientes",
            True,
            "roles y nombres visibles; Corte muestra 'Antes de cerrar'; Pendientes su bandeja",
        )
    finally:
        page.evaluate(
            "() => { const el = document.getElementById('demo-card'); "
            "if (el) el.style.pointerEvents = ''; }"
        )
        hold(page, 2.4)
        remove_card(page)
    caption(page, "Lupita cobra en la cuenta de su hija. Una captura no basta.")
    hold(page, 10.0)

    # Beat 02: venta dictada por la frase de ejemplo, con fallback al texto.
    caption(page, "1. La comerciante dicta la venta")
    hold(page, 3.5)
    try:
        click_named(
            page,
            [
                r"Dos quesadillas de 35 y un agua de 20",
                r"Quesadillas \$?90",
                r"Quesadillas",
            ],
            description="la frase de ejemplo de la venta",
        )
    except DemoFailure:
        fill_named(
            page,
            [r"^Escribe la venta$", r"Escribe lo que vendiste", r"Escribe la venta"],
            "Dos quesadillas de 35 y un agua de 20",
            description="el campo de venta",
        )
        click_named(
            page,
            [r"^Interpretar$", r"^Interpretar venta$"],
            description="Interpretar",
        )

    wait_text(page, "$90.00", 25_000, description="el total $90.00")
    wait_any_text(
        page,
        ["2 productos", "2 producto"],
        12_000,
        description="los 2 productos interpretados",
    )
    check("venta de $90", True, "$90.00 y 2 productos visibles")
    # La app hace scroll suave a #pedido al interpretar. Espera a que termine
    # y baja al total/CTA: el bloque completo no cabe en 800 px.
    hold(page, 1.4)
    page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    hold(page, 0.6)
    stage_shot(page, "02")
    caption(page, "2. La caja arma el pedido: dos quesadillas y un agua, $90")
    hold(page, 10.0)

    # Confirmar venta. Se busca dentro de "Pedido en curso" y luego global.
    confirm_patterns = [
        r"^Confirmar venta",
        r"^Cobrar venta$",
        r"^Cobrar$",
        r"^Registrar venta$",
    ]
    pedido_scope = None
    try:
        heading = page.get_by_role(
            "heading", name=re.compile(r"Pedido en curso|Tu venta|Venta en curso", re.I)
        ).first
        if heading.count():
            pedido_scope = heading.locator("xpath=ancestor::section[1]")
    except Exception:
        pedido_scope = None
    try:
        click_named(
            page,
            confirm_patterns,
            scope=pedido_scope,
            description="Confirmar venta",
        )
    except DemoFailure:
        click_named(
            page,
            confirm_patterns,
            description="Confirmar venta (global)",
        )

    wait_dialog(page, timeout=20_000, title=r"Cobro|Cobrar")
    wait_any_text(
        page,
        ["Link de pago", "QR CoDi directo", "Pagar"],
        15_000,
        description="las opciones de cobro",
    )
    stage_shot(page, "03")
    caption(page, "3. Un solo cobro: link o QR, cualquier forma de pagar")
    hold(page, 10.0)

    # Generar link y simular CoDi (demo).
    dialog = last_dialog(page)
    click_named(
        page,
        [r"^Link de pago", r"^Pagar$", r"^Pagar con", r"^Generar link", r"^Cobrar"],
        scope=dialog,
        timeout=20_000,
        description="Link de pago",
    )
    wait_any_text(
        page,
        ["Simular CoDi", "Simular pago", "Pago demo", "Esperando al banco"],
        20_000,
        description="la simulación demo del cobro",
    )
    stage_shot(page, "04")
    caption(page, "4. Link/QR multi-método. Esperando al banco.")
    hold(page, 11.0)

    click_named(
        page,
        [r"^Simular CoDi$", r"^Simular pago", r"^Pago demo", r"^Simular tarjeta$"],
        scope=last_dialog(page),
        timeout=20_000,
        description="Simular CoDi",
    )
    wait_any_text(
        page,
        ["Pago demo (simulado)", "Pago demo", "Pago simulado"],
        20_000,
        description="el resultado 'Pago demo (simulado)'",
    )
    check(
        "pago demo confirmado",
        True,
        "Pago demo (simulado) visible; el botón de cierre dice 'Cerrar demo'",
    )
    stage_shot(page, "05")
    caption(
        page,
        "5. Pago simulado: en producción solo el webhook firmado marca pagado",
    )
    hold(page, 11.0)
    if not close_sheets(page):
        raise DemoFailure("La hoja de resultado no se cerró; la caja sigue bloqueada.")
    check("hoja de resultado cerrada", True)

    # Beat 06: anti-fraude.
    click_named(
        page,
        [r"^Verificar comprobante$", r"^Verificar$"],
        description="Verificar comprobante",
    )
    wait_dialog(page, timeout=15_000, title=r"Verificar")
    click_named(
        page,
        [r"^Probar con un comprobante falso$", r"comprobante falso"],
        scope=last_dialog(page),
        description="Probar con un comprobante falso",
    )
    wait_text(page, "No verificado", 15_000, description="'No verificado'")
    check("comprobante falso rechazado", True)
    stage_shot(page, "06")
    caption(page, "6. Anti-fraude: si el ID no existe en pey, no es un pago.")
    hold(page, 10.0)
    if not close_sheets(page):
        raise DemoFailure("La hoja de verificación no se cerró.")

    # Beat 07: fiado de Juan. Primero el chip de voz; fallback a Fiado.
    used_fiado_tab = False
    try:
        click_named(
            page,
            [r"Juan pag[oó] \$?50", r"Juan me pag[oó] 50", r"Juan pag[oó]"],
            description="el chip de abono de Juan",
        )
    except DemoFailure:
        used_fiado_tab = True
        open_tab(page, "Fiado", "Fiar")
        wait_text(page, "Saldo pendiente", 15_000, description="Fiado")
        try:
            row = page.get_by_text("Juan", exact=True).first.locator(
                "xpath=ancestor::*[.//button[contains(normalize-space(.), "
                "'Registrar abono')]][1]"
            )
            click_named(
                page,
                [r"^Registrar abono$"],
                scope=row,
                description="Registrar abono de Juan",
            )
        except DemoFailure:
            click_named(
                page,
                [r"^Registrar abono$"],
                description="Registrar abono del primer fiado",
            )

    dialog = wait_dialog(page, timeout=15_000, title=r"Registrar abono|Saldo vivo")
    wait_text(page, "Saldo vivo", 12_000, description="el saldo vivo del abono")
    fill_named(
        page,
        [r"^Monto del abono", r"Monto del abono en pesos", r"Monto"],
        "50",
        scope=dialog,
        description="el monto del abono",
    )
    try:
        click_text(page, "Efectivo", scope=dialog, description="Efectivo")
    except DemoFailure:
        click_named(
            page,
            [r"^Efectivo$", r"^Efectivo\b"],
            scope=dialog,
            description="el método Efectivo",
        )
    caption(page, "7. Fiado: Juan abona $50 en efectivo; no es una venta nueva.")
    hold(page, 3.5)

    click_named(
        page,
        [r"^Registrar abono$"],
        scope=last_dialog(page),
        description="confirmar el abono",
    )
    wait_any_text(
        page,
        ["debe $0.00", "Abono registrado", "Saldado"],
        20_000,
        description="la confirmación del abono",
    )
    if not close_sheets(page, timeout=5_000):
        raise DemoFailure("La hoja de abono no se cerró después de registrar.")

    credits = api_get(page, "/api/credits?limit=100").get("credits", [])
    juan = next(
        (
            credit
            for credit in credits
            if (credit.get("customerName") or "").strip().lower() == "juan"
        ),
        None,
    )
    balance = juan.get("balanceCents") if juan else None
    cash = api_get(page, "/api/cash")
    check(
        "abono de $50 en efectivo",
        balance == 0 and cash.get("cashCreditCents") == 5000,
        f"balanceCents={balance} cashCreditCents={cash.get('cashCreditCents')}",
    )
    caption(page, "El saldo de Juan queda en $0.00; el efectivo entra a la caja.")
    hold(page, 7.0)

    # Consulta por voz.
    if used_fiado_tab:
        open_tab(page, "Caja")
        wait_app_ready(page)
    try:
        click_named(
            page,
            [r"¿Cu[aá]nto vend[ií]", r"Cu[aá]nto vend[ií]"],
            description="la frase '¿Cuánto vendí?'",
        )
    except DemoFailure:
        fill_named(
            page,
            [r"^Escribe la venta$", r"Escribe lo que vendiste"],
            "¿Cuánto vendí hoy?",
            description="el campo de venta para la consulta",
        )
        click_named(page, [r"^Interpretar$"], description="Interpretar la consulta")
    wait_regex(
        page,
        r"no es dinero real",
        15_000,
        description="la respuesta de la consulta con el demo aparte",
    )
    check(
        "consulta de ventas",
        True,
        "la caja responde con ventas, cobrado confirmado y por cobrar; el demo va aparte",
    )
    caption(
        page,
        "8. La caja responde con el mismo corte: ventas, cobrado confirmado y por cobrar.",
    )
    hold(page, 7.0)

    # Corte: $500 de base + $50 del abono = $550. Cuadra.
    open_tab(page, "Corte")
    wait_text(page, "Corte de caja", 15_000, description="Corte de caja")
    wait_text(page, "Antes de cerrar", 15_000, description="'Antes de cerrar'")
    check("Corte con 'Antes de cerrar'", True, "checklist visible arriba del conteo")
    try:
        click_named(
            page,
            [r"^Actualizar corte$", r"^Actualizar totales$", r"^Actualizar totales"],
            description="Actualizar corte",
        )
    except DemoFailure:
        pass

    cash = api_get(page, "/api/cash")
    check(
        "corte espera $550",
        cash.get("expectedCents") == 55000,
        f"expectedCents={cash.get('expectedCents')}",
    )
    wait_text(page, "$550.00", 15_000, description="'$550.00' en el corte")

    counted_by_denomination = True
    try:
        click_named(
            page,
            [r"^Contar por billetes y monedas$"],
            description="Contar por billetes y monedas",
        )
        hold(page, 0.4)
        fill_named(page, [r"^Cantidad de \$100$"], "5", description="$100")
        fill_named(page, [r"^Cantidad de \$50$"], "1", description="$50")
        fill_named(page, [r"^Cantidad de \$20$"], "0", description="$20")
    except DemoFailure:
        counted_by_denomination = False
        fill_named(
            page,
            [r"^Total contado en pesos$", r"^Total contado$"],
            "550.00",
            description="Total contado",
        )
    blur(page)
    wait_text(
        page,
        "El efectivo cuadra con lo esperado.",
        12_000,
        description="'El efectivo cuadra con lo esperado.'",
    )
    wait_text(page, "Cuadra", 8_000, description="'Cuadra'")
    wait_text(page, "$550.00", 8_000, description="'$550.00' con el conteo")
    check(
        "corte cuadra",
        True,
        "conteo por denominaciones" if counted_by_denomination else "total contado",
    )
    try:
        click_named(
            page,
            [r"^Ocultar conteo por billetes y monedas$"],
            timeout=3_000,
            description="ocultar el conteo",
        )
    except DemoFailure:
        pass
    stage_shot(page, "07", anchor="El efectivo cuadra con lo esperado.")
    caption(page, "9. Corte: base $500 + $50 en efectivo = $550. Cuadra.")
    hold(page, 16.0)

    click_named(
        page,
        [r"^Guardar corte$", r"^Guardar corrección$"],
        description="Guardar corte",
    )
    confirm_dialog = wait_dialog(page, timeout=5_000, required=False)
    if confirm_dialog is not None:
        try:
            wait_text(page, "$550.00", 5_000, description="$550.00 en la confirmación")
        except DemoFailure:
            pass
        click_named(
            page,
            [r"^Guardar corte$", r"^Guardar corrección$"],
            scope=last_dialog(page),
            description="confirmar Guardar corte",
        )
    wait_regex(page, r"Corte #\d+ guardado", 20_000, description="Corte guardado")
    check("corte guardado", True, "Corte #1 guardado")
    caption(page, "Corte #1: la foto no cambia con ventas o cobros posteriores.")
    hold(page, 8.0)

    # Mi negocio: hoy, semana y mes.
    try:
        page.get_by_text("Así va la caja", exact=False).first.evaluate(
            "el => el.scrollIntoView({ block: 'center', behavior: 'instant' })"
        )
        hold(page, 0.8)
    except Exception:
        pass
    caption(page, "10. Mi negocio: hoy, semana y mes, del mismo registro.")
    hold(page, 13.0)

    # Meta: $300 + $25 = $325.
    open_tab(page, "Meta")
    wait_text(page, "Mi camino", 15_000, description="Mi camino")
    caption(page, "11. Mi camino: aparta $25 para la sombrilla.")
    hold(page, 4.5)
    fill_named(
        page,
        [r"^¿Cuánto apartaste\?$", r"Cu[aá]nto apartaste"],
        "25",
        description="¿Cuánto apartaste?",
    )
    click_named(page, [r"^Apartar$"], description="Apartar")
    wait_text(page, "$325.00", 15_000, description="la meta en $325.00")
    check("meta avanza a $325", True, "$325.00 visible")
    hold(page, 2.8)
    stage_shot(page, "08", anchor="Apartado declarado")
    caption(page, "La meta avanza: $325 de $1,800. Un apartado declarado.")
    hold(page, 9.0)

    # Cierre.
    try:
        page.locator("footer").scroll_into_view_if_needed()
        hold(page, 0.8)
    except Exception:
        pass
    caption(page, "El mercado no necesita más apps. Necesita certeza.")
    hold(page, 13.0)
    card(page, "Mercado Cero", "Cobra hablando. El banco confirma.")
    hold(page, 4.0)
    # La tarjeta se queda hasta cerrar el contexto: el video termina en ella.
    reset_demo_quiet(page, tag="record-cleanup")


def main() -> int:
    try:
        require_base()
    except DemoFailure as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    ensure_dirs()
    for stale in (ERROR_PNG, ERROR_JSON, RECORD_MANIFEST):
        if stale.exists():
            stale.unlink()
    for old in VIDEO_DIR.glob("*.webm"):
        try:
            old.unlink()
        except OSError:
            pass

    checks: list[dict] = []
    console_errors: list[str] = []
    started = time.time()
    started_at = datetime.now(timezone.utc).isoformat()
    video_file: Path | None = None
    failure: Exception | None = None

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=os.environ.get("DEMO_HEADED") != "1"
            )
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                device_scale_factor=1,
                record_video_dir=str(VIDEO_DIR),
                record_video_size={"width": 1280, "height": 800},
                locale="es-MX",
                timezone_id="America/Mexico_City",
            )
            page = context.new_page()

            def on_console(message) -> None:
                if message.type != "error":
                    return
                location = message.location or {}
                url = location.get("url", "") if isinstance(location, dict) else ""
                text = message.text or ""
                print(f"  CONSOLA {text} @ {url}", file=sys.stderr)
                # Piper no está en el entorno aislado: /api/tts puede dar 503.
                if "/api/tts" in url and ("503" in text or "500" in text):
                    return
                if "favicon" in url.lower():
                    return
                console_errors.append(f"{text} @ {url}" if url else text)

            page.on("console", on_console)
            page.on("pageerror", lambda error: console_errors.append(str(error)))

            try:
                run(page, checks, console_errors)
            except Exception as exc:  # noqa: BLE001 - se reporta con contexto
                failure = exc
                try:
                    page.screenshot(path=str(ERROR_PNG), full_page=True)
                except Exception as shot_error:
                    print(
                        f"AVISO: no pude tomar screenshot de error: {shot_error}",
                        file=sys.stderr,
                    )
                raise
            finally:
                video_handle = page.video
                try:
                    context.close()
                finally:
                    browser.close()
                if video_handle is not None and failure is None:
                    try:
                        video_file = Path(video_handle.path())
                    except Exception:
                        video_file = None
    except Exception as exc:  # noqa: BLE001
        failure = failure or exc
        diagnostic = {
            "ok": False,
            "base": BASE,
            "error": repr(exc),
            "checks": checks,
            "consoleErrors": console_errors,
            "screenshot": display_path(ERROR_PNG) if ERROR_PNG.exists() else None,
            "finishedAt": datetime.now(timezone.utc).isoformat(),
            "durationSeconds": round(time.time() - started, 1),
        }
        write_json(ERROR_JSON, diagnostic)
        print(f"\nERROR: no se pudo grabar la demo: {exc}", file=sys.stderr)
        if ERROR_PNG.exists():
            print(f"  screenshot: {display_path(ERROR_PNG)}", file=sys.stderr)
        print(f"  diagnóstico: {display_path(ERROR_JSON)}", file=sys.stderr)
        return 1

    # Playwright suele dejar el WebM con nombre aleatorio; usa page.video y
    # cae al más reciente solo si el handle no dio ruta.
    if video_file is None or not video_file.exists():
        videos = sorted(
            VIDEO_DIR.glob("*.webm"), key=lambda item: item.stat().st_mtime
        )
        if not videos:
            message = "No encontré el WebM de Playwright."
            write_json(
                ERROR_JSON,
                {
                    "ok": False,
                    "base": BASE,
                    "error": message,
                    "checks": checks,
                    "consoleErrors": console_errors,
                    "finishedAt": datetime.now(timezone.utc).isoformat(),
                },
            )
            print(f"ERROR: {message}", file=sys.stderr)
            return 1
        video_file = videos[-1]

    try:
        transcode(video_file, MP4)
    except Exception as exc:  # noqa: BLE001
        write_json(
            ERROR_JSON,
            {
                "ok": False,
                "base": BASE,
                "error": repr(exc),
                "checks": checks,
                "consoleErrors": console_errors,
                "webm": display_path(video_file),
                "finishedAt": datetime.now(timezone.utc).isoformat(),
            },
        )
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    try:
        video = probe_video(MP4)
    except Exception as exc:  # noqa: BLE001
        write_json(
            ERROR_JSON,
            {
                "ok": False,
                "base": BASE,
                "error": repr(exc),
                "checks": checks,
                "consoleErrors": console_errors,
                "mp4": display_path(MP4),
                "finishedAt": datetime.now(timezone.utc).isoformat(),
            },
        )
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if video["durationSeconds"] < 150 or (video["width"], video["height"]) != (1280, 800):
        message = (
            f"El MP4 salió con {video['durationSeconds']:.1f} s y "
            f"{video['width']}x{video['height']}; se esperaban >=150 s y 1280x800. "
            "No se escribe el manifiesto como final."
        )
        write_json(
            ERROR_JSON,
            {
                "ok": False,
                "base": BASE,
                "error": message,
                "checks": checks,
                "consoleErrors": console_errors,
                "mp4": display_path(MP4),
                "video": video,
                "finishedAt": datetime.now(timezone.utc).isoformat(),
            },
        )
        print(f"ERROR: {message}", file=sys.stderr)
        return 1

    try:
        video_file.unlink()
    except OSError:
        pass

    elapsed = time.time() - started
    manifest = {
        "ok": True,
        "base": BASE,
        "startedAt": started_at,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "durationSeconds": round(elapsed, 1),
        "mp4": display_path(MP4),
        "mp4Bytes": video["bytes"],
        "mp4Sha256": video["sha256"],
        "video": {
            "durationSeconds": video["durationSeconds"],
            "codec": video["codec"],
            "width": video["width"],
            "height": video["height"],
            "frameRate": video["frameRate"],
        },
        "stageshow": display_path(STAGESHOW),
        "frames": {
            slug: display_path(STAGESHOW / filename)
            for slug, filename in STAGE_FRAMES.items()
        },
        "checks": checks,
        "consoleErrors": console_errors,
        "allPassed": all(item["ok"] for item in checks),
    }
    write_json(RECORD_MANIFEST, manifest)

    print(
        f"\nMP4 {display_path(MP4)} · {video['durationSeconds']:.1f} s · "
        f"{video['bytes'] / 1024 / 1024:.1f} MB · "
        f"{video['width']}x{video['height']} {video['codec']}"
    )
    print(f"FRAMES {display_path(STAGESHOW)} ({len(STAGE_FRAMES)} beats)")
    if console_errors:
        print(
            f"AVISO: {len(console_errors)} error(es) de consola no bloqueantes.",
            file=sys.stderr,
        )
    print(f"MANIFEST {display_path(RECORD_MANIFEST)}")
    print(f"GRABACION OK · {elapsed:.1f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
