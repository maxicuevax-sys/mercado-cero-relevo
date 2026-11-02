#!/usr/bin/env python3
"""QA móvil de gama baja: 320 y 360 px en Chromium, Firefox y WebKit.

Comprueba dos regresiones concretas del QA:
  - Los labels de la tab bar no bajan de 12 px ni se recortan.
  - “Registrar abono” (Fiado) queda visible y enfocable, sin taparse con la
    tab bar; se verifica con elementFromPoint y foco de teclado.

Requiere un servidor aislado ya levantado (nunca :3000):

  python scripts/mobile-320-e2e.py
  P0_BASE_URL=http://localhost:3170 python scripts/mobile-320-e2e.py

El pass de Chromium aplica CPU 6x y Slow 3G (CDP). Escribe evidencia y
capturas en harness/evidence/.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = os.environ.get("P0_BASE_URL", "http://localhost:3101").rstrip("/")
PORT = urlparse(BASE).port or 80
if PORT == 3000:
    raise SystemExit("mobile-320-e2e se niega a correr contra :3000.")
if "localhost" not in BASE and "127.0.0.1" not in BASE:
    raise SystemExit("mobile-320-e2e exige un servidor local aislado.")

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "harness" / "evidence"
OUT.mkdir(parents=True, exist_ok=True)
JSON_OUT = OUT / "mobile-320-e2e.json"

results: list[dict] = []
screenshots: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")


def reset(client, engine: str) -> None:
    headers = {"x-forwarded-for": f"198.51.100.{20 + len(results) % 200}"}
    response = client.post(f"{BASE}/api/demo/reset", headers=headers)
    if not response.ok:
        raise RuntimeError(f"demo/reset {engine}: {response.status} {response.text()}")


def seed_credits(client, engine: str) -> None:
    stamp = int(time.time() * 1000)
    for index in range(7):
        payload = {
            "items": [
                {
                    "description": f"Quesadilla {index}",
                    "quantity": 1,
                    "unitPriceCents": 3500,
                }
            ],
            "creditCents": 3500,
            "customerName": f"Cliente {engine} {index}",
            "requestId": f"qa320-{engine}-{stamp}-{index}",
        }
        response = client.post(
            f"{BASE}/api/orders",
            data=json.dumps(payload),
            headers={"Content-Type": "application/json"},
        )
        if not response.ok:
            raise RuntimeError(f"seed {engine}: {response.status} {response.text()}")


def apply_throttle(page) -> None:
    cdp = page.context.new_cdp_session(page)
    cdp.send("Network.enable")
    cdp.send(
        "Network.emulateNetworkConditions",
        {
            "offline": False,
            "latency": 400,
            "downloadThroughput": int(400 * 1024 / 8),
            "uploadThroughput": int(400 * 1024 / 8),
            "connectionType": "cellular3g",
        },
    )
    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 6})


def measure(page) -> dict:
    return page.evaluate(
        """() => {
            const bar = document.querySelector('.mobile-tabs');
            const br = bar ? bar.getBoundingClientRect() : null;
            const labels = Array.from(document.querySelectorAll('.mobile-tabs button')).map((button) => {
                const label = button.querySelector('.mobile-tab-label');
                const buttonRect = button.getBoundingClientRect();
                const labelRect = label ? label.getBoundingClientRect() : null;
                return {
                    text: label ? label.textContent.trim() : '',
                    size: label ? parseFloat(getComputedStyle(label).fontSize) : 0,
                    buttonWidth: Math.round(buttonRect.width),
                    labelWidth: labelRect ? Math.round(labelRect.width) : 0,
                    fits: Boolean(labelRect && labelRect.width <= buttonRect.width - 2),
                };
            });
            return {
                innerWidth: window.innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                tabTop: br ? Math.round(br.top) : null,
                tabHeight: br ? Math.round(br.height) : null,
                labels,
            };
        }"""
    )


def fiado_cta(page) -> dict:
    return page.evaluate(
        """() => {
            const main = document.getElementById('main');
            const tab = document.querySelector('.mobile-tabs');
            const tabRect = tab.getBoundingClientRect();
            const buttons = Array.from(document.querySelectorAll('button'))
                .filter((button) => (button.textContent || '').trim() === 'Registrar abono');
            const button = buttons[buttons.length - 1];
            if (!button) return { found: false };
            button.scrollIntoView({ block: 'center' });
            const rect = button.getBoundingClientRect();
            const cx = Math.round(rect.left + rect.width / 2);
            const cy = Math.round(rect.top + rect.height / 2);
            const hit = document.elementFromPoint(cx, cy);
            const hitButton = hit ? hit.closest('button') : null;
            return {
                found: true,
                count: buttons.length,
                top: Math.round(rect.top),
                bottom: Math.round(rect.bottom),
                tabTop: Math.round(tabRect.top),
                tabHeight: Math.round(tabRect.height),
                aboveTab: rect.top >= 0 && rect.bottom <= tabRect.top + 1,
                status: document.activeElement === button ? 'focused' : 'not-focused',
                hitText: hitButton ? (hitButton.textContent || '').trim().slice(0, 40) : '',
                hitIsCta: Boolean(hitButton && (hitButton.textContent || '').trim() === 'Registrar abono'),
                hitTag: hit ? hit.tagName : null,
                mainScrollTop: main ? Math.round(main.scrollTop) : null,
                mainScrollHeight: main ? main.scrollHeight : null,
                mainClientHeight: main ? main.clientHeight : null,
                scrollPaddingBottom: main ? getComputedStyle(main).scrollPaddingBottom : null,
            };
        }"""
    )


def run_engine(browser_type, engine: str) -> None:
    browser = browser_type.launch(headless=True)
    try:
        for width, height in ((320, 640), (360, 800)):
            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=2,
                locale="es-MX",
            )
            page = context.new_page()
            page.set_default_timeout(30_000)
            if engine == "chromium":
                apply_throttle(page)
            reset(context.request, f"{engine}{width}")
            seed_credits(context.request, f"{engine}{width}")
            page.goto(BASE, wait_until="domcontentloaded")
            page.wait_for_selector("h1:has-text('Caja')", timeout=30_000)
            page.wait_for_selector("text=Hoy $", timeout=30_000)
            page.wait_for_timeout(900)

            data = measure(page)
            shot = OUT / f"mobile-{width}-{engine}.png"
            page.screenshot(path=str(shot))
            screenshots.append(str(shot))
            sizes = [label["size"] for label in data["labels"]]
            check(
                f"{engine} {width}: cinco labels >= 12 px",
                len(sizes) == 5 and all(size >= 12 for size in sizes),
                json.dumps(data["labels"], ensure_ascii=False),
            )
            check(
                f"{engine} {width}: ningún label se recorta",
                all(label["fits"] for label in data["labels"]),
                json.dumps(data["labels"], ensure_ascii=False),
            )
            check(
                f"{engine} {width}: sin scroll horizontal",
                data["scrollWidth"] <= data["innerWidth"] + 1,
                f"{data['scrollWidth']}/{data['innerWidth']}",
            )

            fiado_tab = page.get_by_role("button", name="Fiado", exact=True).first
            for _ in range(4):
                fiado_tab.click(force=True)
                page.wait_for_timeout(300)
                if fiado_tab.get_attribute("aria-current") == "page":
                    break
            page.locator(".credit-row").nth(4).wait_for(state="visible", timeout=20_000)
            page.wait_for_timeout(400)
            cta = fiado_cta(page)
            check(
                f"{engine} {width}: Registrar abono existe",
                cta.get("found") is True,
                json.dumps(cta, ensure_ascii=False),
            )
            check(
                f"{engine} {width}: elementFromPoint cae en Registrar abono",
                cta.get("hitIsCta") is True,
                json.dumps(cta, ensure_ascii=False),
            )
            check(
                f"{engine} {width}: Registrar abono queda sobre la tab bar",
                cta.get("aboveTab") is True,
                f"bottom={cta.get('bottom')} tabTop={cta.get('tabTop')}",
            )

            page.get_by_role("button", name="Registrar abono").last.focus()
            page.wait_for_timeout(200)
            focused = page.evaluate(
                """() => {
                    const tab = document.querySelector('.mobile-tabs').getBoundingClientRect();
                    const el = document.activeElement;
                    const rect = el ? el.getBoundingClientRect() : null;
                    return {
                        isCta: Boolean(el && (el.textContent || '').trim() === 'Registrar abono'),
                        top: rect ? Math.round(rect.top) : null,
                        bottom: rect ? Math.round(rect.bottom) : null,
                        tabTop: Math.round(tab.top),
                        visible: Boolean(rect && rect.top >= 0 && rect.bottom <= tab.top + 1),
                    };
                }"""
            )
            check(
                f"{engine} {width}: foco de teclado deja el CTA visible",
                focused["isCta"] and focused["visible"],
                json.dumps(focused, ensure_ascii=False),
            )
            page.screenshot(path=str(OUT / f"mobile-{width}-{engine}-fiado.png"))
            screenshots.append(str(OUT / f"mobile-{width}-{engine}-fiado.png"))
            context.close()
    finally:
        browser.close()


def main() -> int:
    started = datetime.now(timezone.utc)
    with sync_playwright() as p:
        run_engine(p.chromium, "chromium")
        run_engine(p.firefox, "firefox")
        run_engine(p.webkit, "webkit")

    passed = sum(1 for item in results if item["ok"])
    failed = sum(1 for item in results if not item["ok"])
    payload = {
        "schemaVersion": 1,
        "suite": "mobile-320-e2e",
        "baseUrl": BASE,
        "startedAt": started.isoformat(),
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "throttle": "chromium: CPU 6x + Slow 3G (400 kbps, 400 ms)",
        "screenshots": screenshots,
        "summary": {"pass": passed, "fail": failed, "total": len(results)},
        "results": results,
    }
    JSON_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nMOBILE 320/360 E2E · {passed} PASS · {failed} FAIL")
    print(f"EVIDENCIA {JSON_OUT}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
