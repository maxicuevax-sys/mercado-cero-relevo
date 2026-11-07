import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
phase=os.environ.get('CAPTURE_PHASE','before')
base=os.environ.get('BASE_URL','http://127.0.0.1:4497')
out=Path('../quality-reports/definitive-a/evidence'); out.mkdir(parents=True,exist_ok=True);rows=[]
with sync_playwright() as p:
 b=p.chromium.launch()
 cases=[('inicio',941,1672),('fiados',390,693),('corte',941,1672),('metas',941,1672),('pendientes',941,1672),('inicio',1448,1086)]+[(r,w,h) for r in ['inicio','fiados','corte','metas','pendientes'] for w,h in [(390,693),(320,569)]]
 for route,w,h in dict.fromkeys(cases):
  page=b.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
  page.goto(base+'/'+route); page.wait_for_load_state('networkidle');page.evaluate('document.fonts.ready')
  page.screenshot(path=str(out/f'{phase}-{route}-{w}x{h}.png'))
  rows.append({'route':route,'width':w,'height':h,'baseUrl':base,'phase':phase,**page.evaluate('''() => ({title:document.title, sidebar:!!document.querySelector('.inicio-sidebar')&&getComputedStyle(document.querySelector('.inicio-sidebar')).display,nav:!!document.querySelector('.mc-mobile-nav')&&getComputedStyle(document.querySelector('.mc-mobile-nav')).display,overflow:document.documentElement.scrollWidth>innerWidth,body:document.body.innerText})''')})
  page.close()
 b.close()
(out/f'{phase}.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{k:v for k,v in row.items() if k!='body'} for row in rows],indent=2))

