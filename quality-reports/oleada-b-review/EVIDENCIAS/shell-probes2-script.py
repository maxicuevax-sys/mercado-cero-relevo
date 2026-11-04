#!/usr/bin/env python3
"""Clean focused probes, no draft carry-over between cases."""
from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
OUT = Path(r"C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero\quality-reports\oleada-b-review\EVIDENCIAS")
R: dict = {}
DRAFT_KEYS = ["mercado-cero:caja-draft:v2", "mercado-cero:caja-request:v2", "mercado-cero:caja-pending:v2", "mercado-cero:draft:v1", "mercado-cero:sale-request:v1", "mercado-cero:pending-order:v1"]


def rec(key, value):
    R[key] = value
    (OUT / "shell-probes2.json").write_text(json.dumps(R, ensure_ascii=False, indent=2), encoding="utf-8")
    print(key, json.dumps(value, ensure_ascii=False)[:700])


def goto(page, path, wait=800):
    page.goto(BASE + path, wait_until="domcontentloaded")
    page.wait_for_timeout(wait)


def clear(page, path="/inicio"):
    goto(page, path, 500)
    page.evaluate("(keys)=>keys.forEach(k=>localStorage.removeItem(k))", DRAFT_KEYS)
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(700)


def visible_rect(page, sel):
    return page.evaluate(
        """(sel)=>{const els=[...document.querySelectorAll(sel)];const e=els.find(x=>{const q=x.getBoundingClientRect();return q.width>0&&q.height>0;});if(!e)return null;const r=e.getBoundingClientRect();const s=getComputedStyle(e);return{x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),bottom:+r.bottom.toFixed(1),right:+r.right.toFixed(1),display:s.display,position:s.position,z:s.zIndex,disabled:e.disabled??null,text:(e.innerText||'').trim().slice(0,60)};}""",
        sel,
    )


def add_item(page, desc, qty, price):
    add = page.locator(".mc-caja-add:visible")
    add.get_by_label("Producto o servicio").fill(desc)
    add.get_by_label("Cantidad").fill(qty)
    add.get_by_label("Precio unitario").fill(price)
    add.get_by_role("button", name="Agregar", exact=True).click()
    page.wait_for_timeout(120)


def scroll_bottom(page):
    page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    page.wait_for_timeout(300)


def overflow_report(page):
    return page.evaluate(
        """() => {
      const vw = innerWidth; const root = document.documentElement; const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right > vw + 1 || r.left < -1) {
          offenders.push({tag: el.tagName, cls: (el.className||'').toString().slice(0,120), text: (el.innerText||'').replace(/\\s+/g,' ').trim().slice(0,70), left:+r.left.toFixed(1), right:+r.right.toFixed(1), w:+r.width.toFixed(1)});
          if (offenders.length >= 30) break;
        }
      }
      return {vw, htmlScroll: root.scrollWidth, htmlClient: root.clientWidth, bodyScroll: document.body.scrollWidth, offenders};
    }"""
    )


