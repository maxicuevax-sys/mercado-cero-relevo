"""B scoped runtime evidence; starts a DEMO-only server and isolated SQLite.
Run from web/: python scripts/b-refs-ui.py
No browser route mocking and no real paid fixtures.
"""
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path.cwd().parent
OUT = ROOT / "harness/evidence/exact-parity/b-refs"
BASE = "http://127.0.0.1:4583"
RESULTS = []
def check(name, ok, detail=None):
    RESULTS.append(dict(name=name, ok=bool(ok), detail=detail))
    print(("PASS " if ok else "FAIL ") + name, flush=True)

def capture(page, name):
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
    page.screenshot(path=str(OUT / f"{name}-viewport.png"))
    overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth")
    detail = page.locator('body *').evaluate_all("""els => els.filter(e=>{const r=e.getBoundingClientRect(); return r.width && (r.right>innerWidth+1 || r.left < -1)}).slice(0,25).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,text:e.textContent.slice(0,80)}))""") if overflow else None
    check(name + " no horizontal overflow", not overflow, detail)
    if 'confirmed' in name:
        (OUT/(name+'-images.json')).write_text(json.dumps(page.locator('main img').evaluate_all("els=>els.map(e=>({src:e.currentSrc,complete:e.complete,natural:e.naturalWidth,rect:e.getBoundingClientRect().toJSON(),display:getComputedStyle(e).display}))")),encoding='utf8')

def large_capture(page, name):
    page.evaluate("document.documentElement.style.fontSize='32px'; document.documentElement.dataset.contrast='high'")
    capture(page, name+'-text200-HC')
    page.evaluate("document.documentElement.style.fontSize=''; document.documentElement.dataset.contrast='normal'")

def axe(page, name):
    page.add_script_tag(path=str(ROOT / "web/node_modules/axe-core/axe.min.js"))
    result = page.evaluate("""async () => (await axe.run(document.querySelector('main'), {runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v => ({id:v.id, impact:v.impact, nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))""")
    check(name + " axe main", len(result) == 0, result)

def inspect_targets(page, name):
    controls = page.locator('.mc-caja-line__price-toggle, .mc-caja-line__step, .mc-caja-line textarea').evaluate_all("""els => els.filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),name:e.getAttribute('aria-label'),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))""")
    check(name + " ticket targets >=24px", bool(controls) and all(c['width'] >= 24 and c['height'] >= 24 for c in controls), controls)
    check(name + " button names include visible label", all(not c['name'] or not c['text'] or c['text'] in c['name'] for c in controls))

probe = socket.socket()
probe.bind(('127.0.0.1', 4583))
probe.close()
env = dict(os.environ, DEMO_MODE="true", PEY_API_KEY="", APP_URL=BASE,
           DATABASE_PATH=str(OUT / "ui-demo.db"), DATABASE_BACKUP_DIR=str(OUT / "backups"), NEXT_TELEMETRY_DISABLED="1")
