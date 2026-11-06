"""Guide/settings regression. No financial writes or model responses are mocked."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3317")
OUT = Path("../harness/evidence/exact-parity/help")
OUT.mkdir(parents=True, exist_ok=True)
checks = []
AXE = Path("node_modules/axe-core/axe.min.js")


def audit(page, name):
    page.add_script_tag(content=AXE.read_text(encoding="utf-8"))
    violations = page.evaluate("""async () => (await axe.run(document.querySelector('main'), {
        runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}
    })).violations.map(v => ({id:v.id, nodes:v.nodes.map(n=>n.target)}))""")
    check(name + ": axe WCAG", not violations)


def check(name, condition):
    checks.append({"name": name, "pass": bool(condition)})
    assert condition, name


with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in [1448, 390, 320]:
        context = browser.new_context(viewport={"width": width, "height": 1086 if width == 1448 else 844})
        page = context.new_page()
        errors, mutations = [], []
        page.on("pageerror", lambda e: errors.append(str(e)))

        def guard(route):
            if route.request.method != "GET":
                mutations.append(route.request.url)
                route.abort()
            else:
                route.continue_()

        page.route("**/api/**", guard)
        page.add_init_script("navigator.mediaDevices.getUserMedia = async () => { window.micRequested = true; throw Error('unexpected microphone'); }")
        for route in ["ayuda", "ajustes"]:
            page.goto(f"{BASE}/{route}")
            page.wait_for_load_state("networkidle")
            check(f"{route}/{width}: single h1", page.locator("h1").count() == 1)
            check(f"{route}/{width}: no overflow", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
            audit(page, f"{route}/{width}")
            page.screenshot(path=str(OUT / f"{route}-{width}.png"), full_page=True)
            page.add_style_tag(content="html {font-size:200% !important}")
            check(f"{route}/{width}: text200 reflow", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
            page.screenshot(path=str(OUT / f"{route}-{width}-text200.png"), full_page=True)
        switch = page.get_by_role("switch", name="Asistente opcional")
        check(f"{width}: opt-in default", switch.get_attribute("aria-checked") == "false")
        switch.focus()
        page.keyboard.press("Space")
        check(f"{width}: keyboard opt-in", switch.get_attribute("aria-checked") == "true")
        page.get_by_role("button", name="Grande", exact=True).click()
        check(f"{width}: text applies", page.locator("html").get_attribute("data-text-size") == "large")
        page.get_by_role("button", name="Alto", exact=True).click()
        check(f"{width}: contrast applies", page.locator("html").get_attribute("data-contrast") == "high")
        page.get_by_role("button", name="Lenta", exact=True).click()
        page.get_by_role("button", name="Silenciada", exact=True).click()
        page.get_by_role("button", name="Leer esta pantalla", exact=True).click()
        check(f"{width}: muted speech feedback", "La voz está silenciada" in page.locator(".mc-ajustes-feedback").inner_text())
        page.reload()
        page.wait_for_load_state("networkidle")
        check(f"{width}: settings survive reload", page.get_by_role("button", name="Grande", exact=True).get_attribute("aria-pressed") == "true" and page.get_by_role("button", name="Lenta", exact=True).get_attribute("aria-pressed") == "true")
        page.goto(BASE + "/ayuda#asistente")
        page.wait_for_load_state("networkidle")
        check(f"{width}: assistant persisted across routes", page.get_by_role("switch", name="Asistente opcional").get_attribute("aria-checked") == "true")
        check(f"{width}: assistant touch targets", all(b["height"] >= 48 for b in page.locator(".mc-assistant button").evaluate_all("els => els.map(el => ({height:el.getBoundingClientRect().height}))")))
        for title, destination in [("¿Cómo van mis ventas?", "/ventas"), ("¿Qué me falta pagar?", "/pendientes"), ("Sugerencias de compra", "/pendientes"), ("Explicarme un reporte", "/corte")]:
            page.get_by_role("button", name=title, exact=True).click()
            check(f"{width}: {title} source + real route", page.locator(".mc-assistant-source").is_visible() and page.locator(".mc-assistant-answer a").get_attribute("href") == destination)
        page.get_by_role("textbox", name="Escribe tu pregunta").fill("¿Qué es el fiado?")
        page.get_by_role("button", name="Consultar", exact=True).click()
        check(f"{width}: written question", "Fiados" in page.locator(".mc-assistant-answer").inner_text())
        page.get_by_role("textbox", name="Escribe tu pregunta").fill("¿Lloverá mañana?")
        page.get_by_role("button", name="Consultar", exact=True).click()
        check(f"{width}: honest unknown", "No encontré" in page.locator(".mc-assistant-answer").inner_text())
        check(f"{width}: HC + large text reflow", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        audit(page, f"assistant/{width}/HC+large")
        page.screenshot(path=str(OUT / f"assistant-{width}-high-large.png"), full_page=True)
        # Fixed guide must remain usable after the page is loaded without a network.
        context.set_offline(True)
        page.get_by_role("button", name="Explicarme un reporte", exact=True).click()
        check(f"{width}: local guide works offline", "efectivo esperado" in page.locator(".mc-assistant-answer").inner_text())
        page.get_by_role("switch", name="Asistente opcional").click()
        check(f"{width}: opt-out hides query", page.get_by_role("textbox", name="Escribe tu pregunta").count() == 0)
        faq = page.get_by_role("button", name="¿Cuándo está pagado?", exact=True)
        faq.click()
        check(f"{width}: FAQ independent", faq.get_attribute("aria-expanded") == "true")
        context.set_offline(False)
        page.reload()
        page.wait_for_load_state("networkidle")
        check(f"{width}: opt-out persists", page.get_by_role("switch", name="Asistente opcional").get_attribute("aria-checked") == "false")
        check(f"{width}: no API mutations", not mutations)
        check(f"{width}: no microphone request", not page.evaluate("Boolean(window.micRequested)"))
        check(f"{width}: no JS errors", not errors)
        context.close()
    # Storage-denied session: no crash, switch still changes the local guide.
    context = browser.new_context()
    context.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new DOMException('Denied', 'SecurityError')}})")
    page = context.new_page()
    page.goto(BASE + "/ayuda")
    page.wait_for_load_state("networkidle")
    page.get_by_role("switch", name="Asistente opcional").click()
    check("storage denied: session opt-in", page.get_by_role("textbox", name="Escribe tu pregunta").is_visible())
    context.close()
    context = browser.new_context()
    first, second = context.new_page(), context.new_page()
    first.goto(BASE + "/ayuda")
    second.goto(BASE + "/ajustes")
    first.wait_for_load_state("networkidle")
    second.wait_for_load_state("networkidle")
    second.get_by_role("switch", name="Asistente opcional").click()
    first.get_by_role("textbox", name="Escribe tu pregunta").wait_for()
    check("two tabs: opt-in sync", first.get_by_role("switch", name="Asistente opcional").get_attribute("aria-checked") == "true")
    first.get_by_role("switch", name="Asistente opcional").click()
    second.wait_for_function("document.querySelector('[role=switch]').getAttribute('aria-checked') === 'false'")
    check("two tabs: opt-out sync", second.get_by_role("switch", name="Asistente opcional").get_attribute("aria-checked") == "false")
    context.close()
    browser.close()

(OUT / "checks.json").write_text(json.dumps({"base": BASE, "checks": checks}, indent=2), encoding="utf-8")
print(f"HELP UI: {len(checks)} PASS / 0 FAIL")
