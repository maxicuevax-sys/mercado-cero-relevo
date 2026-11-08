"""Local Caja/voice regression: denied storage and microphone, actual local parse."""
import os
import re
from playwright.sync_api import sync_playwright, expect

origin = os.environ.get('BASE_URL', 'http://127.0.0.1:4677').rstrip('/')
with sync_playwright() as p:
    for engine in [p.chromium, p.webkit]:
        browser = engine.launch()
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        errors = []
        order_mutations = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: order_mutations.append(r.url) if r.method == 'POST' and '/api/orders' in r.url else None)
        page.add_init_script("""Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}});
          Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{throw new DOMException('Denied','NotAllowedError')}}});""")
        page.goto(origin + '/caja')
        field = page.locator('#mc-sale-voice-text')
        expect(field).to_be_editable(timeout=5000)
        field.fill('1 kilo de jitomate a 30 pesos')
        page.get_by_role('button', name='Interpretar', exact=True).click()
        expect(page.get_by_role('heading', name='Revisa lo que entendí', exact=True)).to_be_visible()
        expect(page.get_by_text('1 × Kilo de jitomate', exact=True)).to_be_visible()
        page.get_by_role('button', name='Dictar venta', exact=True).click()
        expect(page.locator('#mc-sale-voice-error')).to_contain_text(re.compile('permiso|no permite grabar audio'))
        assert not errors, errors
        assert not order_mutations, order_mutations
        print(f'PASS {engine.name}: denied storage does not block Caja, real local interpretation, denied microphone explained, zero order mutations')
        browser.close()
