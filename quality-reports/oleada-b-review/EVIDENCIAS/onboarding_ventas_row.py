#!/usr/bin/env python3
"""Extrae filas concretas de /ventas para evidencia de copy."""
from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
OUT = Path(__file__).resolve().parent


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1448, "height": 1086}, locale="es-MX")
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(300)
        rows = page.locator(".mc-ventas-row")
        found = {}
        for i in range(rows.count()):
            row = rows.nth(i)
            text = row.inner_text()
            for key in ["AEA7", "9E3D", "B02A", "B0F9"]:
                if key in text:
                    found[key] = text
                    row.screenshot(path=str(OUT / f"onboarding-ventas-fila-{key}.png"))
        (OUT / "onboarding-ventas-filas.txt").write_text(
            "\n\n=====\n\n".join(f"{k}\n{v}" for k, v in found.items()) + "\n",
            encoding="utf-8",
        )
        print(found)
        browser.close()


if __name__ == "__main__":
    main()
