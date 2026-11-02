"""Medición móvil reproducible: CPU 4x + Slow 3G en Chromium (Playwright).

Uso:
  python scripts/perf-mobile.py                     # http://localhost:3154/
  python scripts/perf-mobile.py URL etiqueta salida.json

Guarda un JSON con FCP/LCP/TBT/CLS, peso por tipo y las peticiones. No levanta
el servidor: apúntalo al build de producción en :3154 con DB temporal.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3154/"
LABEL = sys.argv[2] if len(sys.argv) > 2 else "mobile"
OUT = Path(sys.argv[3]) if len(sys.argv) > 3 else Path("perf-mobile.json")

INIT = """
window.__perf = { lcp: 0, lcpEl: null, cls: 0, longTasks: [] };
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      const t = e.startTime + (e.renderTime || e.loadTime || 0);
      window.__perf.lcp = Math.max(window.__perf.lcp, t);
      const el = e.element;
      if (el) window.__perf.lcpEl = {
        tag: el.tagName,
        cls: (el.className || '').toString().slice(0, 200),
        text: (el.textContent || '').trim().slice(0, 80),
        src: el.currentSrc || el.src || null,
        t,
      };
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
} catch {}
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
} catch {}
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__perf.longTasks.push({ start: e.startTime, dur: e.duration });
  }).observe({ type: 'longtask', buffered: true });
} catch {}
"""


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 360, "height": 800},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            user_agent=(
                "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
            ),
        )
        page = context.new_page()
        cdp = context.new_cdp_session(page)
        cdp.send("Network.enable")
        cdp.send(
            "Network.emulateNetworkConditions",
            {
                "offline": False,
                "latency": 150,
                "downloadThroughput": 204800,  # 1.6 Mbps
                "uploadThroughput": 96000,  # 750 kbps
                "connectionType": "cellular3g",
            },
        )
        cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
        page.add_init_script(INIT)

        started = time.time()
        page.goto(URL, wait_until="load", timeout=120000)
        wall_load_ms = round((time.time() - started) * 1000)
        page.wait_for_timeout(6000)  # deja asentar LCP/CLS y trabajo tardío

        data = page.evaluate(
            """async () => {
              const nav = performance.getEntriesByType('navigation')[0] || {};
              const res = performance.getEntriesByType('resource').map(r => ({
                name: r.name.replace(location.origin, ''),
                type: r.initiatorType,
                transfer: r.transferSize,
                encoded: r.encodedBodySize,
                decoded: r.decodedBodySize,
                duration: r.duration,
              }));
              const byType = {};
              for (const r of res) {
                const k = r.type || 'other';
                byType[k] = byType[k] || { count: 0, transfer: 0 };
                byType[k].count += 1;
                byType[k].transfer += r.transfer;
              }
              const paint = performance.getEntriesByType('paint');
              return {
                fcp: (paint.find(p => p.name === 'first-contentful-paint') || {}).startTime ?? 0,
                domContentLoaded: nav.domContentLoadedEventEnd ?? 0,
                loadEvent: nav.loadEventEnd ?? 0,
                lcp: window.__perf.lcp,
                lcpEl: window.__perf.lcpEl,
                cls: window.__perf.cls,
                longTasks: window.__perf.longTasks,
                tbt: window.__perf.longTasks.reduce((s, t) => s + Math.max(0, t.dur - 50), 0),
                resources: res,
                byType,
                totalTransfer: res.reduce((s, r) => s + r.transfer, 0) + (nav.transferSize || 0),
                htmlTransfer: nav.transferSize || 0,
                domNodes: document.getElementsByTagName('*').length,
              };
            }"""
        )
        data["label"] = LABEL
        data["url"] = URL
        data["wallLoadMs"] = wall_load_ms
        data["timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%S")

        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(data, indent=2), encoding="utf-8")

        print(
            json.dumps(
                {
                    key: data[key]
                    for key in (
                        "label",
                        "fcp",
                        "lcp",
                        "cls",
                        "tbt",
                        "domContentLoaded",
                        "loadEvent",
                        "totalTransfer",
                        "htmlTransfer",
                        "domNodes",
                    )
                },
                indent=2,
            )
        )
        print("byType:", json.dumps(data["byType"], indent=2))
        print("lcpEl:", json.dumps(data["lcpEl"], ensure_ascii=False))
        print(f"JSON: {OUT}")
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
