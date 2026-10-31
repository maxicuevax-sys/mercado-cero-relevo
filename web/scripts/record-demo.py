"""
Graba un respaldo silencioso de la demo (con subtítulos) y capturas.

Uso:
  python scripts/record-demo.py

Requiere el servidor en http://localhost:3000 y ffmpeg para convertir a MP4.
No imprime secretos. Guarda todo en mercado-cero/demo/.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://localhost:3000"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "demo"
VIDEO_DIR = OUT / "video"
OUT.mkdir(parents=True, exist_ok=True)
VIDEO_DIR.mkdir(parents=True, exist_ok=True)


def caption(page, text: str) -> None:
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


def card(page, title: str, subtitle: str) -> None:
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


def remove_card(page) -> None:
    page.evaluate("document.getElementById('demo-card')?.remove()")


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            device_scale_factor=1,
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": 1280, "height": 800},
            locale="es-MX",
        )
        page = context.new_page()
        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_selector("text=Cobra hablando", timeout=15000)
        page.wait_for_selector("text=Modo demo", timeout=15000)
        page.wait_for_timeout(500)

        context.request.post(f"{BASE}/api/demo/reset")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector("text=Modo demo", timeout=15000)
        page.wait_for_timeout(600)

        card(page, "Mercado Cero", "La caja que habla · demo de respaldo")
        page.screenshot(path=str(OUT / "demo-poster.png"))
        page.wait_for_timeout(1800)
        remove_card(page)

        caption(page, "1. La comerciante dicta la venta")
        page.wait_for_timeout(1800)
        page.get_by_role(
            "button", name="Dos quesadillas de 35 y un agua de 20"
        ).click()
        page.wait_for_selector("text=2 productos", timeout=12000)
        page.wait_for_timeout(600)
        caption(page, "2. La caja arma el pedido: $90")
        page.screenshot(path=str(OUT / "demo-step-1-venta.png"))
        page.wait_for_timeout(2200)

        page.get_by_role("button", name="Confirmar venta").click()
        page.wait_for_selector("text=Link de pago", timeout=12000)
        page.wait_for_timeout(350)
        caption(page, "3. Un solo cobro para el cliente")
        page.wait_for_timeout(2000)

        page.get_by_role("button", name=re.compile("Link de pago")).click()
        page.wait_for_selector("text=Simular CoDi", timeout=15000)
        caption(page, "4. Link/QR multi-método. Esperando al banco.")
        page.screenshot(path=str(OUT / "demo-step-2-cobro.png"))
        page.wait_for_timeout(2400)

        page.get_by_role("button", name="Simular CoDi").click()
        page.wait_for_selector("text=Pago simulado", timeout=12000)
        caption(page, "5. Solo el webhook firmado marca pagado (demo)")
        page.screenshot(path=str(OUT / "demo-step-3-pagado.png"))
        page.wait_for_timeout(2800)

        page.get_by_role("button", name="Listo para entregar").click()
        page.wait_for_timeout(500)
        page.locator("#corte").scroll_into_view_if_needed()
        page.wait_for_timeout(900)
        caption(page, "6. Mi negocio: hoy, semana y mes")
        page.screenshot(path=str(OUT / "demo-step-4-negocio.png"))
        page.wait_for_timeout(2600)

        page.locator("#meta").scroll_into_view_if_needed()
        page.wait_for_timeout(700)
        caption(page, "7. Mi camino: aparta para la sombrilla")
        page.wait_for_timeout(1300)
        page.get_by_placeholder("¿Cuánto apartaste?").fill("25")
        page.get_by_role("button", name="Apartar", exact=True).click()
        page.wait_for_selector("text=$325.00", timeout=12000)
        caption(page, "8. La meta avanza")
        page.screenshot(path=str(OUT / "demo-step-5-meta.png"))
        page.wait_for_timeout(2200)

        page.locator("text=El mercado no necesita más apps").scroll_into_view_if_needed()
        page.wait_for_timeout(900)
        caption(page, "El mercado no necesita más apps. Necesita certeza.")
        page.screenshot(path=str(OUT / "demo-step-6-cierre.png"))
        page.wait_for_timeout(2600)

        card(page, "Mercado Cero", "Cobra hablando. El banco confirma.")
        page.wait_for_timeout(1600)
        remove_card(page)

        context.request.post(f"{BASE}/api/demo/reset")
        context.close()
        browser.close()

    # Playwright deja un WebM con nombre aleatorio.
    videos = sorted(VIDEO_DIR.glob("*.webm"), key=lambda item: item.stat().st_mtime)
    if not videos:
        print("ERROR: no se encontró el video de Playwright")
        return 1
    source = videos[-1]
    webm = OUT / "mercado-cero-demo.webm"
    mp4 = OUT / "mercado-cero-demo.mp4"
    if webm.exists():
        webm.unlink()
    shutil.move(str(source), str(webm))

    print(f"WebM: {webm} ({webm.stat().st_size / 1024 / 1024:.1f} MB)")
    if shutil.which("ffmpeg"):
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                str(webm),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                str(mp4),
            ],
            check=True,
        )
        print(f"MP4: {mp4} ({mp4.stat().st_size / 1024 / 1024:.1f} MB)")
    else:
        print("ffmpeg no encontrado; queda el WebM.")

    print("Capturas en demo/ y guion en RUNBOOK-DEMO.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
