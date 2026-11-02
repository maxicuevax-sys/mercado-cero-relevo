"""
Film check estilo Stageshow para la interfaz real de Mercado Cero.

Captura los momentos que cuentan la historia (no una maqueta): caja en reposo,
venta dictada, cobro pendiente, link/QR, pago simulado, anti-fraude, corte y meta.
Graba el flujo de venta y arma una hoja de contactos para revisar encuadre,
jerarquía y movimiento.

Uso:
  python scripts/film-check.py

Requiere el servidor en http://localhost:3000 y ffmpeg en PATH para el MP4.
No imprime secretos.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import Page, sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.environ.get("BASE_URL", "http://localhost:3000")
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "demo" / "stageshow"
VIDEO_DIR = OUT / "video"
WIDTH, HEIGHT = 1280, 800

FRAMES: list[tuple[str, str, str]] = [
    ("01", "Caja en reposo", "Voz primero, jerarquía clara y un solo foco."),
    ("02", "Venta dictada", "El pedido aparece con su total y la confirmación a la vista."),
    ("03", "Cobro pendiente", "Un solo cobro, estado pendiente explícito."),
    ("04", "QR y demo", "El QR queda a la vista y la simulación se hace arriba."),
    ("05", "Pago simulado", "El resultado se lee de un vistazo y distingue demo."),
    ("06", "Comprobante falso", "La caja rechaza sin ambigüedad."),
    ("07", "Corte", "El conteo se compara con lo esperado."),
    ("08", "Meta", "El avance tiene causa y se queda en pantalla."),
]


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts") / name,
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def reset(page: Page) -> None:
    page.context.request.post(f"{BASE}/api/demo/reset")
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector("h1:has-text('Caja')", timeout=15000)
    page.wait_for_function("document.body.innerText.includes('Hoy $')", timeout=20000)
    page.wait_for_timeout(500)


def shot(page: Page, slug: str, title: str, note: str, anchor: str | None = None) -> None:
    page.wait_for_timeout(450)
    if anchor:
        # Sin esto el frame corta el texto a media frase: el viewport mide 800 px
        # y el contenido de Corte/Meta es más alto. Desplazamos lo justo para que
        # el ancla quede dentro del cuadro.
        page.locator(f"text={anchor}").first.scroll_into_view_if_needed()
        page.wait_for_timeout(250)
    page.screenshot(path=str(OUT / f"{slug}-{title.lower().replace(' ', '-')}.png"))
    print(f"  {slug} {title}: {page.evaluate('window.scrollY')} px")


def capture_flow(page: Page) -> None:
    reset(page)
    shot(page, "01", "Caja en reposo", FRAMES[0][2])

    page.get_by_role(
        "button", name="Dos quesadillas de 35 y un agua de 20"
    ).click()
    page.wait_for_selector("text=2 productos", timeout=15000)
    page.wait_for_selector("text=Escuché $90.00. ¿Confirmas?", timeout=8000)
    shot(page, "02", "Venta dictada", FRAMES[1][2])

    page.get_by_role("button", name="Confirmar venta").click()
    page.wait_for_selector("text=Link de pago", timeout=15000)
    shot(page, "03", "Cobro pendiente", FRAMES[2][2])

    page.get_by_role("button", name="Link de pago").click()
    page.wait_for_selector("text=Simular CoDi", timeout=15000)
    shot(page, "04", "Link y QR", FRAMES[3][2])

    page.get_by_role("button", name="Simular CoDi").click()
    page.wait_for_selector("[role=dialog] p:has-text('Pago simulado')", timeout=15000)
    shot(page, "05", "Pago simulado", FRAMES[4][2])
    page.wait_for_timeout(800)


def capture_verify(page: Page) -> None:
    reset(page)
    page.get_by_role("button", name="Verificar comprobante", exact=True).click()
    page.wait_for_selector("text=Probar con un comprobante falso", timeout=10000)
    page.get_by_role("button", name="Probar con un comprobante falso").click()
    page.wait_for_selector("text=No verificado", timeout=10000)
    shot(page, "06", "Comprobante falso", FRAMES[5][2])


def capture_corte(page: Page) -> None:
    reset(page)
    page.get_by_role("button", name="Corte", exact=True).first.click()
    page.wait_for_selector("text=Corte de caja", timeout=10000)
    total = page.get_by_label("Total contado en pesos")
    total.wait_for(state="visible", timeout=10000)
    page.wait_for_timeout(600)
    cash = page.context.request.get(f"{BASE}/api/cash").json()
    total.fill(f"{cash['expectedCents'] / 100:.2f}")
    page.wait_for_selector("text=El efectivo cuadra con lo esperado.", timeout=5000)
    page.evaluate("document.activeElement instanceof HTMLElement && document.activeElement.blur()")
    page.wait_for_timeout(150)
    shot(page, "07", "Corte", FRAMES[6][2])


def capture_meta(page: Page) -> None:
    reset(page)
    page.get_by_role("button", name="Meta", exact=True).first.click()
    page.wait_for_selector("text=Mi camino", timeout=10000)
    # La foto del mercado empuja la tarjeta fuera del viewport de 800 px y el
    # descargo legal quedaba cortado a media frase. Anclamos en el descargo.
    shot(page, "08", "Meta", FRAMES[7][2], anchor="Apartado declarado")


def contact_sheet(images: dict[str, Path]) -> Path:
    columns = 2
    cell_w, cell_h = 600, 375
    label_h = 46
    gap = 22
    header_h = 104
    margin = 24

    rows = (len(FRAMES) + columns - 1) // columns
    width = columns * cell_w + (columns + 1) * margin
    height = header_h + rows * (cell_h + label_h) + (rows - 1) * gap + margin
    sheet = Image.new("RGB", (width, height), "#F3EEE5")
    draw = ImageDraw.Draw(sheet)

    serif = font("georgia.ttf", 30)
    sans_bold = font("segoeui.ttf", 16)
    sans = font("segoeui.ttf", 12)
    accent = "#0B5A43"
    ink = "#1B241F"
    muted = "#5F6B63"

    draw.text((margin, 28), "Mercado Cero · film check", font=serif, fill=ink)
    draw.text(
        (margin, 68),
        "1280 × 800 · flujo real · 1 de noviembre de 2026",
        font=sans,
        fill=muted,
    )
    draw.line(
        [(margin, header_h - 14), (width - margin, header_h - 14)],
        fill="#D9D2C5",
        width=1,
    )

    for index, (slug, title, note) in enumerate(FRAMES):
        row, column = divmod(index, columns)
        x = margin + column * (cell_w + margin)
        y = header_h + row * (cell_h + label_h + gap)
        image = Image.open(images[slug]).convert("RGB").resize((cell_w, cell_h))
        sheet.paste(image, (x, y))
        draw.rectangle([x, y, x + cell_w, y + cell_h], outline="#D9D2C5", width=1)
        draw.text((x, y + cell_h + 9), f"{slug}  {title}", font=sans_bold, fill=ink)
        draw.text((x, y + cell_h + 29), note, font=sans, fill=muted)
        draw.rectangle(
            [x, y, x + 4, y + cell_h],
            fill=accent,
        )

    destination = OUT / "contact-sheet-1280.png"
    sheet.save(destination)
    return destination


def motion_sheet() -> Path | None:
    video = OUT / "flow-1280.mp4"
    if not video.exists() or not shutil.which("ffmpeg"):
        return None
    frames_dir = OUT / "motion"
    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    frames_dir.mkdir(parents=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-ss",
            "0.5",
            "-i",
            str(video),
            "-vf",
            "fps=2",
            str(frames_dir / "frame-%02d.png"),
        ],
        check=False,
    )
    frames = sorted(frames_dir.glob("frame-*.png"))[:8]
    if not frames:
        return None

    cell_w, cell_h = 400, 250
    gap, margin, columns = 12, 20, 4
    rows = (len(frames) + columns - 1) // columns
    width = margin * 2 + columns * cell_w + (columns - 1) * gap
    height = 74 + rows * (cell_h + 26) + (rows - 1) * gap + margin
    sheet = Image.new("RGB", (width, height), "#F3EEE5")
    draw = ImageDraw.Draw(sheet)
    draw.text((margin, 18), "Mercado Cero · motion check", font=font("georgia.ttf", 24), fill="#1B241F")
    draw.text(
        (margin, 48),
        "Flujo de venta · 1280 × 800 · cada cuadro ≈ 0.5 s",
        font=font("segoeui.ttf", 12),
        fill="#5F6B63",
    )
    for index, frame in enumerate(frames):
        row, column = divmod(index, columns)
        x = margin + column * (cell_w + gap)
        y = 74 + row * (cell_h + 26 + gap)
        image = Image.open(frame).convert("RGB").resize((cell_w, cell_h))
        sheet.paste(image, (x, y))
        draw.rectangle([x, y, x + cell_w, y + cell_h], outline="#D9D2C5", width=1)
        draw.text(
            (x, y + cell_h + 5),
            f"{(index * 0.5) + 0.5:.1f}s",
            font=font("segoeui.ttf", 14),
            fill="#1B241F",
        )
    destination = OUT / "motion-sheet.png"
    sheet.save(destination)
    return destination


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    for old in VIDEO_DIR.glob("*.webm"):
        old.unlink()

    started = time.time()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            device_scale_factor=1,
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": WIDTH, "height": HEIGHT},
            locale="es-MX",
        )
        page = context.new_page()
        capture_flow(page)
        context.close()
        browser.close()

        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            device_scale_factor=1,
            locale="es-MX",
        )
        page = context.new_page()
        capture_verify(page)
        capture_corte(page)
        capture_meta(page)
        context.close()
        browser.close()

    target = OUT / "flow-1280.webm"
    time.sleep(1)
    videos = sorted(VIDEO_DIR.glob("*.webm"), key=lambda path: path.stat().st_mtime)
    if videos:
        source = videos[-1]
        moved = False
        for _attempt in range(20):
            try:
                if target.exists():
                    target.unlink()
                shutil.move(str(source), str(target))
                moved = True
                break
            except PermissionError:
                time.sleep(0.5)
        if moved:
            print(f"VIDEO {target}")
            if shutil.which("ffmpeg"):
                subprocess.run(
                    [
                        "ffmpeg",
                        "-y",
                        "-loglevel",
                        "error",
                        "-i",
                        str(target),
                        "-c:v",
                        "libx264",
                        "-pix_fmt",
                        "yuv420p",
                        "-crf",
                        "23",
                        str(OUT / "flow-1280.mp4"),
                    ],
                    check=False,
                )
        else:
            print(f"AVISO: no pude mover el video; queda en {source}")

    images = {
        slug: next(OUT.glob(f"{slug}-*.png"))
        for slug, _title, _note in FRAMES
    }
    sheet = contact_sheet(images)
    motion = motion_sheet()
    elapsed = time.time() - started
    (OUT / "film-check.json").write_text(
        json.dumps(
            {
                "base": BASE,
                "viewport": {"width": WIDTH, "height": HEIGHT},
                "frames": [
                    {"slug": slug, "title": title, "note": note}
                    for slug, title, note in FRAMES
                ],
                "contactSheet": sheet.relative_to(ROOT).as_posix(),
                "motionSheet": motion.relative_to(ROOT).as_posix() if motion else None,
                "video": (OUT / "flow-1280.webm").relative_to(ROOT).as_posix(),
                "elapsedSeconds": round(elapsed, 1),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"SHEET {sheet}")
    if motion:
        print(f"MOTION {motion}")
    print(f"LISTO {elapsed:.1f} s")


if __name__ == "__main__":
    sys.exit(main())
