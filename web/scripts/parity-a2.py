"""Read-only A2 capture at CSS viewport sizes; definitive references only.

Run from web. BASE_URL selects the actual server. No fixture data or writes.
"""
import hashlib
import json
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:4497")
PHASE = os.environ.get("CAPTURE_PHASE", "after")
OUT = Path("../harness/evidence/exact-parity/a2")
REF = Path("C:/Users/Public/Documents/MercadoCero-Visual-Sync/references/DEFINITIVE")
OUT.mkdir(parents=True, exist_ok=True)
refs = {"inicio": "01_inicio_941x1672.png", "corte": "06_corte_941x1672.png",
        "metas": "07_metas_941x1672.png", "pendientes": "08_pendientes_941x1672.png"}
rows = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    for route, width, height in [(r, w, h) for r in refs for w, h in [(390, 693), (320, 569)]] + [("inicio", 1448, 1086), ("fiados", 390, 693)]:
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.route("**/api/**", lambda req: req.continue_() if req.request.method == "GET" else req.abort())
        page.goto(f"{BASE}/{route}")
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready")
        page.evaluate("document.activeElement?.blur()")
        name = f"{PHASE}-{route}-{width}x{height}"
        shot = OUT / f"{name}.png"
        page.screenshot(path=str(shot))
        page.screenshot(path=str(OUT / f"{name}-full.png"), full_page=True)
        row = {"route": route, "width": width, "height": height, "baseUrl": BASE,
               "sha256": hashlib.sha256(shot.read_bytes()).hexdigest(), "errors": errors,
               "overflow": page.evaluate("document.documentElement.scrollWidth > innerWidth")}
        page.add_script_tag(path="node_modules/axe-core/axe.min.js")
        row["axe"] = page.evaluate("""async () => (await axe.run(document.querySelector('main'), {
            runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}
        })).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))""")
        if width == 390 and route in refs:
            source = REF / "mobile" / refs[route]
            normalized = Image.open(source).convert("RGB").resize((390, 693), Image.Resampling.LANCZOS)
            normalized.save(OUT / f"reference-{route}-390x693.png")
            actual = Image.open(shot).convert("RGB")
            diff = ImageChops.difference(actual, normalized)
            diff.save(OUT / f"{name}-diff.png")
            Image.blend(actual, normalized, .5).save(OUT / f"{name}-overlay.png")
            row["referenceSha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
            row["meanChannelError"] = sum(ImageStat.Stat(diff).mean) / 3
        if route in refs and width <= 390:
            page.add_style_tag(content="html {font-size:200% !important}")
            row["text200Overflow"] = page.evaluate("document.documentElement.scrollWidth > innerWidth")
            page.screenshot(path=str(OUT / f"{name}-text200.png"), full_page=True)
        rows.append(row)
        page.close()
    health = browser.new_page().request.get(BASE + "/api/health").json()
    browser.close()
report = {"phase": PHASE, "head": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
          "health": health, "engine": "Chromium; emulated CSS viewport, DPR 1; not physical Safari/iOS",
          "referenceNormalization": "941x1672 raster resized to 390x693; OS chrome retained, no UI alignment or crop",
          "captures": rows}
(OUT / f"{PHASE}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(1 if any(r["overflow"] or r.get("text200Overflow") or r["axe"] or r["errors"] for r in rows if r["route"] in refs) else 0)
