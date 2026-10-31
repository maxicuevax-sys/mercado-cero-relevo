"""Convierte demo/qr-demo.html en demo/qr-demo.pdf para imprimir."""

from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "demo" / "qr-demo.html"
PDF = ROOT / "demo" / "qr-demo.pdf"

if not HTML.exists():
    raise SystemExit("Falta demo/qr-demo.html. Corre: node scripts/make-demo-qr.mjs")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(HTML.as_uri(), wait_until="load")
    page.pdf(
        path=str(PDF),
        format="A4",
        print_background=True,
        margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
    )
    browser.close()

print(f"PDF: {PDF}")
