#!/usr/bin/env python3
"""Adversarial shell audit for Oleada B, read-only against the running build."""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
ROOT = Path(r"C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero")
OUT = ROOT / "quality-reports" / "oleada-b-review" / "EVIDENCIAS"
OUT.mkdir(parents=True, exist_ok=True)

RESULTS: list[dict] = []
SNAPS: dict[str, dict] = {}
SHOTS: list[str] = []
console_errors: list[str] = []
page_errors: list[str] = []


def check(cid: str, ok: bool | None, detail: str = "", sev: str = "info") -> None:
    RESULTS.append({"id": cid, "ok": None if ok is None else bool(ok), "detail": detail, "severity": sev})
    icon = "INFO" if ok is None else ("PASS" if ok else "FAIL")
    print(f"{icon:4} {cid}: {detail}")


def shot(page, name: str) -> None:
    path = OUT / f"shell-{name}.png"
    page.screenshot(path=str(path), full_page=False)
    SHOTS.append(str(path))


SNAP_JS = r"""
() => {
  const txt = (el) => ((el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 180);
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), bottom: +r.bottom.toFixed(1), right: +r.right.toFixed(1) };
  };
  const navOf = (el) => {
    const n = el.closest('nav');
    return n ? (n.getAttribute('aria-label') || n.className || 'sin-label') : null;
  };
  const current = [...document.querySelectorAll('[aria-current="page"]')].map((el) => ({
    text: txt(el), tag: el.tagName, visible: visible(el), nav: navOf(el), rect: rect(el),
  }));
  const navs = [...document.querySelectorAll('nav')].map((n) => ({
    label: n.getAttribute('aria-label'), cls: n.className, visible: visible(n),
    links: [...n.querySelectorAll('a')].filter(visible).map((a) => ({ text: txt(a), href: a.getAttribute('href'), current: a.getAttribute('aria-current'), rect: rect(a) })),
  }));
  const active = document.activeElement;
  const main = document.querySelector('main');
  const root = document.documentElement;
  const body = document.body;
  const shellNew = document.querySelector('.inicio-shell');
  const shellLegacy = document.querySelector('.app-shell');
  const pay = document.querySelector('.pay-shell');
  const mobileNav = document.querySelector('.mc-mobile-nav');
  const sidebar = document.querySelector('.inicio-sidebar');
  const legacySidebar = document.querySelector('.app-sidebar');
  const legacyTabs = document.querySelector('.mobile-tabs');
  const h1 = [...document.querySelectorAll('h1')].map((h) => ({ text: txt(h), visible: visible(h) }));
  const dialogs = [...document.querySelectorAll('[role="dialog"]')].map((d) => ({ text: txt(d).slice(0, 80), visible: visible(d) }));
  return {
    url: location.href,
    path: location.pathname,
    search: location.search,
    hash: location.hash,
    title: document.title,
    lang: document.documentElement.lang,
    h1,
    mainCount: document.querySelectorAll('main').length,
    mainRect: rect(main),
    activeElement: { tag: active.tagName, id: active.id || null, cls: typeof active.className === 'string' ? active.className.slice(0, 120) : null, text: txt(active).slice(0, 80) },
    current, currentVisible: current.filter((x) => x.visible).length,
    navs,
    navCountVisible: navs.filter((n) => n.visible).length,
    shell: {
      new: Boolean(shellNew), newVisible: visible(shellNew),
      legacy: Boolean(shellLegacy), legacyVisible: visible(shellLegacy),
      pay: Boolean(pay), payVisible: visible(pay),
      sidebarVisible: visible(sidebar), mobileNavVisible: visible(mobileNav),
      legacySidebarVisible: visible(legacySidebar), legacyTabsVisible: visible(legacyTabs),
    },
    mobileNavRect: rect(mobileNav),
    sidebarRect: rect(sidebar),
    skip: (() => { const s = document.querySelector('.inicio-skip'); return s ? { text: txt(s), rect: rect(s), focused: document.activeElement === s } : null; })(),
    dialogs,
    overflow: {
      html: [root.scrollWidth, root.clientWidth],
      body: [body.scrollWidth, body.clientWidth],
      main: main ? [main.scrollWidth, main.clientWidth] : null,
      horizontal: root.scrollWidth > root.clientWidth || body.scrollWidth > body.clientWidth,
    },
    bodyText: (body.innerText || '').replace(/\s+/g, ' ').slice(0, 4000),
    replacementChars: ((body.innerText || '').match(/\uFFFD/g) || []).length,
    storage: (() => { try { return Object.keys(localStorage).filter((k) => k.includes('mercado-cero')).sort(); } catch (e) { return ['ERR']; } })(),
  };
}
"""


