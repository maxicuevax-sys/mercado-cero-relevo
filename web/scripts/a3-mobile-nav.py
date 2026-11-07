"""A3 mobile navigation proof against an explicitly selected local candidate."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:4497')
OUT = Path(os.environ.get('A3_OUT', '../harness/evidence/exact-parity/a3-nav'))
OUT.mkdir(parents=True, exist_ok=True)
checks = []

def check(name, condition, detail=None):
    checks.append({'name': name, 'ok': bool(condition), 'detail': detail})
    print(('PASS ' if condition else 'FAIL ') + name, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    for width in [390, 320, 941]:
        page.set_viewport_size({'width': width, 'height': 844})
        for route in ['inicio', 'corte', 'metas', 'pendientes']:
            page.goto(f'{BASE}/{route}')
            nav = page.locator('.mc-mobile-nav')
            expect(nav).to_be_visible()
            fiados = nav.locator('a[href="/fiados"]')
            expect(fiados).to_be_visible()
            check(f'{width} {route}: real Fiados, no disabled placeholder',
                  fiados.count() == 1 and nav.locator('button:disabled').count() == 0)
            page.screenshot(path=str(OUT / f'after-{route}-{width}.png'), full_page=True)
            summary = nav.locator('summary')
            summary.focus()
            page.keyboard.press('Enter')
            expect(nav.locator('details')).to_have_attribute('open', '')
            page.keyboard.press('Tab')
            check(f'{width} {route}: keyboard enters Más', nav.locator('.mc-mobile-nav__panel a:focus').count() == 1)
            page.keyboard.press('Escape')
            check(f'{width} {route}: Escape closes and restores focus',
                  nav.locator('details[open]').count() == 0 and summary.evaluate('(el) => el === document.activeElement'))
            fiados.click()
            expect(page).to_have_url(f'{BASE}/fiados')
            expect(page.locator('#fiados-main')).to_be_focused()
            check(f'{width} {route}: Fiados reachable and main focused', True)
        page.screenshot(path=str(OUT / f'after-fiados-{width}.png'), full_page=True)
        selectors = (['.mc-fiados-mobile__bell', '.mc-fiados-mobile__heading a', '.mc-fiados-mobile__tabs a']
                     if width < 768 else ['.mc-parity-back', '.mc-fiados-tabs a', '.inicio-topbar__alerts'])
        for selector in selectors:
            for i, el in enumerate(page.locator(selector).all()):
                box = el.bounding_box()
                check(f'{width} Fiados target {selector}[{i}] >=48', box and box['width'] >= 48 and box['height'] >= 48, box)
        tabs = page.locator('.mc-fiados-mobile__tabs' if width < 768 else '.mc-fiados-tabs')
        tabs.get_by_role('link', name='Historial').click()
        expect(page).to_have_url(__import__('re').compile('view=history'))
        check(f'{width} Fiados Historial navigates', True)
        tabs.get_by_role('link', name='Saldos').click()
        expect(page).to_have_url(f'{BASE}/fiados')
        page.get_by_role('link', name='Volver a Inicio', exact=True).filter(visible=True).click()
        expect(page).to_have_url(f'{BASE}/inicio')
        check(f'{width} Fiados returns to Inicio', True)
        shortcuts = page.get_by_role('navigation', name='Accesos rápidos')
        check(f'{width} quick links are real', shortcuts.locator('a').count() == 4 and shortcuts.locator('button').count() == 0)
        for href in ['/caja#mc-caja-payment-summary', '/ventas', '/fiados', '/corte']:
            page.goto(f'{BASE}/inicio')
            page.locator(f'.inicio-shortcuts a[href="{href}"]').click()
            expect(page).to_have_url(f'{BASE}{href}')
            check(f'{width} quick link {href} navigates', True)
        for href in ['/corte', '/metas', '/pendientes', '/ayuda', '/ajustes']:
            page.goto(f'{BASE}/inicio')
            nav = page.locator('.mc-mobile-nav')
            nav.locator('summary').click()
            nav.locator(f'.mc-mobile-nav__panel a[href="{href}"]').click()
            expect(page).to_have_url(f'{BASE}{href}')
            check(f'{width} Más {href} navigates', True)
    browser.close()
(OUT / 'after.json').write_text(json.dumps({'baseUrl': BASE, 'browser': 'Chromium emulation', 'checks': checks, 'ok': all(c['ok'] for c in checks)}, indent=2), encoding='utf-8')
raise SystemExit(0 if all(c['ok'] for c in checks) else 1)
