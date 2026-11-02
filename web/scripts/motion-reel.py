#!/usr/bin/env python3
"""Reel corto de las transiciones ASLI: tabs + hoja.

Uso (servidor ya levantado):
  python scripts/motion-reel.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://localhost:3000"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "demo" / "stageshow"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="mercado-cero-reel-") as tmp:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                locale="es-MX",
                record_video_dir=tmp,
                record_video_size={"width": 1280, "height": 800},
            )
            page = context.new_page()
            context.request.post(f"{BASE}/api/demo/reset")
            page.goto(BASE, wait_until="networkidle", timeout=60000)
            page.wait_for_function("() => document.body.innerText.includes('Hoy $')", timeout=20000)
            page.wait_for_timeout(500)

            for label in ("Fiado", "Corte", "Meta", "Caja"):
                page.locator("aside button:visible", has_text=label).first.click()
                page.wait_for_timeout(480)

            page.get_by_role("button", name="Verificar comprobante", exact=True).first.click()
            page.wait_for_selector("[role=dialog]", timeout=8000)
            page.wait_for_timeout(450)
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)

            video = page.video
            context.close()
            browser.close()
            source = Path(video.path()) if video else None
            if not source or not source.exists():
                raise RuntimeError("No se grabó el video.")
            target = OUT / "tab-wipe.webm"
            shutil.copyfile(source, target)
            print(f"WEBM {target}")

    mp4 = OUT / "tab-wipe.mp4"
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-v",
                "error",
                "-i",
                str(OUT / "tab-wipe.webm"),
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
        print(f"MP4  {mp4}")
    else:
        print("ffmpeg no disponible; queda el WebM.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
