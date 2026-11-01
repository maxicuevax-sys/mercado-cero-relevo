"""
Auditoría móvil 360 px + walkthrough del flujo de demo.

Uso:
  python scripts/mobile-audit.py

Requiere el servidor en http://localhost:3000.
No imprime secretos. Guarda capturas y un JSON en mercado-cero/demo/.
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://localhost:3000"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "demo"
OUT.mkdir(parents=True, exist_ok=True)

results: list[dict] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")


def wait_text(page, text: str, timeout: int = 12000) -> bool:
    try:
        page.wait_for_selector(f"text={text}", timeout=timeout)
        return True
    except Exception:
        return False


def horizontal_state(page) -> dict:
    return page.evaluate(
        """() => {
            const surface = document.querySelector('.grain');
            return {
                innerWidth: window.innerWidth,
                documentScrollWidth: document.documentElement.scrollWidth,
                surfaceScrollLeft: surface ? Math.round(surface.scrollLeft) : 0,
                surfaceScrollWidth: surface
                    ? surface.scrollWidth
                    : document.documentElement.scrollWidth,
            };
        }"""
    )


def no_horizontal_scroll(page) -> tuple[bool, str]:
    state = horizontal_state(page)
    ok = (
        state["documentScrollWidth"] <= state["innerWidth"] + 1
        and state["surfaceScrollWidth"] <= state["innerWidth"] + 1
        and state["surfaceScrollLeft"] == 0
    )
    return ok, json.dumps(state, ensure_ascii=False)


def main() -> int:
    console_errors: list[str] = []
    page_errors: list[str] = []
    started = time.time()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            locale="es-MX",
        )
        page = context.new_page()
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        # Estado limpio de demo.
        context.request.post(f"{BASE}/api/demo/reset")
        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_selector("h1:has-text('Caja')", timeout=15000)
        page.wait_for_function("document.body.innerText.includes('Hoy $')", timeout=20000)
        page.wait_for_timeout(500)

        # 1. Medidas de layout.
        page.screenshot(path=str(OUT / "mobile-360-fold.png"))
        page.screenshot(path=str(OUT / "mobile-360-full.png"), full_page=True)

        metrics = page.evaluate(
            """() => {
                const visible = (el) => {
                    const r = el.getBoundingClientRect();
                    const s = getComputedStyle(el);
                    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
                };
                const textBlocks = Array.from(document.querySelectorAll('p, span, button, a, label, h1, h2, h3, h4'))
                    .filter(el => el.innerText && el.innerText.trim().length > 0 && visible(el))
                    .map(el => ({
                        text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 70),
                        size: parseFloat(getComputedStyle(el).fontSize),
                        tag: el.tagName,
                    }));
                const targets = Array.from(document.querySelectorAll('button, a, input, [role="button"]'))
                    .filter(visible)
                    .map(el => {
                        const r = el.getBoundingClientRect();
                        return {
                            text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 45),
                            tag: el.tagName,
                            width: Math.round(r.width),
                            height: Math.round(r.height),
                        };
                    });
                return {
                    innerWidth: window.innerWidth,
                    scrollWidth: document.documentElement.scrollWidth,
                    bodyScrollWidth: document.body.scrollWidth,
                    smallText: textBlocks.filter(item => item.size < 12).slice(0, 12),
                    smallTextCount: textBlocks.filter(item => item.size < 12).length,
                    smallTargets: targets.filter(item => item.width < 44 || item.height < 44).slice(0, 20),
                    smallTargetCount: targets.filter(item => item.width < 44 || item.height < 44).length,
                    primaryTargets: targets.filter(item => /Confirmar venta|Link de pago|QR CoDi|Simular CoDi|Guardar corte|Apartar|Verificar|Caja|Fiado|Corte|Meta/.test(item.text)),
                };
            }"""
        )

        check(
            "360 px sin scroll horizontal",
            metrics["scrollWidth"] <= metrics["innerWidth"] + 1,
            f"scrollWidth={metrics['scrollWidth']} innerWidth={metrics['innerWidth']}",
        )
        check(
            "Sin texto visible menor a 12 px",
            metrics["smallTextCount"] == 0,
            f"{metrics['smallTextCount']} bloques: {metrics['smallText'][:3]}",
        )
        check(
            "Controles principales con altura >= 40 px",
            all(target["height"] >= 40 for target in metrics["primaryTargets"]),
            json.dumps(
                [t for t in metrics["primaryTargets"] if t["height"] < 40],
                ensure_ascii=False,
            ),
        )
        print(
            f"INFO  targets <44 px: {metrics['smallTargetCount']} (incluye enlaces de texto e inputs compactos)"
        )

        # 2. Walkthrough del flujo.
        check("Caja es el destino inicial", page.get_by_role("heading", name="Caja", exact=True).is_visible())
        page.get_by_role(
            "button", name="Dos quesadillas de 35 y un agua de 20"
        ).click()
        check("Venta por texto interpretada", wait_text(page, "2 productos", 12000))
        check("Total de la venta $90", wait_text(page, "$90.00", 12000))

        page.get_by_role("button", name="Confirmar venta").click()
        check("Pedido creado y cobro visible", wait_text(page, "Link de pago", 12000))
        page.wait_for_timeout(700)
        ok, detail = no_horizontal_scroll(page)
        check("Sin scroll horizontal al crear el cobro", ok, detail)
        page.screenshot(path=str(OUT / "mobile-360-cobro.png"))

        page.get_by_role("button", name=re.compile("Link de pago")).click()
        check("Link de pago generado", wait_text(page, "Simular CoDi", 15000))
        page.wait_for_timeout(600)
        ok, detail = no_horizontal_scroll(page)
        check("Sin scroll horizontal con el link generado", ok, detail)
        page.screenshot(path=str(OUT / "mobile-360-link.png"))

        page.get_by_role("button", name="Simular CoDi").click()
        check("Pago demo confirmado", wait_text(page, "Pago simulado", 12000))
        page.wait_for_timeout(600)
        ok, detail = no_horizontal_scroll(page)
        check("Sin scroll horizontal tras el pago", ok, detail)
        page.screenshot(path=str(OUT / "mobile-360-pagado.png"))
        page.get_by_role("button", name="Listo para entregar").click()
        page.wait_for_timeout(300)

        # 3. Fiado en efectivo y anti-fraude, también a 360 px.
        page.get_by_role("button", name="Juan me pagó 50 del fiado").click()
        check("Abono de fiado visible", wait_text(page, "Abono de", 12000))
        check("Saldo de Juan en cero", wait_text(page, "Saldo: $0.00", 12000))
        page.wait_for_timeout(500)
        ok, detail = no_horizontal_scroll(page)
        check("Sin scroll horizontal tras el abono", ok, detail)

        page.get_by_role("button", name="Verificar", exact=True).first.click()
        page.wait_for_selector("text=Verificar comprobante", timeout=12000)
        page.get_by_role("button", name="Probar con un comprobante falso").click()
        check("Comprobante falso rechazado", wait_text(page, "No verificado", 12000))
        page.wait_for_timeout(500)
        ok, detail = no_horizontal_scroll(page)
        check("Sin scroll horizontal en anti-fraude", ok, detail)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)

        page.get_by_role("button", name="Corte", exact=True).first.click()
        page.wait_for_timeout(600)
        check(
            "Corte visible",
            page.get_by_text("Corte de caja", exact=False).first.is_visible(),
            "pantalla Corte",
        )
        page.locator('button[title="Actualizar corte"]').click()
        check("Corte incluye el abono de fiado", wait_text(page, "$620.00", 12000))
        page.screenshot(path=str(OUT / "mobile-360-corte.png"))

        page.get_by_role("button", name="Meta", exact=True).first.click()
        page.wait_for_timeout(600)
        check("Meta visible", page.get_by_text("Mi camino", exact=False).first.is_visible(), "pantalla Meta")
        page.get_by_placeholder("¿Cuánto apartaste?").fill("25")
        page.get_by_role("button", name="Apartar", exact=True).click()
        check("Aportación actualiza la meta", wait_text(page, "$325.00", 12000))
        page.wait_for_timeout(500)
        ok, detail = no_horizontal_scroll(page)
        check("Sin scroll horizontal al final del recorrido", ok, detail)
        page.screenshot(path=str(OUT / "mobile-360-meta.png"))

        elapsed = time.time() - started
        check("Flujo completo en menos de 3 minutos", elapsed < 180, f"{elapsed:.1f}s")
        check("Sin errores de consola", len(console_errors) == 0, "; ".join(console_errors[:3]))
        check("Sin pageerrors", len(page_errors) == 0, "; ".join(page_errors[:3]))

        context.request.post(f"{BASE}/api/demo/reset")
        browser.close()

    report = {
        "viewport": "360x800",
        "elapsedSeconds": round(elapsed, 1),
        "metrics": metrics,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "checks": results,
        "passed": sum(1 for item in results if item["ok"]),
        "failed": sum(1 for item in results if not item["ok"]),
    }
    report_path = OUT / "mobile-audit.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("")
    print(f"{report['passed']}/{len(results)} checks en verde")
    print(f"Reporte: {report_path}")
    return 0 if report["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