with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    # ---------- CTA clean ----------
    ctx = b.new_context(viewport={"width": 1448, "height": 1086}, locale="es-MX")
    page = ctx.new_page(); page.set_default_timeout(20000)
    cta = {}
    for w, h in [(1448, 1086), (1366, 768), (1024, 768), (768, 1024)]:
        page.set_viewport_size({"width": w, "height": h})
        clear(page, "/inicio")
        goto(page, "/caja", 900)
        cta[f"{w}x{h}-empty"] = {"cta": visible_rect(page, ".mc-caja-confirm"), "total": visible_rect(page, ".mc-caja-total"), "paybar": visible_rect(page, ".mc-caja-paybar"), "viewport": {"w": w, "h": h}}
        add_item(page, "Uno", "1", "10")
        add_item(page, "Dos", "1", "20")
        add_item(page, "Tres", "1", "30")
        page.wait_for_timeout(400)
        cta[f"{w}x{h}-three"] = {"cta": visible_rect(page, ".mc-caja-confirm"), "total": visible_rect(page, ".mc-caja-total"), "paybar": visible_rect(page, ".mc-caja-paybar"), "viewport": {"w": w, "h": h}}
        page.screenshot(path=str(OUT / f"shell-cta-clean-{w}x{h}-three.png"))
    rec("ctaClean", cta)

    # hash
    goto(page, "/caja#confirmar", 900)
    rec("hashConfirmarClean", page.evaluate("() => ({id:!!document.getElementById('confirmar'), hash:location.hash, target:document.querySelector(':target')?.id||null})"))

    # ---------- Volver a Caja ----------
    clear(page, "/inicio")
    page.set_viewport_size({"width": 1448, "height": 1086})
    goto(page, "/caja", 900)
    add_item(page, "Probe volver", "1", "5")
    page.get_by_label("Efectivo recibido").fill("5")
    page.locator(".mc-caja-confirm:visible").click()
    page.locator(".mc-caja-result").wait_for(state="visible")
    page.wait_for_timeout(500)
    before = page.evaluate("() => ({url:location.href,h1:document.querySelector('.inicio-shell:not([style*=\"display: none\"]) h1')?.innerText||document.querySelector('h1')?.innerText,result:!!document.querySelector('.mc-caja-result')})")
    page.locator('.mc-caja-result a[href="/caja"]').click()
    page.wait_for_timeout(1500)
    after = page.evaluate("() => ({url:location.href,h1:[...document.querySelectorAll('h1')].find(h=>h.getBoundingClientRect().width>0)?.innerText,result:!!document.querySelector('.mc-caja-result'),bodyHasResult:document.body.innerText.includes('Venta cobrada')})")
    rec("volverACajaClean", {"before": before, "after": after})
    page.screenshot(path=str(OUT / "shell-volver-a-caja-noop.png"))

    # ---------- Pagination ----------
    clear(page, "/inicio")
    page.set_viewport_size({"width": 1448, "height": 1086})
    goto(page, "/ventas", 1200)
    def page_state(pg):
        return pg.evaluate("""() => ({url:location.href, rows:document.querySelectorAll('.mc-ventas-row').length, head:document.querySelector('#mc-ventas-list-title')?.parentElement?.innerText, first:document.querySelector('.mc-ventas-row h3')?.innerText, pager:[...document.querySelectorAll('.mc-ventas-pager a,.mc-ventas-pager span')].map(e=>({text:e.innerText,href:e.getAttribute('href'),disabled:e.getAttribute('aria-disabled'),h:+e.getBoundingClientRect().height.toFixed(1),w:+e.getBoundingClientRect().width.toFixed(1)})), pagerAria:[...document.querySelectorAll('.mc-ventas-pager [aria-current]')].length, scrollY:window.scrollY, focus:document.activeElement.tagName})""")
    rec("paginationPage1", page_state(page))
    goto(page, "/ventas?page=2", 1200)
    rec("paginationPage2", page_state(page))
    for q in ["?page=1", "?page=999", "?page=abc", "?page=0"]:
        goto(page, "/ventas" + q, 1200)
        rec("pagination" + q, page_state(page))
    goto(page, "/ventas", 1000)
    page.evaluate("window.scrollTo(0, 900)")
    page.locator(".mc-ventas-pager a[rel=next]:visible").first.click()
    page.wait_for_timeout(1400)
    rec("paginationClickNext", page_state(page))
    page.go_back(); page.wait_for_timeout(1400)
    rec("paginationBack", page_state(page))
    page.go_forward(); page.wait_for_timeout(1400)
    rec("paginationForward", page_state(page))
    page.screenshot(path=str(OUT / "shell-pagination-page2.png"))

    # ---------- Overflow 320/200% ----------
    ctx2 = b.new_context(viewport={"width": 320, "height": 640}, locale="es-MX")
    m = ctx2.new_page(); m.set_default_timeout(20000)
    clear(m, "/inicio")
    goto(m, "/ventas", 1000)
    m.evaluate("document.documentElement.style.fontSize='32px'")
    m.wait_for_timeout(800)
    rec("overflowVentas320Text200Clean", overflow_report(m))
    m.screenshot(path=str(OUT / "shell-overflow-ventas-320-text200-clean.png"))

    clear(m, "/inicio")
    goto(m, "/caja", 900)
    m.evaluate("document.documentElement.style.fontSize='32px'")
    m.wait_for_timeout(500)
    rec("caja320Text200EmptyClean", overflow_report(m))
    add_item(m, "Producto con nombre largo para probar", "2", "1,234.50")
    m.wait_for_timeout(500)
    rec("caja320Text200ItemClean", overflow_report(m))
    rec("caja320Text200GeometryClean", {"cta": visible_rect(m, ".mc-caja-confirm"), "paybar": visible_rect(m, ".mc-caja-paybar"), "nav": visible_rect(m, ".mc-mobile-nav"), "total": visible_rect(m, ".mc-caja-total")})
    m.screenshot(path=str(OUT / "shell-overflow-caja-320-text200-clean.png"))
    scroll_bottom(m)
    m.screenshot(path=str(OUT / "shell-caja-320-text200-bottom-clean.png"))

    # 390 200%
    m.set_viewport_size({"width": 390, "height": 844})
    clear(m, "/inicio")
    goto(m, "/caja", 900)
    m.evaluate("document.documentElement.style.fontSize='32px'")
    add_item(m, "Producto con nombre largo para probar", "2", "1,234.50")
    m.wait_for_timeout(500)
    rec("caja390Text200ItemClean", overflow_report(m))
    rec("caja390Text200GeometryClean", {"cta": visible_rect(m, ".mc-caja-confirm"), "paybar": visible_rect(m, ".mc-caja-paybar"), "nav": visible_rect(m, ".mc-mobile-nav"), "total": visible_rect(m, ".mc-caja-total")})
    m.screenshot(path=str(OUT / "shell-caja-390-text200-item-clean.png"))

    # ---------- Draft v1/v2 identical ----------
    ctx3 = b.new_context(viewport={"width": 390, "height": 844}, locale="es-MX")
    d = ctx3.new_page(); d.set_default_timeout(20000)
    goto(d, "/inicio", 700)
    d.evaluate("localStorage.clear()")
    d.evaluate("""() => localStorage.setItem('mercado-cero:draft:v1', JSON.stringify({
      version:1, items:[{id:'v1_same',description:'Quesadilla',quantity:2,unitPriceCents:3500,totalCents:7000}],
      cashCents:0,creditCents:0,customerName:'',textInput:'',transcript:'',updatedAt:new Date().toISOString()
    }))""")
    goto(d, "/caja", 1200)
    add_item(d, "Quesadilla", "2", "35")
    d.wait_for_timeout(600)
    st = d.evaluate("""() => ({v1:localStorage.getItem('mercado-cero:draft:v1'),v2:localStorage.getItem('mercado-cero:caja-draft:v2'),restore:!!document.querySelector('.mc-caja-restore'),body:document.body.innerText.replace(/\\s+/g,' ').slice(0,1200),hasV1Warning:document.body.innerText.includes('Caja clásica')||document.body.innerText.includes('venta sin confirmar en la Caja')})""")
    rec("draftCoexistenceCajaMobile", {"v1": bool(st["v1"]), "v2": bool(st["v2"]), "restore": st["restore"], "hasV1Warning": st["hasV1Warning"], "body": st["body"]})
    d.screenshot(path=str(OUT / "shell-draft-v1-v2-caja-mobile-clean.png"))
    goto(d, "/", 1400)
    leg = d.evaluate("""() => ({body:document.body.innerText.replace(/\\s+/g,' ').slice(0,1000),v1:!!localStorage.getItem('mercado-cero:draft:v1'),v2:!!localStorage.getItem('mercado-cero:caja-draft:v2'),restored:document.body.innerText.includes('Recuper')||document.body.innerText.includes('Quesadilla')})""")
    rec("draftCoexistenceLegacyMobile", leg)
    d.screenshot(path=str(OUT / "shell-draft-v1-restored-legacy-mobile-clean.png"))

    # ---------- Ayuda from Caja + back ----------
    ctx4 = b.new_context(viewport={"width": 1448, "height": 1086}, locale="es-MX")
    a = ctx4.new_page(); a.set_default_timeout(20000)
    clear(a, "/inicio")
    goto(a, "/caja", 900)
    add_item(a, "Draft antes de ayuda", "1", "9")
    a.wait_for_timeout(500)
    a.locator('.inicio-sidebar:visible .inicio-sidebar__foot a[href="/?ayuda=1"]').click()
    a.wait_for_timeout(1800)
    mid = a.evaluate("() => ({url:location.href,dialog:!!document.querySelector('[role=dialog]'),v2:!!localStorage.getItem('mercado-cero:caja-draft:v2')})")
    a.go_back(); a.wait_for_timeout(1600)
    back = a.evaluate("() => ({url:location.href,restore:!!document.querySelector('.mc-caja-restore'),total:[...document.querySelectorAll('.mc-caja-total')].find(e=>e.getBoundingClientRect().width>0)?.innerText,v2:!!localStorage.getItem('mercado-cero:caja-draft:v2')})")
    rec("ayudaFromCajaBackClean", {"mid": mid, "back": back})

    # alias hash/ayuda browser
    goto(a, "/fiados?ayuda=1#ajustes", 1800)
    rec("aliasHashBrowser", a.evaluate("() => ({url:location.href,hash:location.hash,dialog:!!document.querySelector('[role=dialog]'),helpTitle:document.body.innerText.includes('Ayuda y ajustes'),v2:!!localStorage.getItem('mercado-cero:caja-draft:v2')})"))
    a.screenshot(path=str(OUT / "shell-alias-fiados-ayuda-ajustes.png"))

    # ---------- 404 and pay (recheck status) ----------
    r404 = a.goto(BASE + "/ruta-inexistente", wait_until="domcontentloaded"); a.wait_for_timeout(600)
    rec("route404", {"status": r404.status, "url": a.url, "body": a.evaluate("() => document.body.innerText.replace(/\\s+/g,' ').slice(0,300)"), "shells": a.evaluate("() => ({new:document.querySelectorAll('.inicio-shell').length,legacy:document.querySelectorAll('.app-shell').length,navs:document.querySelectorAll('nav').length})")})
    rp = a.goto(BASE + "/pay/inexistente", wait_until="domcontentloaded"); a.wait_for_timeout(700)
    rec("payMissing", {"status": rp.status, "url": a.url, "body": a.evaluate("() => document.body.innerText.replace(/\\s+/g,' ').slice(0,300)"), "shells": a.evaluate("() => ({new:document.querySelectorAll('.inicio-shell').length,legacy:document.querySelectorAll('.app-shell').length,pay:document.querySelectorAll('.pay-shell').length,current:document.querySelectorAll('[aria-current]').length})")})

    for c in (ctx, ctx2, ctx3, ctx4):
        c.close()
    b.close()

print("WROTE", OUT / "shell-probes2.json")
