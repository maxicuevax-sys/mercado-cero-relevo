#!/usr/bin/env python3
"""Capturas deterministas del onboarding de 4 pasos.

Uso (desde web/, con el servidor ya levantado):
    BASE_URL=http://127.0.0.1:4498 python scripts/onboarding-capture.py

Escribe PNG y captures.json en quality-reports/onboarding-oc/. No toca el
servidor 4497 ni los worktrees A/B.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("BASE_URL", "http://localhost:4498").rstrip("/")
OUT = Path(os.environ.get("ONBOARDING_OUT", ROOT / "quality-reports" / "onboarding-oc"))
OUT.mkdir(parents=True, exist_ok=True)

PROFILE_KEY = "mercado-cero:onboarding:v1"


def wait_ready(page) -> None:
    last = None
    for _ in range(80):
        try:
            page.goto(BASE + "/onboarding", wait_until="domcontentloaded", timeout=3000)
            return
        except Exception as exc:  # server still compiling
            last = exc
            page.wait_for_timeout(500)
    raise RuntimeError(f"servidor no disponible en {BASE}: {last}")


def metrics(page) -> dict:
    return page.evaluate(
        """() => {
          const shell = document.querySelector('.onb-shell');
          const progress = document.querySelector('.onb-progress');
          const title = document.querySelector('.onb-title');
          const label = document.querySelector('.onb-progress-label');
          const cta = document.querySelector('.onb-cta');
          const pr = progress?.getBoundingClientRect();
          const cr = cta?.getBoundingClientRect();
          return {
            title: title?.textContent?.replace(/\\s+/g, ' ').trim() || null,
            stepLabel: label?.textContent?.replace(/\\s+/g, ' ').trim() || null,
            viewport: { width: innerWidth, height: innerHeight },
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
            shellOverflow: shell ? shell.scrollHeight > shell.clientHeight + 1 : null,
            progressBottom: pr ? Math.round(pr.bottom) : null,
            ctaBottom: cr ? Math.round(cr.bottom) : null,
            progressVisible: pr ? pr.top >= 0 && pr.bottom <= innerHeight + 1 : false,
            ctaVisible: cr ? cr.top >= 0 && cr.bottom <= innerHeight + 1 : false,
            dots: document.querySelectorAll('.onb-dot').length,
            heading: document.querySelector('h1')?.textContent?.replace(/\\s+/g, ' ').trim() || null,
          };
        }"""
    )


def run_viewport(browser, width: int, height: int) -> list[dict]:
    context = browser.new_context(viewport={"width": width, "height": height}, locale="es-MX")
    page = context.new_page()
    api_requests: list[str] = []
    page.on(
        "request",
        lambda request: api_requests.append(request.url)
        if "/api/" in request.url
        else None,
    )
    wait_ready(page)
    page.evaluate(f"localStorage.removeItem('{PROFILE_KEY}')")
    page.goto(BASE + "/onboarding", wait_until="networkidle")
    page.evaluate("document.fonts.ready")

    rows: list[dict] = []

    def shot(name: str) -> None:
        page.wait_for_timeout(220)
        page.wait_for_function(
            "() => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0)"
        )
        path = OUT / f"{name}_{width}x{height}.png"
        page.screenshot(path=str(path))
        rows.append({"shot": str(path.relative_to(ROOT)), **metrics(page)})

    shot("onboarding_01_bienvenida")

    page.get_by_role("button", name="Empezar").click()
    page.wait_for_timeout(120)

    # El foco pasa al encabezado del paso, no se queda en el botón anterior.
    focus_after_next = page.evaluate(
        "() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.replace(/\\s+/g,' ').trim() })"
    )

    # Validación real: sin nombre no avanza y el error se anuncia.
    page.get_by_role("button", name="Continuar").click()
    page.wait_for_timeout(120)
    validation = {
        "stillStep2": "Conozcamos" in page.locator("h1").inner_text(),
        "alert": page.locator(".onb-error").inner_text()
        if page.locator(".onb-error").count()
        else None,
    }

    page.get_by_label("¿Cómo se llama tu negocio?").fill("Antojitos de Lupita")
    page.get_by_label("¿A qué te dedicas?").select_option("Comida / Antojitos")
    page.wait_for_timeout(220)
    shot("onboarding_02_negocio")

    page.get_by_role("button", name="Continuar").click()
    page.wait_for_timeout(260)
    shot("onboarding_03_primera_venta")

    # Atrás y de nuevo adelante sin perder los datos.
    page.get_by_role("button", name="Atrás").click()
    page.wait_for_timeout(160)
    back = {
        "returnedToStep2": "Conozcamos" in page.locator("h1").inner_text(),
        "name": page.get_by_label("¿Cómo se llama tu negocio?").input_value(),
    }
    page.get_by_role("button", name="Continuar").click()
    page.wait_for_timeout(160)

    page.get_by_role("button", name="Registrar venta").click()
    page.wait_for_timeout(260)
    shot("onboarding_04_listo")

    raw = page.evaluate(f"localStorage.getItem('{PROFILE_KEY}')")
    profile = json.loads(raw) if raw else None
    links = page.eval_on_selector_all(
        "a[href]", "els => els.map(e => e.getAttribute('href'))"
    )
    touch = page.evaluate(
        """() => Array.from(document.querySelectorAll('button, a'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden';
          })
          .map((el) => ({ label: el.textContent?.replace(/\\s+/g, ' ').trim(), height: Math.round(el.getBoundingClientRect().height) }))"""
    )

    # Persistencia: recargar y comprobar que el paso 2 vuelve con los datos.
    page.reload(wait_until="networkidle")
    page.get_by_role("button", name="Empezar").click()
    page.wait_for_timeout(150)
    persisted = {
        "name": page.get_by_label("¿Cómo se llama tu negocio?").input_value(),
        "giro": page.get_by_label("¿A qué te dedicas?").input_value(),
    }

    context.close()
    return [
        {
            "viewport": f"{width}x{height}",
            "shots": rows,
            "profile": profile,
            "profileKey": PROFILE_KEY,
            "persistedAfterReload": persisted,
            "validation": validation,
            "back": back,
            "focusAfterNext": focus_after_next,
            "touchTargets": touch,
            "finalLinks": links,
            "apiRequests": api_requests,
            "demoNotPaid": bool(profile)
            and profile.get("sampleSale", {}).get("kind") == "onboarding-demo"
            and "paid" not in profile.get("sampleSale", {}),
        }
    ]


def main() -> None:
    report: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for width, height in ((390, 693), (941, 1672)):
            report.extend(run_viewport(browser, width, height))
        browser.close()

    payload = {
        "route": "/onboarding",
        "baseUrl": BASE,
        "source": "references/DEFINITIVE/mobile/onboarding_0*.png",
        "generatedAt": __import__("datetime").datetime.now().astimezone().isoformat(),
        "results": report,
    }
    (OUT / "captures.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    failures = []
    allowed_links = {"/inicio", "/caja", "/fiados", "/corte"}
    for item in report:
        for row in item["shots"]:
            if row["horizontalOverflow"] or not row["progressVisible"] or not row["ctaVisible"]:
                failures.append(f"{item['viewport']} {row['shot']} overflow/CTA/progress")
        if not item["demoNotPaid"]:
            failures.append(f"{item['viewport']} demo sample marked paid or missing")
        if "paid" in json.dumps(item["profile"], ensure_ascii=False):
            failures.append(f"{item['viewport']} profile contains paid")
        if not item["validation"]["stillStep2"] or not item["validation"]["alert"]:
            failures.append(f"{item['viewport']} empty profile advanced without error")
        if not item["back"]["returnedToStep2"]:
            failures.append(f"{item['viewport']} back did not return to step 2")
        if item["back"]["name"] != "Antojitos de Lupita":
            failures.append(f"{item['viewport']} back lost the business name")
        if item["focusAfterNext"]["tag"] != "H1":
            failures.append(f"{item['viewport']} focus did not move to the step heading")
        if any(target["height"] < 44 for target in item["touchTargets"]):
            failures.append(f"{item['viewport']} touch target under 44 px")
        if not set(item["finalLinks"]).issubset(allowed_links):
            failures.append(f"{item['viewport']} invented route in final links")
        if not {"/inicio", "/caja", "/fiados", "/corte"}.issubset(item["finalLinks"]):
            failures.append(f"{item['viewport']} missing real destination in final links")
        if item["apiRequests"]:
            failures.append(f"{item['viewport']} onboarding called an API route")
        if item["persistedAfterReload"]["name"] != "Antojitos de Lupita":
            failures.append(f"{item['viewport']} name not persisted")
        if item["persistedAfterReload"]["giro"] != "Comida / Antojitos":
            failures.append(f"{item['viewport']} giro not persisted")
    print(json.dumps({"ok": not failures, "failures": failures,
                      "shots": sum(len(i["shots"]) for i in report)}, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
