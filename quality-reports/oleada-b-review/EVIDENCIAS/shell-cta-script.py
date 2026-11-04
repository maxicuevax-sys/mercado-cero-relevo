import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(r"C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero\quality-reports\oleada-b-review\EVIDENCIAS")
BASE="http://localhost:3100"
def add(p,d,q,pr):
    a=p.locator(".mc-caja-add:visible"); a.get_by_label("Producto o servicio").fill(d); a.get_by_label("Cantidad").fill(q); a.get_by_label("Precio unitario").fill(pr); a.get_by_role("button",name="Agregar",exact=True).click(); p.wait_for_timeout(100)
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True); c=b.new_context(viewport={"width":1366,"height":768},locale="es-MX"); p=c.new_page(); p.set_default_timeout(20000)
    out={}
    for w,h in [(1366,768),(1448,1086),(1024,768),(768,1024),(390,844),(320,640)]:
        p.set_viewport_size({"width":w,"height":h})
        p.goto(BASE+"/inicio",wait_until="domcontentloaded"); p.wait_for_timeout(400)
        p.evaluate("['mercado-cero:caja-draft:v2','mercado-cero:caja-request:v2','mercado-cero:caja-pending:v2'].forEach(k=>localStorage.removeItem(k))")
        p.goto(BASE+"/caja",wait_until="domcontentloaded"); p.wait_for_timeout(900)
        def state():
            p.evaluate("window.scrollTo(0,0)"); p.wait_for_timeout(150)
            return p.evaluate("""() => {const e=document.querySelector('.mc-caja-confirm');const r=e.getBoundingClientRect();const t=document.querySelector('.mc-caja-total').getBoundingClientRect();return {scrollY, vh:innerHeight, cta:{y:+r.y.toFixed(1),bottom:+r.bottom.toFixed(1),h:+r.height.toFixed(1),text:e.innerText.trim()}, total:{y:+t.y.toFixed(1),bottom:+t.bottom.toFixed(1)}, paybar:!!document.querySelector('.mc-caja-paybar')};}""")
        out[f"{w}x{h}-empty"]=state()
        add(p,"Uno","1","10"); add(p,"Dos","1","20"); add(p,"Tres","1","30"); p.wait_for_timeout(300)
        out[f"{w}x{h}-three"]=state()
        p.screenshot(path=str(OUT/f"shell-cta-scrolltop-{w}x{h}.png"))
    (OUT/"shell-cta-scrolltop.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(out,ensure_ascii=False,indent=2))
    c.close(); b.close()
