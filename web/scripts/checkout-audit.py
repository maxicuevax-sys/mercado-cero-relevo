"""
Auditoría 360 px del checkout público y de la pantalla de éxito.

Uso:
  python scripts/checkout-audit.py

Requiere el servidor en http://localhost:3000.
No imprime secretos. Guarda capturas y un JSON en mercado-cero/demo/.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.environ.get(
    "CHECKOUT_BASE_URL",
    os.environ.get("BASE_URL", os.environ.get("P0_BASE_URL", "http://localhost:3000")),
).rstrip("/")
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


def measure(page) -> dict:
    return page.evaluate(
        """() => {
            const visible = (el) => {
                const r = el.getBoundingClientRect();
                const s = getComputedStyle(el);
                return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
            };
            const textBlocks = Array.from(document.querySelectorAll('p, span, button, a, label, h1, h2, h3, h4, dt, dd'))
                .filter(el => el.innerText && el.innerText.trim().length > 0 && visible(el))
                .map(el => ({
                    text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 70),
                    size: parseFloat(getComputedStyle(el).fontSize),
                    tag: el.tagName,
                }));
            const targets = Array.from(document.querySelectorAll('button, a, input, [role="button"]'))
                .filter(el => !(el.tagName === 'INPUT' && el.classList.contains('sr-only')))
                .filter(visible)
                .map(el => {
                    const r = el.getBoundingClientRect();
                    return {
                        text: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 45),
                        tag: el.tagName,
                        width: Math.round(r.width),
                        height: Math.round(r.height),
                    };
                });
            return {
                innerWidth: window.innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth,
                smallText: textBlocks.filter(item => item.size < 12).slice(0, 20),
                smallTextCount: textBlocks.filter(item => item.size < 12).length,
                smallTargets: targets.filter(item => item.width < 44 || item.height < 44).slice(0, 20),
                smallTargetCount: targets.filter(item => item.width < 44 || item.height < 44).length,
                methods: document.querySelectorAll('input[name="checkout-method"]').length,
            };
        }"""
    )


def post_json(path: str, payload: dict) -> tuple[int, dict]:
    """POST sin Playwright: la creación de la orden no depende del navegador."""
    request = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read() or b"{}")
        except Exception:
            return error.code, {}


def reset_demo() -> None:
    """Limpia el pedido de auditoría aunque falle la creación o el navegador."""
    try:
        request = urllib.request.Request(
            f"{BASE}/api/demo/reset",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            response.read()
    except Exception:
        # El servidor pudo caerse; no enmascarar el error original.
        pass


def run_audit() -> int:
    console_errors: list[str] = []
    page_errors: list[str] = []
    started = time.time()

    # El gate no depende del pedido semilla ni del reset: crea su propio
    # pedido de $120 y le adjunta un link, incluso si el reset está
    # bloqueado por pagos reales de otro gate. Se hace antes de abrir el
    # navegador para que un fallo de creación no deje nada a medias.
    request_id = f"checkout-audit-{time.time_ns()}"
    created_status, created = post_json(
        "/api/orders",
        {
            "items": [
                {
                    "description": "Pedido auditoría checkout",
                    "quantity": 1,
                    "unitPriceCents": 12000,
                }
            ],
            "paymentMethod": "codi",
            "requestId": request_id,
        },
    )
    if created_status >= 400 or "order" not in created:
        print(f"FAIL  no se pudo crear el pedido de auditoría — {created_status}")
        return 1
    order_id = created["order"]["id"]
    linked_status, _ = post_json(
        f"/api/orders/{order_id}/pay", {"mode": "link"}
    )
    if linked_status >= 400:
        print(f"FAIL  no se pudo crear el link de auditoría — {linked_status}")
        return 1
    checkout_url = f"{BASE}/pay/{order_id}"
    print(f"INFO  pedido 120.00 MXN · {order_id[:12]}…")

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

        # 1. Checkout.
        page.goto(checkout_url, wait_until="domcontentloaded")
        page.wait_for_selector("text=¿Cómo quieres pagar?", timeout=15000)
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "checkout-360-fold.png"))
        page.screenshot(path=str(OUT / "checkout-360-full.png"), full_page=True)

        metrics = measure(page)
        check(
            "Checkout: 360 px sin scroll horizontal",
            metrics["scrollWidth"] <= metrics["innerWidth"] + 1,
            f"scrollWidth={metrics['scrollWidth']} innerWidth={metrics['innerWidth']}",
        )
        check(
            "Checkout: sin texto visible menor a 12 px",
            metrics["smallTextCount"] == 0,
            f"{metrics['smallTextCount']} bloques: {metrics['smallText'][:5]}",
        )
        check(
            "Checkout: tres métodos de pago",
            metrics["methods"] == 3,
            f"{metrics['methods']} radios de método",
        )
        check(
            "Checkout: objetivos táctiles >= 44 px",
            metrics["smallTargetCount"] == 0,
            f"{metrics['smallTargetCount']} menores: {metrics['smallTargets'][:6]}",
        )

        # El CTA no puede quedar bajo el fold en escritorio. Se mide en un
        # contexto aparte para no cambiar el viewport de la auditoría 360.
        desktop = browser.new_context(
            viewport={"width": 1280, "height": 800}, locale="es-MX"
        )
        desktop_page = desktop.new_page()
        desktop_page.goto(checkout_url, wait_until="domcontentloaded")
        desktop_page.wait_for_selector("text=¿Cómo quieres pagar?", timeout=15000)
        desktop_page.wait_for_timeout(400)
        desktop_cta = desktop_page.evaluate(
            """() => {
                const button = [...document.querySelectorAll('button')]
                    .find((item) => (item.innerText || '').trim().startsWith('Pagar'));
                if (!button) return null;
                const rect = button.getBoundingClientRect();
                return {
                    top: Math.round(rect.top),
                    bottom: Math.round(rect.bottom),
                    visible: rect.top >= 0 && rect.bottom <= window.innerHeight,
                };
            }"""
        )
        desktop.close()
        check(
            "Checkout: total y CTA de pago en fold (360 y 1280)",
            wait_text(page, "$120.00", 5000)
            and bool(desktop_cta and desktop_cta["visible"]),
            f"CTA 1280: {desktop_cta}",
        )
        check("Checkout: aviso de demo visible", wait_text(page, "Modo demo", 5000))

        # 2. Pagar con CoDi en modo demo.
        page.get_by_role("button", name="Pagar $120.00").click()
        check(
            "Checkout: pago demo confirmado",
            wait_text(page, "Pago demo", 15000),
        )
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "checkout-360-pagado.png"))
        check(
            "Checkout: explica que el pago fue simulado",
            wait_text(page, "Pago demo", 5000),
        )

        paid_metrics = measure(page)
        check(
            "Confirmación: sin texto visible menor a 12 px",
            paid_metrics["smallTextCount"] == 0,
            f"{paid_metrics['smallTextCount']} bloques: {paid_metrics['smallText'][:5]}",
        )
        check(
            "Confirmación: sin scroll horizontal",
            paid_metrics["scrollWidth"] <= paid_metrics["innerWidth"] + 1,
            f"scrollWidth={paid_metrics['scrollWidth']}",
        )

        checkout_state = context.request.get(f"{BASE}/api/checkout/{order_id}").json()
        check(
            "Servidor: orden demo pagada tras la simulación",
            checkout_state["order"]["status"] in ("paid", "demo_paid")
            and checkout_state["payment"] is not None,
            f"{checkout_state['order']['status']} · pago={checkout_state['payment'] is not None}",
        )

        # 3. Pantalla de éxito alternativa.
        page.goto(f"{BASE}/pay/{order_id}/success", wait_until="domcontentloaded")
        page.wait_for_selector("h1:has-text('Pago demo')", timeout=15000)
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "checkout-360-success.png"))
        success_metrics = measure(page)
        check(
            "Éxito: sin texto visible menor a 12 px",
            success_metrics["smallTextCount"] == 0,
            f"{success_metrics['smallTextCount']} bloques: {success_metrics['smallText'][:5]}",
        )
        check(
            "Éxito: sin scroll horizontal",
            success_metrics["scrollWidth"] <= success_metrics["innerWidth"] + 1,
            f"scrollWidth={success_metrics['scrollWidth']}",
        )

        # 4. Success de un pedido inexistente: estado honesto, sin banco falso.
        console_before_missing = list(console_errors)
        page.goto(
            f"{BASE}/pay/ord_no_existe_qa/success",
            wait_until="domcontentloaded",
        )
        page.wait_for_selector("h1:has-text('No encontramos este cobro')", timeout=15000)
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "checkout-360-missing.png"))
        missing_body = page.locator("body").inner_text().lower()
        focused_missing = page.evaluate(
            """() => {
                const el = document.activeElement;
                return el ? `${el.tagName}:${(el.textContent || '').trim()}` : '';
            }"""
        )
        check(
            "Éxito 404: muestra 'No encontramos este cobro'",
            "no encontramos este cobro" in missing_body,
        )
        check(
            "Éxito 404: no inventa mensajes bancarios",
            not any(
                phrase in missing_body
                for phrase in (
                    "estamos confirmando con el banco",
                    "tu pago ya salió",
                    "confirmación firmada de pey",
                )
            ),
            missing_body[:160],
        )
        check(
            "Éxito 404: salida pública y foco en el estado",
            page.get_by_role("button", name="Cerrar esta pestaña").is_visible()
            and "NO ENCONTRAMOS" in focused_missing.upper(),
            focused_missing,
        )
        missing_console = console_errors[len(console_before_missing):]
        check(
            "Éxito 404: solo registra el 404 esperado en consola",
            all("404" in message for message in missing_console),
            "; ".join(missing_console[:3]),
        )

        elapsed = time.time() - started
        check("Checkout: sin errores de consola", len(console_before_missing) == 0, "; ".join(console_before_missing[:3]))
        check("Checkout: sin pageerrors", len(page_errors) == 0, "; ".join(page_errors[:3]))

        browser.close()

    report = {
        "viewport": "360x800",
        "elapsedSeconds": round(elapsed, 1),
        "checkout": metrics,
        "confirmation": paid_metrics,
        "success": success_metrics,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "checks": results,
        "passed": sum(1 for item in results if item["ok"]),
        "failed": sum(1 for item in results if not item["ok"]),
    }
    path = OUT / "checkout-audit.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("")
    print(f"{report['passed']}/{len(results)} checks en verde")
    print(f"Reporte: {path}")
    if report["failed"] == 0:
        print(f"CHECKOUT OK: {report['passed']}/{len(results)} checks")
        return 0
    return 1


def main() -> int:
    """Limpia la demo en finally, incluso si falla la creación de la orden."""
    try:
        return run_audit()
    finally:
        reset_demo()


if __name__ == "__main__":
    sys.exit(main())
