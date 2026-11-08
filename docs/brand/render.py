"""Export the HTML identity without repainting the supplied QR. Requires Playwright."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
with sync_playwright() as p:
    browser = p.chromium.launch()
    for piece, width, height, filename in [
        ('identity', 1200, 1340, 'trangui-identidad.png'),
        ('avatar', 1200, 1200, 'trangui-avatar.png'),
        ('social', 1280, 640, 'trangui-social.png'),
    ]:
        page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
        page.goto(ROOT.joinpath('identity.html').as_uri() + '?piece=' + piece)
        page.evaluate('document.fonts.ready')
        page.locator('img').first.wait_for(state='attached')
        page.evaluate('Promise.all([...document.images].map(i => i.decode()))')
        page.screenshot(path=str(ROOT / filename))
        page.close()
    browser.close()
