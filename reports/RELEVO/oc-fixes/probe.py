from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":390,"height":693})
    pg.goto("http://localhost:3200/inicio", wait_until="networkidle"); pg.wait_for_timeout(300)
    print(json.dumps(pg.evaluate("""() => {
      const out=[];
      document.querySelectorAll('*').forEach(el=>{
        const cs=getComputedStyle(el); const r=el.getBoundingClientRect();
        if ((cs.outlineStyle!=='none' && parseFloat(cs.outlineWidth)>0) || (parseFloat(cs.borderTopWidth)>0 && r.width<520 && r.height<80 && r.width>120)) {
          out.push({tag:el.tagName, cls:(el.className||'').toString().slice(0,60), rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], outline:cs.outline, border:cs.borderTopWidth+' '+cs.borderTopColor});
        }
      });
      return out.slice(0,15);
    }""")))
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.wait_for_timeout(150)
    pg.screenshot(path='reports/RELEVO/oc-fixes/captures/_probe-inicio-blur.png')
    b.close()