def snap(page, name: str) -> dict:
    data = page.evaluate(SNAP_JS)
    SNAPS[name] = data
    return data


def goto(page, path: str, wait: int = 600) -> dict:
    page.goto(BASE + path, wait_until="domcontentloaded")
    page.wait_for_timeout(wait)
    return page


def add_item(page, desc: str, qty: str, price: str) -> None:
    add = page.locator(".mc-caja-add")
    add.get_by_label("Producto o servicio").fill(desc)
    add.get_by_label("Cantidad").fill(qty)
    add.get_by_label("Precio unitario").fill(price)
    add.get_by_role("button", name="Agregar", exact=True).click()
    page.wait_for_timeout(150)


def element_rect(page, sel: str):
    return page.evaluate(
        """(sel) => { const e = document.querySelector(sel); if (!e) return null;
        const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
        return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),bottom:+r.bottom.toFixed(1),right:+r.right.toFixed(1),display:s.display,position:s.position,z:s.zIndex,padBottom:s.paddingBottom}; }""",
        sel,
    )


def scroll_bottom(page):
    page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    page.wait_for_timeout(350)


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ---------------- DESKTOP FLOW ----------------
        ctx = browser.new_context(viewport={"width": 1448, "height": 1086}, locale="es-MX")
        page = ctx.new_page()
        page.set_default_timeout(20_000)
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        s = goto(page, "/inicio", 900)
        d = snap(page, "desktop-inicio")
        check("D1.1", d["h1"] and d["h1"][0]["visible"], f"h1={d['h1']}")
        check("D1.2", d["currentVisible"] == 1 and d["current"][0]["text"] == "Inicio", f"aria-current visible={d['currentVisible']} all={[(x['text'],x['visible']) for x in d['current']]}")
        check("D1.3", d["shell"]["sidebarVisible"] and not d["shell"]["mobileNavVisible"], f"sidebar={d['shell']['sidebarVisible']} mobile={d['shell']['mobileNavVisible']}")
        check("D1.4", d["mainCount"] == 1 and len(d["h1"]) == 1, f"main={d['mainCount']} h1={len(d['h1'])}")
        check("D1.5", d["overflow"]["horizontal"] is False, f"overflow={d['overflow']}")
        shot(page, "desktop-1448-inicio")

        # skip link
        page.evaluate("window.scrollTo(0,0); document.body.focus()")
        before_skip = page.evaluate("document.activeElement.tagName")
        page.keyboard.press("Tab")
        page.wait_for_timeout(150)
        skip_state = page.evaluate("""() => { const a=document.querySelector('.inicio-skip'); const r=a.getBoundingClientRect(); const s=getComputedStyle(a); return {tag:document.activeElement.tagName,cls:document.activeElement.className,top:r.top,transform:s.transform,text:a.innerText}; }""")
        shot(page, "skip-link-focus-1448")
        check("D2.1", skip_state["tag"] == "A" and skip_state["top"] >= 0, f"active={skip_state['tag']} top={skip_state['top']} transform={skip_state['transform']}")
        page.keyboard.press("Enter")
        page.wait_for_timeout(250)
        after_skip = page.evaluate("({tag:document.activeElement.tagName,id:document.activeElement.id,cls:document.activeElement.className})")
        check("D2.2", after_skip["id"] == "inicio-main", f"active={after_skip}")

        # click Caja
        page.locator('.inicio-sidebar a[href="/caja"]').click()
        page.wait_for_url("**/caja", timeout=15000)
        page.wait_for_timeout(900)
        d = snap(page, "desktop-caja-empty")
        check("D3.1", d["url"].endswith("/caja") and d["h1"][0]["text"] == "Nueva venta", f"url={d['url']} h1={d['h1']}")
        check("D3.2", d["currentVisible"] == 1 and d["current"][0]["text"] == "Caja", f"current={[(x['text'],x['visible']) for x in d['current']]}")
        check("D3.3", d["activeElement"]["tag"] == "BODY", f"focus after nav={d['activeElement']}")
        check("D3.4", d["title"].find("Caja") >= 0 and "\uFFFD" not in d["title"], f"title={d['title']!r}")
        check("D3.5", d["replacementChars"] == 0, f"replacementChars={d['replacementChars']}")
        cta = element_rect(page, ".mc-caja-confirm")
        total = element_rect(page, ".mc-caja-total")
        viewport = page.viewport_size
        check("D3.6", bool(cta) and cta["y"] >= 0 and cta["bottom"] <= viewport["height"], f"CTA={cta} viewportH={viewport['height']}")
        check("D3.7", bool(total) and total["y"] >= 0 and total["bottom"] <= viewport["height"], f"total={total}")
        shot(page, "desktop-1448-caja-empty")

        # sale
        add_item(page, "Auditoria shell", "1", "5")
        page.get_by_label("Efectivo recibido").fill("5")
        page.locator(".mc-caja-confirm").click()
        page.locator(".mc-caja-result").wait_for(state="visible", timeout=15000)
        page.wait_for_timeout(500)
        d = snap(page, "desktop-caja-result")
        check("D4.1", "Auditoria shell" not in d["bodyText"] and d["h1"][0]["text"] == "Venta registrada", f"h1={d['h1']}")
        check("D4.2", d["activeElement"]["id"] == "mc-caja-result-title", f"focus={d['activeElement']}")
        check("D4.3", d["currentVisible"] == 1, f"current={[(x['text'],x['visible']) for x in d['current']]}")
        back_to_caja = page.locator('.mc-caja-result a[href="/caja"]')
        check("D4.4", back_to_caja.count() == 1, f"link 'Volver a Caja' count={back_to_caja.count()}")
        shot(page, "desktop-1448-caja-result")

        page.get_by_role("link", name="Ver ventas").click()
        page.wait_for_url("**/ventas", timeout=15000)
        page.wait_for_timeout(900)
        d = snap(page, "desktop-ventas")
        check("D5.1", d["h1"][0]["text"] == "Ventas" and d["currentVisible"] == 1 and d["current"][0]["text"] == "Ventas", f"h1={d['h1']} current={[(x['text'],x['visible']) for x in d['current']]}")
        check("D5.2", d["activeElement"]["tag"] == "BODY", f"focus after nav={d['activeElement']}")
        check("D5.3", d["overflow"]["horizontal"] is False, f"overflow={d['overflow']}")
        check("D5.4", "Auditoria shell" in d["bodyText"], "sale visible in list")
        check("D5.5", "página 1 de" in d["bodyText"].lower() or "p\u00e1gina 1 de" in d["bodyText"], f"pager text? {d['bodyText'][:160]}")
        shot(page, "desktop-1448-ventas")

        # back / forward from ventas -> caja
        page.go_back(wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        d = snap(page, "desktop-back-caja")
        check("D6.1", "/caja" in d["url"], f"back url={d['url']} h1={d['h1']}")
        check("D6.2", d["activeElement"]["tag"] == "BODY", f"focus after back={d['activeElement']}")
        check("D6.3", d["currentVisible"] <= 1, f"current after back={[(x['text'],x['visible']) for x in d['current']]}")
        shot(page, "desktop-back-caja")
        page.go_forward(wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        d = snap(page, "desktop-forward-ventas")
        check("D6.4", "/ventas" in d["url"], f"forward url={d['url']} h1={d['h1']}")
        check("D6.5", d["activeElement"]["tag"] == "BODY", f"focus after forward={d['activeElement']}")

        # reload /ventas
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        d = snap(page, "desktop-reload-ventas")
        check("D7.1", d["h1"][0]["text"] == "Ventas" and d["currentVisible"] == 1, f"url={d['url']} current={[(x['text'],x['visible']) for x in d['current']]}")
        check("D7.2", "Auditoria shell" in d["bodyText"], "sale survives reload")
        shot(page, "desktop-reload-ventas")

        # invalid pages
        for q, label in [("?page=999", "999"), ("?page=abc", "abc"), ("?page=0", "0"), ("?page=-3", "-3")]:
            goto(page, "/ventas" + q, 900)
            d = snap(page, f"desktop-ventas-{label}")
            m = "página 1 de" in d["bodyText"].lower() or "p\u00e1gina 1 de" in d["bodyText"]
            check(f"D8.{label}", (d["search"] == q) and m, f"url={d['url']} page1text={m} rows={page.locator('.mc-ventas-row').count()}")
        shot(page, "desktop-ventas-page-999")

        # Fiados via new nav, report legacy
        goto(page, "/ventas", 900)
        page.evaluate("window.__auditMarker='alive'")
        page.locator('.inicio-sidebar a[href="/fiados"]').click()
        page.wait_for_timeout(1800)
        d = snap(page, "desktop-fiados-via-nav")
        marker = page.evaluate("window.__auditMarker ?? null")
        check("D9.1", "tab=fiado" in d["url"], f"final url={d['url']}")
        check("D9.2", d["shell"]["new"] is False and d["shell"]["legacy"] is True, f"newShell={d['shell']['new']} legacy={d['shell']['legacy']}")
        check("D9.3", d["shell"]["legacySidebarVisible"], f"legacySidebar={d['shell']['legacySidebarVisible']} mobileTabs={d['shell']['legacyTabsVisible']}")
        check("D9.4", marker == "alive", f"full document reload={marker is None}")
        check("D9.5", d["currentVisible"] == 0, f"new aria-current visible={d['currentVisible']}")
        shot(page, "desktop-legacy-fiado-via-nav")
        page.go_back(wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        d = snap(page, "desktop-back-from-legacy")
        check("D9.6", "/ventas" in d["url"], f"back from legacy url={d['url']}")
        page.go_forward(wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        d2 = snap(page, "desktop-forward-to-legacy")
        check("D9.7", "tab=fiado" in d2["url"], f"forward url={d2['url']}")

        # Direct legacy tabs
        for q, expected in [("?tab=fiado", "Fiado"), ("?tab=corte", "Corte"), ("?tab=meta", "Meta"), ("?tab=pendientes", "Pendientes")]:
            goto(page, "/" + q, 1000)
            d = snap(page, f"legacy-{q[5:]}")
            selected = page.evaluate("""() => [...document.querySelectorAll('[aria-selected="true"]')].map(e => (e.innerText||'').replace(/\\s+/g,' ').trim())""")
            check(f"D10.{q[5:]}", d["shell"]["legacy"] is True and len(selected) >= 1, f"url={d['url']} selected={selected} h1={d['h1']}")
        # switch tab via legacy UI; URL must not change
        goto(page, "/?tab=fiado", 1000)
        before_url = page.url
        page.locator('.app-sidebar button', has_text="Corte").first.click()
        page.wait_for_timeout(900)
        after_url = page.url
        d = snap(page, "legacy-tab-switch")
        check("D11.1", before_url == after_url, f"url before={before_url} after={after_url}")
        check("D11.2", "Corte" in d["bodyText"], "Corte content visible")
        page.go_back(wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        check("D11.3", "/?tab=fiado" not in page.url, f"back after tab switch url={page.url}")

        # Help sheet
        goto(page, "/?ayuda=1", 1200)
        d = snap(page, "legacy-help")
        check("D12.1", any(x["visible"] for x in d["dialogs"]), f"dialogs={d['dialogs']}")
        check("D12.2", "Ayuda y ajustes" in d["bodyText"], "help title in body")
        shot(page, "desktop-legacy-help")
        goto(page, "/?ayuda=1#ajustes", 1400)
        d = snap(page, "legacy-help-ajustes")
        check("D12.3", d["hash"] == "#ajustes" and any(x["visible"] for x in d["dialogs"]), f"hash={d['hash']} dialogs={d['dialogs']}")
        shot(page, "desktop-legacy-help-ajustes")
        goto(page, "/caja?ayuda=1", 1000)
        d = snap(page, "caja-ayuda")
        check("D12.4", len(d["dialogs"]) == 0 and "ayuda" not in d["search"], f"url={d['url']} dialogs={d['dialogs']}")
        goto(page, "/ventas?ayuda=1", 1000)
        d = snap(page, "ventas-ayuda")
        check("D12.5", len(d["dialogs"]) == 0 and "ayuda" not in d["search"], f"url={d['url']} dialogs={d['dialogs']}")
        # Ayuda in new nav
        goto(page, "/caja", 900)
        page.locator('.inicio-sidebar__foot a[href="/?ayuda=1"]').click()
        page.wait_for_timeout(1600)
        d = snap(page, "caja-nav-ayuda")
        check("D12.6", "ayuda=1" in d["search"] and d["shell"]["legacy"], f"url={d['url']} legacy={d['shell']['legacy']}")
        check("D12.7", any(x["visible"] for x in d["dialogs"]), f"dialogs={d['dialogs']}")

        # 404
        resp = page.goto(BASE + "/ruta-inexistente", wait_until="domcontentloaded")
        page.wait_for_timeout(700)
        d = snap(page, "404")
        check("D13.1", resp is not None and resp.status == 404, f"status={resp.status if resp else None}")
        check("D13.2", d["shell"]["new"] is False and d["shell"]["legacy"] is False and d["navCountVisible"] == 0, f"new={d['shell']['new']} legacy={d['shell']['legacy']} visibleNavs={d['navCountVisible']}")
        check("D13.3", len(d["h1"]) == 1, f"h1={d['h1']}")
        shot(page, "desktop-404")

        # Pay surface
        orders = page.request.get(BASE + "/api/orders?limit=1").json()["orders"]
        oid = orders[0]["id"]
        resp = page.goto(BASE + "/pay/" + oid, wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        d = snap(page, "pay-order")
        check("D14.1", resp is not None and resp.status == 200, f"status={resp.status if resp else None} url={d['url']}")
        check("D14.2", d["shell"]["new"] is False and d["shell"]["legacy"] is False and d["shell"]["pay"] is True, f"new={d['shell']['new']} legacy={d['shell']['legacy']} pay={d['shell']['pay']}")
        check("D14.3", d["currentVisible"] == 0 and d["navCountVisible"] == 0, f"ariaCurrent={d['currentVisible']} visibleNavs={d['navCountVisible']}")
        check("D14.4", d["mainCount"] <= 1, f"mainCount={d['mainCount']}")
        check("D14.5", d["replacementChars"] == 0, f"replacementChars={d['replacementChars']}")
        shot(page, "pay-shell-absent")
        resp = page.goto(BASE + "/pay/inexistente", wait_until="domcontentloaded")
        page.wait_for_timeout(700)
        d = snap(page, "pay-missing")
        check("D14.6", resp is not None and resp.status == 404, f"missing pay status={resp.status if resp else None} url={d['url']}")
        check("D14.7", d["shell"]["new"] is False and d["shell"]["legacy"] is False, f"new={d['shell']['new']} legacy={d['shell']['legacy']}")
        shot(page, "pay-missing")

        # Draft v2 + v1 coexistence
        goto(page, "/caja", 900)
        add_item(page, "Borrador v2 audit", "2", "25")
        page.wait_for_timeout(500)
        v2 = page.evaluate("localStorage.getItem('mercado-cero:caja-draft:v2')")
        check("D15.1", bool(v2) and "Borrador v2 audit" in v2, f"v2 saved len={len(v2 or '')}")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(1200)
        d = snap(page, "caja-draft-reload")
        check("D15.2", page.locator(".mc-caja-restore").count() == 1 and "Borrador v2 audit" in d["bodyText"], f"restore notice={page.locator('.mc-caja-restore').count()} total={page.locator('.mc-caja-total').inner_text()}")
        shot(page, "desktop-caja-draft-restored")

        # Inject v1 while v2 exists, then load /caja and /.
        page.evaluate("""() => {
          localStorage.setItem('mercado-cero:draft:v1', JSON.stringify({
            version: 1,
            items: [{id:'v1_audit', description:'Borrador v1 audit', quantity:1, unitPriceCents:700, totalCents:700}],
            cashCents:0, creditCents:0, customerName:'', textInput:'', transcript:'',
            updatedAt:new Date().toISOString()
          }));
        }""")
        goto(page, "/caja", 1200)
        d = snap(page, "caja-with-v1")
        v1_after = page.evaluate("localStorage.getItem('mercado-cero:draft:v1')")
        check("D15.3", bool(v1_after), "v1 still present after /caja")
        check("D15.4", "v1 audit" not in d["bodyText"] and page.locator(".mc-caja-restore").count() == 0 or "Borrador v2 audit" in d["bodyText"], f"v1 notice? bodyHasV1={'v1 audit' in d['bodyText']} restore={page.locator('.mc-caja-restore').count()}")
        check("D15.5", "Caja clásica" in d["bodyText"] or "Caja cl\u00e1sica" in d["bodyText"], "classic caja footnote present")
        shot(page, "desktop-caja-with-v1-ignored")
        goto(page, "/", 1400)
        d = snap(page, "legacy-with-v1")
        check("D15.6", "v1 audit" in d["bodyText"] or "Borrador v1" in d["bodyText"] or "Recuper" in d["bodyText"], f"legacy restores v1? snippet={d['bodyText'][:200]}")
        check("D15.7", "v2 audit" not in d["bodyText"], "legacy ignores v2")
        shot(page, "desktop-legacy-draft-v1")

        # Layout / viewport matrix on new shell
        for w, h in [(1448, 1086), (1366, 768), (768, 1024), (390, 844), (320, 640)]:
            page.set_viewport_size({"width": w, "height": h})
            goto(page, "/inicio", 800)
            d = snap(page, f"viewport-{w}-inicio")
            ok = d["overflow"]["horizontal"] is False and d["currentVisible"] == 1
            check(f"D16.{w}.inicio", ok, f"overflow={d['overflow']['horizontal']} current={d['currentVisible']} sidebar={d['shell']['sidebarVisible']} mobile={d['shell']['mobileNavVisible']}")
            shot(page, f"{w}-inicio")
            goto(page, "/caja", 900)
            d = snap(page, f"viewport-{w}-caja")
            cta = element_rect(page, ".mc-caja-confirm")
            total = element_rect(page, ".mc-caja-total")
            check(f"D16.{w}.caja", d["overflow"]["horizontal"] is False and d["currentVisible"] == 1, f"overflow={d['overflow']['horizontal']} current={d['currentVisible']} cta={cta} total={total} viewportH={h}")
            shot(page, f"{w}-caja")
            goto(page, "/ventas", 900)
            d = snap(page, f"viewport-{w}-ventas")
            check(f"D16.{w}.ventas", d["overflow"]["horizontal"] is False and d["currentVisible"] == 1, f"overflow={d['overflow']['horizontal']} current={d['currentVisible']}")
            shot(page, f"{w}-ventas")

        # 200% text-only (root 32px) + browser zoom equivalent
        page.set_viewport_size({"width": 390, "height": 844})
        for path in ["/inicio", "/caja", "/ventas"]:
            goto(page, path, 800)
            page.evaluate("document.documentElement.style.fontSize='32px'")
            page.wait_for_timeout(500)
            d = snap(page, f"text200-390-{path.strip('/')}")
            check(f"D17.390{path}", d["overflow"]["horizontal"] is False, f"overflow={d['overflow']} current={d['currentVisible']}")
            shot(page, f"text200-390-{path.strip('/')}")
        page.evaluate("document.documentElement.style.fontSize=''")
        # 200% browser zoom at 1448x1086 => 724x543 CSS viewport
        page.set_viewport_size({"width": 724, "height": 543})
        for path in ["/inicio", "/caja", "/ventas"]:
            goto(page, path, 800)
            d = snap(page, f"zoom200-{path.strip('/')}")
            check(f"D17.zoom{path}", d["overflow"]["horizontal"] is False and d["currentVisible"] == 1, f"overflow={d['overflow']} current={d['currentVisible']} sidebar={d['shell']['sidebarVisible']} mobile={d['shell']['mobileNavVisible']}")
            shot(page, f"zoom200-{path.strip('/')}")

        # 768 shell discontinuity: legacy route at same viewport
        page.set_viewport_size({"width": 768, "height": 1024})
        goto(page, "/?tab=corte", 1200)
        d = snap(page, "legacy-768")
        check("D18.1", d["shell"]["legacy"] and not d["shell"]["new"], f"legacy={d['shell']['legacy']} new={d['shell']['new']}")
        check("D18.2", d["shell"]["legacyTabsVisible"] and not d["shell"]["legacySidebarVisible"], f"legacyTabs={d['shell']['legacyTabsVisible']} legacySidebar={d['shell']['legacySidebarVisible']}")
        shot(page, "768-legacy-corte")
        goto(page, "/inicio", 900)
        d = snap(page, "new-768")
        check("D18.3", d["shell"]["sidebarVisible"] and not d["shell"]["mobileNavVisible"], f"sidebar={d['shell']['sidebarVisible']} mobile={d['shell']['mobileNavVisible']}")
        shot(page, "768-inicio")

        # ---------------- MOBILE FLOW ----------------
        mctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="es-MX", is_mobile=True, has_touch=True)
        m = mctx.new_page()
        m.set_default_timeout(20_000)
        m.on("console", lambda msg: console_errors.append("mobile: " + msg.text) if msg.type == "error" else None)
        m.on("pageerror", lambda e: page_errors.append("mobile: " + str(e)))

        goto(m, "/inicio", 900)
        d = snap(m, "mobile-inicio")
        check("M1.1", d["shell"]["mobileNavVisible"] and not d["shell"]["sidebarVisible"], f"mobile={d['shell']['mobileNavVisible']} sidebar={d['shell']['sidebarVisible']}")
        check("M1.2", d["currentVisible"] == 1 and d["current"][0]["text"] == "Inicio", f"current={[(x['text'],x['visible'],x['nav']) for x in d['current']]}")
        nav = next((n for n in d["navs"] if n["visible"] and n["label"] == "Principal"), None)
        check("M1.3", nav is not None and len(nav["links"]) == 4, f"primary links={[x['text'] for x in nav['links']] if nav else None}")
        check("M1.4", d["overflow"]["horizontal"] is False, f"overflow={d['overflow']}")
        check("M1.5", d["mobileNavRect"]["h"] >= 64, f"nav h={d['mobileNavRect']}")
        shot(m, "mobile-390-inicio")

        # More panel
        m.locator(".mc-mobile-nav__more summary").click()
        m.wait_for_timeout(350)
        panel = m.evaluate("""() => { const d=document.querySelector('.mc-mobile-nav__more'); const p=document.querySelector('.mc-mobile-nav__panel'); const s=document.querySelector('.mc-mobile-nav__more summary'); const r=p.getBoundingClientRect(); return {open:d.open, panel:{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom}, summary:{tag:s.tagName,h:s.getBoundingClientRect().height}, links:[...p.querySelectorAll('a')].map(a=>({text:a.innerText.trim(),href:a.getAttribute('href'),h:a.getBoundingClientRect().height,current:a.getAttribute('aria-current')})), viewport:{w:innerWidth,h:innerHeight}, active:document.activeElement.tagName}; }""")
        check("M2.1", panel["open"] and panel["panel"]["y"] >= 0 and panel["panel"]["bottom"] <= 844, f"panel={panel['panel']} viewport={panel['viewport']}")
        check("M2.2", len(panel["links"]) == 5, f"more links={[(x['text'],x['href']) for x in panel['links']]}")
        check("M2.3", all(x["h"] >= 48 for x in panel["links"]), f"heights={[x['h'] for x in panel['links']]}")
        check("M2.4", panel["summary"]["h"] >= 64, f"summary h={panel['summary']['h']}")
        shot(m, "mobile-390-more-open")
        m.keyboard.press("Escape")
        m.wait_for_timeout(300)
        esc = m.evaluate("""() => ({open:document.querySelector('.mc-mobile-nav__more').open, active:document.activeElement.tagName, text:document.activeElement.innerText})""")
        check("M2.5", esc["open"] is False and esc["active"] == "SUMMARY", f"after Escape={esc}")
        m.locator(".mc-mobile-nav__more summary").click()
        m.wait_for_timeout(250)
        m.mouse.click(5, 300)
        m.wait_for_timeout(300)
        outside = m.evaluate("() => document.querySelector('.mc-mobile-nav__more').open")
        check("M2.6", outside is False, f"open after outside click={outside}")

        # Mobile nav to Caja
        m.locator('.mc-mobile-nav a[href="/caja"]').click()
        m.wait_for_url("**/caja", timeout=15000)
        m.wait_for_timeout(900)
        d = snap(m, "mobile-caja-empty")
        check("M3.1", d["currentVisible"] == 1 and d["current"][0]["text"] == "Caja", f"current={[(x['text'],x['visible'],x['nav']) for x in d['current']]}")
        check("M3.2", d["activeElement"]["tag"] == "BODY", f"focus after nav={d['activeElement']}")
        shot(m, "mobile-390-caja-empty")
        add_item(m, "Auditoria movil", "1", "10")
        m.wait_for_timeout(500)
        d = snap(m, "mobile-caja-with-item")
        paybar = element_rect(m, ".mc-caja-paybar")
        navr = element_rect(m, ".mc-mobile-nav")
        check("M3.3", paybar is not None and navr is not None and paybar["bottom"] <= navr["y"] + 1, f"paybar={paybar} nav={navr}")
        check("M3.4", d["overflow"]["horizontal"] is False, f"overflow={d['overflow']}")
        shot(m, "mobile-390-caja-paybar")

        scroll_bottom(m)
        bottom = m.evaluate("""() => { const note=document.querySelector('.mc-caja-footnote'); const nav=document.querySelector('.mc-mobile-nav'); const r=note.getBoundingClientRect(); const n=nav.getBoundingClientRect(); const main=document.querySelector('main'); return {note:{top:r.top,bottom:r.bottom},navTop:n.top, mainPad:getComputedStyle(main).paddingBottom, atBottom: Math.abs((innerHeight+scrollY)-document.documentElement.scrollHeight)<3}; }""")
        check("M3.5", bottom["note"]["bottom"] <= bottom["navTop"] + 2, f"footnote behind nav? {bottom}")
        shot(m, "mobile-390-caja-bottom")

        goto(m, "/ventas", 1000)
        d = snap(m, "mobile-ventas")
        check("M4.1", d["currentVisible"] == 1 and d["current"][0]["text"] == "Ventas", f"current={[(x['text'],x['visible'],x['nav']) for x in d['current']]}")
        scroll_bottom(m)
        vbottom = m.evaluate("""() => { const note=document.querySelector('.mc-ventas-note'); const nav=document.querySelector('.mc-mobile-nav'); if(!note) return null; const r=note.getBoundingClientRect(); const n=nav.getBoundingClientRect(); return {note:{top:r.top,bottom:r.bottom},navTop:n.top,mainPad:getComputedStyle(document.querySelector('main')).paddingBottom}; }""")
        check("M4.2", vbottom is None or vbottom["note"]["bottom"] <= vbottom["navTop"] + 2, f"ventas note behind nav? {vbottom}")
        shot(m, "mobile-390-ventas")

        # mobile legacy jump from Ventas via nav
        goto(m, "/inicio", 900)
        m.locator(".mc-mobile-nav__more summary").click()
        m.wait_for_timeout(250)
        m.locator('.mc-mobile-nav__panel a[href="/corte"]').click()
        m.wait_for_timeout(1800)
        d = snap(m, "mobile-corte-via-more")
        check("M5.1", "tab=corte" in d["url"] and d["shell"]["legacy"] and not d["shell"]["new"], f"url={d['url']} legacy={d['shell']['legacy']} new={d['shell']['new']}")
        check("M5.2", d["currentVisible"] == 0, f"aria-current visible={d['currentVisible']}")
        check("M5.3", d["shell"]["legacyTabsVisible"], f"legacyTabs={d['shell']['legacyTabsVisible']}")
        shot(m, "mobile-390-legacy-corte")
        m.go_back(wait_until="domcontentloaded")
        m.wait_for_timeout(900)
        d = snap(m, "mobile-back-from-legacy")
        check("M5.4", "/inicio" in d["url"] and d["shell"]["new"], f"back url={d['url']} new={d['shell']['new']}")

        # Mobile 320
        m.set_viewport_size({"width": 320, "height": 640})
        for path in ["/inicio", "/caja", "/ventas"]:
            goto(m, path, 900)
            d = snap(m, f"mobile-320-{path.strip('/')}")
            check(f"M6.320{path}", d["overflow"]["horizontal"] is False and d["currentVisible"] <= 1, f"overflow={d['overflow']} current={d['currentVisible']} nav={d['shell']['mobileNavVisible']}")
            shot(m, f"mobile-320-{path.strip('/')}")
        # mobile 200% text
        goto(m, "/inicio", 800)
        m.evaluate("document.documentElement.style.fontSize='32px'")
        m.wait_for_timeout(600)
        d = snap(m, "mobile-text200-inicio")
        check("M7.1", d["overflow"]["horizontal"] is False, f"overflow={d['overflow']}")
        shot(m, "mobile-390-text200-inicio")
        goto(m, "/caja", 800)
        m.evaluate("document.documentElement.style.fontSize='32px'")
        m.wait_for_timeout(600)
        d = snap(m, "mobile-text200-caja")
        check("M7.2", d["overflow"]["horizontal"] is False, f"overflow={d['overflow']}")
        shot(m, "mobile-390-text200-caja")
        goto(m, "/ventas", 800)
        m.evaluate("document.documentElement.style.fontSize='32px'")
        m.wait_for_timeout(600)
        d = snap(m, "mobile-text200-ventas")
        check("M7.3", d["overflow"]["horizontal"] is False, f"overflow={d['overflow']}")
        shot(m, "mobile-390-text200-ventas")

        # Mobile 768 new shell boundary
        m.set_viewport_size({"width": 768, "height": 1024})
        goto(m, "/inicio", 900)
        d = snap(m, "mobile-768-inicio")
        check("M8.1", d["shell"]["sidebarVisible"] and not d["shell"]["mobileNavVisible"], f"sidebar={d['shell']['sidebarVisible']} mobile={d['shell']['mobileNavVisible']}")
        shot(m, "mobile-768-inicio")

        mctx.close()
        ctx.close()
        browser.close()

    payload = {
        "base": BASE,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "results": RESULTS,
        "snapshots": SNAPS,
        "screenshots": SHOTS,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
    }
    (OUT / "shell-audit.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = {
        "total": len(RESULTS),
        "pass": sum(1 for r in RESULTS if r["ok"] is True),
        "fail": sum(1 for r in RESULTS if r["ok"] is False),
        "info": sum(1 for r in RESULTS if r["ok"] is None),
        "fails": [r for r in RESULTS if r["ok"] is False],
    }
    (OUT / "shell-audit-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nSUMMARY", summary["pass"], "PASS /", summary["fail"], "FAIL /", summary["info"], "INFO")
    for r in summary["fails"]:
        print("FAIL", r["id"], "-", r["detail"])
    print("console errors:", len(console_errors), console_errors[:5])
    print("page errors:", len(page_errors), page_errors[:5])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
