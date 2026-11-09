"""Real routes on an isolated local demo; 200% root-text emulation, not physical Safari."""
import argparse
import json
import os
import re
import subprocess
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--phase', choices=['before', 'stress-before', 'after'], default='after')
parser.add_argument('--require-clean', action='store_true')
parser.add_argument('--guest-canary', action='store_true', help='Private fresh guest per context; loopback4599 only, never reset.')
args = parser.parse_args()
origin = os.environ.get('BASE_URL', 'http://127.0.0.1:4688').rstrip('/')
if origin != ('http://127.0.0.1:4599' if args.guest_canary else 'http://127.0.0.1:4688'):
    raise SystemExit('This test only mutates the isolated local demo on4688.')
out = Path('test-results/a11y200')
out.mkdir(parents=True, exist_ok=True)
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
dirty = bool(subprocess.check_output(['git', 'status', '--porcelain=v1', '--untracked-files=all'], text=True).strip())
with urllib.request.urlopen(origin + '/api/health') as response:
    health = json.load(response)
if args.require_clean:
    assert not dirty, 'Commit the complete source before exact-SHA evidence.'
    assert health['buildSha'] == sha, 'Server must be built from this exact commit.'
(out / f'identity-{args.phase}.json').write_text(json.dumps({'sha':sha,'dirty':dirty,'health':health},indent=2))
results = []
baseline_file = out / 'results-stress-before.json'
baseline = json.loads(baseline_file.read_text(encoding='utf-8')) if args.phase == 'after' and baseline_file.exists() and not args.guest_canary else []
axe = Path('node_modules/axe-core/axe.min.js').read_text(encoding='utf-8')
with sync_playwright() as p:
    for engine in ['chromium', 'webkit']:
        browser = getattr(p, engine).launch()
        for width, height, enlarged in [(320, 569, False), (390, 844, False), (1448, 1086, False), (320, 569, True)]:
            context = browser.new_context(viewport={'width': width, 'height': height})
            if args.guest_canary:
                response = context.request.post(origin + '/api/access/guest', headers={'Origin': origin}, data={})
                assert response.status == 200, response.text()
                response = context.request.put(origin + '/api/business-profile', headers={'Origin': origin}, data={'businessType':'general'})
                assert response.status == 200, response.text()
            if not args.guest_canary and width == 320 and not enlarged:
                response = context.request.post(origin + '/api/demo/reset', headers={'Origin': origin}, data={})
                assert response.status == 200, response.text()
            if enlarged:
                # Normal geometry uses seed amounts. Stress uses a real isolated
                # fiado at the API maximum, never mocked product responses.
                response = context.request.get(origin + '/api/dashboard')
                assert response.status == 200, response.text()
                before = response.json()
                fixture_before = {'salesCents': before['summary']['salesCents'], 'creditsBalanceCents': before['creditsBalanceCents']}
                expected_fiado = f"${(fixture_before['creditsBalanceCents'] + 100000000) // 100:,}.{(fixture_before['creditsBalanceCents'] + 100000000) % 100:02d}"
                expected_sales = f"${(fixture_before['salesCents'] + 100000000) // 100:,}.{(fixture_before['salesCents'] + 100000000) % 100:02d}"
                response = context.request.post(origin + '/api/orders', headers={'Origin': origin}, data={
                    'items': [{'description': 'QA accessibility fixture', 'quantity': 10, 'unitPriceCents': 10000000}],
                    'creditCents': 100000000, 'customerName': 'Cliente de prueba accesibilidad',
                    'requestId': 'accessibility-million-fiado',
                })
                assert response.status in [200, 201], response.text()
            page = context.new_page()
            for route in ['fiados', 'corte', 'metas']:
                page.goto(origin + '/' + route)
                page.evaluate('document.fonts.ready')
                page.wait_for_function('''() => [...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).every(i=>i.complete)''')
                if enlarged:
                    page.evaluate("document.documentElement.dataset.textSize='xlarge';document.documentElement.dataset.contrast='high'")
                    page.add_style_tag(content='html{font-size:32px!important}')
                measurements = page.evaluate('''() => {
                  const box=e=>e?.getBoundingClientRect().toJSON();
                  const lines=e=>{if(!e)return [];const r=document.createRange();r.selectNodeContents(e);return [...r.getClientRects()].map(x=>({top:x.top,bottom:x.bottom,left:x.left,right:x.right}));};
                  const total=document.querySelector('.mc-fiados-mobile__total p:last-child');
                  const title=document.querySelector('#corte-title');
                  const saved=document.querySelector('.mc-metas-native-summary strong');
                  const hero=document.querySelector('.mc-corte-v2-hero');
                  const heroAmount=hero?.querySelector('.tabular-nums');
                  const summaryValues=[...document.querySelectorAll('.mc-corte-v2-summary dd')];
                  return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,font:getComputedStyle(document.documentElement).fontSize,
                    header:box(document.querySelector('.mc-fiados-mobile__brandbar')),merchant:box(document.querySelector('.mc-fiados-mobile__merchant > div')),
                    fiadoAmount:box(total),fiadoLines:lines(total),fiadoText:total?.querySelector('output')?.textContent,
                    fiadoAria:total?.querySelector('output')?.getAttribute('aria-label'),fiadoFont:total&&getComputedStyle(total).fontSize,
                    corteTitle:box(title),corteLines:lines(title),corteHeader:box(document.querySelector('.mc-corte-page > .mc-op-header')),
                    corteHero:box(hero),corteAmount:box(heroAmount),corteAmountLines:lines(heroAmount),corteAmountText:heroAmount?.querySelector('output')?.textContent,
                    corteAmountAria:heroAmount?.querySelector('output')?.getAttribute('aria-label'),
                    corteSummary:summaryValues.map(e=>({text:e.textContent,lines:lines(e),card:box(e.closest('.mc-corte-v2-card'))})),
                    metasAmount:box(saved),metasLines:lines(saved),groups:[...document.querySelectorAll('[data-currency-group]')].map(e=>({text:e.textContent,rect:box(e),font:getComputedStyle(e).fontSize}))};
                }''')
                errors = []
                if measurements['scroll'] > width + 1: errors.append('document overflow')
                if enlarged:
                    if route == 'fiados':
                        if measurements['merchant']['right'] > width + 1: errors.append('merchant leaves viewport')
                        if any(x['right'] > width + 1 for x in measurements['fiadoLines']): errors.append('currency leaves viewport')
                        if any(x['right'] > measurements['fiadoAmount']['right'] + 1 for x in measurements['fiadoLines']): errors.append('currency clipped inside card')
                        if not measurements['fiadoAria'] or 'MXN' not in measurements['fiadoAria']: errors.append('currency accessible name missing')
                        if not re.fullmatch(r'\$[\d,]+\.\d{2}', measurements['fiadoText'].strip()): errors.append('currency lost decimal precision')
                        if measurements['fiadoText'].strip() != expected_fiado: errors.append('fixture cents changed')
                    if route == 'corte':
                        if any(x['right'] > width + 1 for x in measurements['corteLines']): errors.append('title clipped horizontally')
                        if measurements['corteTitle']['bottom'] > measurements['corteHeader']['bottom'] + 1: errors.append('title leaves header vertically')
                        if any(x['right'] > measurements['corteHero']['right'] + 1 for x in measurements['corteAmountLines']): errors.append('hero currency clipped')
                        if not re.fullmatch(r'\$[\d,]+\.\d{2}', measurements['corteAmountText'].strip()): errors.append('hero lost decimal precision')
                        if not measurements['corteAmountAria'] or 'MXN' not in measurements['corteAmountAria']: errors.append('hero accessible currency missing')
                        if measurements['corteAmountText'].strip() != expected_sales: errors.append('hero fixture cents changed')
                        if any(line['right'] > item['card']['right'] + 1 for item in measurements['corteSummary'] for line in item['lines']): errors.append('summary currency clipped')
                if enlarged:
                    if any(g['rect']['right'] > width + 1 or g['rect']['left'] < -1 for g in measurements['groups']): errors.append('atomic currency group leaves viewport')
                    if route == 'metas' and any(x['right'] > width + 1 for x in measurements['metasLines']): errors.append('saved amount clipped')
                if not enlarged and baseline:
                    old = next(x for x in baseline if (x['route'],x['engine'],x['width'],x['enlarged']) == (route,engine,width,enlarged))
                    keys = {'fiados':['header','merchant','fiadoAmount'],'corte':['corteTitle','corteHeader'],'metas':['metasAmount']}[route]
                    for key in keys:
                        if any(abs(measurements[key][axis]-old['measurements'][key][axis])>1 for axis in ['x','y','width','height']): errors.append('normal geometry changed: '+key)
                violations = []
                if engine == 'chromium' and (enlarged or width == 390):
                    page.add_script_tag(content=axe)
                    violations = page.evaluate("async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))}")
                    if violations: errors.append('axe violations')
                suffix = f'{engine}-{width}-{"200hc" if enlarged else "normal"}-{args.phase}'
                page.screenshot(path=str(out / f'{route}-{suffix}.png'))
                if enlarged and route == 'corte':
                    page.locator('.mc-corte-v2-hero').evaluate("e=>e.scrollIntoView({block:'start'})")
                    page.locator('.mc-corte-v2-hero').screenshot(path=str(out / f'corte-hero-{suffix}.png'))
                    page.locator('.mc-corte-v2-card').first.screenshot(path=str(out / f'corte-summary-{suffix}.png'))
                row = {'route': route, 'engine': engine, 'width': width, 'enlarged': enlarged, 'fixture':'valid-million-fiado' if enlarged else 'seed','errors': errors, 'measurements': measurements, 'axeExecuted':engine=='chromium' and (enlarged or width==390),'axe':violations}
                results.append(row)
                if enlarged: row['fixtureBefore'] = fixture_before
                print(f'{"FAIL" if errors else "PASS"} {route} {suffix}: {errors}', flush=True)
            context.close()
        browser.close()
(out / f'results-{args.phase}.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
assert all(not row['errors'] for row in results), 'Text reflow contract failed'