log = open(OUT / "ui-server.log", "w", encoding="utf8")
server = subprocess.Popen(['node', 'node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '4583'], env=env, stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
try:
    for _ in range(100):
        try:
            health = json.load(urllib.request.urlopen(BASE + '/api/health', timeout=2))
            break
        except Exception:
            if server.poll() is not None: raise RuntimeError('server exited; see ui-server.log')
            time.sleep(.4)
    else: raise RuntimeError('health timeout')
    check('build identity', health['buildSha'] == subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(), health)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in [390, 320]:
            page = browser.new_page(viewport={'width':width,'height':844 if width==390 else 693}, locale='es-MX')
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(BASE + '/caja')
            expect(page.locator('.mc-caja-line')).to_have_count(3)
            expect(page.locator('#mc-sale-voice-text')).to_be_enabled()
            capture(page, f'{width}-M02-caja')
            inspect_targets(page, f'{width}-M02')
            axe(page, f'{width}-M02')
            toggle = page.locator('.mc-caja-line__price-toggle').first
            toggle.click()
            expect(page.locator('.mc-caja-field--price-open input')).to_be_visible()
            page.locator('.mc-caja-field--price-open input').fill('35')
            toggle.click()
            plus = page.locator('.mc-caja-line__step').nth(1)
            plus.click()
            expect(page.locator('.mc-caja-field--qty input').first).to_have_value('3')
            page.locator('.mc-caja-line__step').first.click()
            expect(page.locator('.mc-caja-field--qty input').first).to_have_value('2')
            check(f'{width} price and quantity controls operate', True)
            page.locator('.mc-spec-register').click()
            expect(page.get_by_role('heading', name='Método de pago', exact=True)).to_be_visible()
            check(f'{width} M03 distinct view and focus', not page.locator('.mc-sale-voice').count() and page.locator('#caja-title').evaluate('el=>el===document.activeElement'))
            capture(page, f'{width}-M03-method')
            axe(page, f'{width}-M03')
            large_capture(page, f'{width}-M03')
            page.get_by_role('radio',name='Fiado',exact=True).check()
            capture(page, f'{width}-M03-credit')
            page.get_by_role('button',name='Continuar',exact=True).click()
            expect(page.get_by_label('Nombre del cliente',exact=True)).to_be_visible()
            check(f'{width} credit validates customer', page.get_by_role('button', name='Registrar venta', exact=True).is_disabled())
            page.get_by_role('radio',name='Efectivo',exact=True).check()
            page.get_by_role('button',name='Continuar',exact=True).click()
            page.get_by_role('button',name='Efectivo exacto',exact=True).click()
            expect(page.get_by_label('Efectivo recibido',exact=True)).to_have_value('140.00')
            capture(page, f'{width}-M03-cash-review')
            page.get_by_role('radio',name='Pago digital',exact=True).check()
            capture(page, f'{width}-M03-digital')
            page.get_by_role('button',name='Continuar',exact=True).click()
            page.get_by_role('button',name='Registrar venta',exact=True).click()
            expect(page.locator('.mc-caja-payment')).to_be_visible()
            page.get_by_role('button',name='Generar QR',exact=True).click()
            expect(page.locator('.mc-caja-qr img')).to_be_visible()
            capture(page, f'{width}-M04-qr')
            axe(page, f'{width}-M04')
            large_capture(page, f'{width}-M04')
            before = page.request.get(BASE+'/api/orders').json()['orders'][0]
            page.get_by_role('button',name='Confirmar pago · consultar estado',exact=True).click()
            expect(page.get_by_role('button',name='Confirmar pago · consultar estado',exact=True)).to_be_enabled()
            after = page.request.get(BASE+'/api/orders/'+before['id']).json()['order']
            check(f'{width} confirm only reads pending order', before['status']==after['status']=='payment_pending' and after['paidCents']==0, after)
            page.get_by_role('button',name='Escanear',exact=True).click()
            expect(page.get_by_text('Esta caja no valida capturas',exact=False)).to_be_visible()
            page.get_by_role('button',name='Escanear',exact=True).click()
            page.get_by_role('button',name='Simular CoDi',exact=True).click()
            expect(page.locator('.mc-caja-result')).to_be_visible()
            capture(page, f'{width}-M04-confirmed-DEMO')
            axe(page, f'{width}-M04-result')
            large_capture(page, f'{width}-M04-result')
            order = page.request.get(BASE+'/api/orders/'+before['id']).json()['order']
            check(f'{width} result stays demo_paid', order['status']=='demo_paid' and order['lastPaymentDemo'] is True)
            verified = page.request.get(BASE+'/api/verify',params={'orderId':order['id'],'transactionId':'demo_ui_probe'}).json()
            check(f'{width} demo verify false', verified.get('verified') is False, verified)
            page.goto(BASE+'/ayuda')
            capture(page, f'{width}-M09-help')
            axe(page, f'{width}-M09')
            page.get_by_role('searchbox',name='Buscar ayuda').fill('fiado')
            expect(page.locator('.mc-help-topics button')).to_have_count(1)
            page.get_by_role('button',name='Fiados',exact=True).click()
            expect(page.locator('.mc-help-answer')).to_contain_text('deuda')
            capture(page, f'{width}-M09-search')
            page.get_by_role('button',name='Ver todos',exact=True).click()
            page.get_by_role('switch',name='Asistente opcional').click()
            page.get_by_label('Escribe tu pregunta',exact=True).fill('corte')
            page.get_by_role('button',name='Consultar',exact=True).click()
            expect(page.locator('.mc-assistant-answer')).to_contain_text('no la ajusta sola')
            capture(page, f'{width}-M09-assistant')
            check(f'{width} help search and local assistant operate', True)
            page.goto(BASE+'/ajustes')
            capture(page, f'{width}-M10-settings')
            axe(page, f'{width}-M10')
            voice = page.get_by_role('switch',name='Asistente de voz',exact=True)
            voice.click()
            expect(voice).to_have_attribute('aria-checked','false')
            page.reload()
            expect(page.get_by_role('switch',name='Asistente de voz',exact=True)).to_have_attribute('aria-checked','false')
            page.get_by_role('button',name='Cerrar sesión',exact=True).click()
            expect(page.get_by_text('Este prototipo no tiene sesión local',exact=False)).to_be_visible()
            capture(page, f'{width}-M10-logout-limit')
            check(f'{width} voice persists and logout states limit', True)
            for route in ['caja','ayuda','ajustes']:
                page.goto(BASE+'/'+route)
                if route=='caja':
                    page.evaluate('localStorage.clear()')
                    page.reload()
                    expect(page.locator('.mc-caja-line')).to_have_count(3)
                page.evaluate("document.documentElement.style.fontSize='32px'; document.documentElement.dataset.contrast='high'")
                capture(page, f'{width}-{route}-text200-HC')
                if route=='caja': inspect_targets(page, f'{width}-M02-text200')
            check(f'{width} no browser pageerrors', not errors, errors)
            page.close()
        browser.close()
except Exception as error:
    check('runtime completed', False, str(error))
    raise
finally:
    server.terminate()
    server.wait(timeout=15)
    log.close()
    artifacts = [{"path": str(p.relative_to(ROOT)).replace('\\','/'), "sha256":hashlib.sha256(p.read_bytes()).hexdigest()} for p in OUT.glob('*.png')]
    report=dict(git=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(), results=RESULTS, artifacts=artifacts, passed=sum(r['ok'] for r in RESULTS), failed=sum(not r['ok'] for r in RESULTS))
    (OUT/'ui.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(f"B REFS UI: {report['passed']} PASS / {report['failed']} FAIL",flush=True)
    if report['failed']: raise SystemExit(1)
