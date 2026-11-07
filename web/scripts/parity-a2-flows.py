"""Bounded functional writes, only on the gate's ephemeral SQLite."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

assert os.environ.get("A2_EPHEMERAL") == "true", "Use parity-a2-gate.mjs, never the shared candidate"
BASE = os.environ["BASE_URL"]
OUT = Path("../harness/evidence/exact-parity/a2")
checks = []


def check(name, condition):
    checks.append({"name": name, "ok": bool(condition)})
    assert condition, name


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 693})
    page.goto(BASE + "/pendientes")
    page.get_by_role("button", name="Nuevo pendiente", exact=True).click()
    title = page.get_by_label("¿Qué quieres recordar?")
    expect(title).to_be_focused()
    title.fill("Recibir pedido A2")
    page.get_by_role("button", name="Guardar tarea", exact=True).click()
    complete = page.get_by_role("button", name="Completar: Recibir pedido A2", exact=True)
    expect(complete).to_be_visible()
    check("task created durably", any(t["title"] == "Recibir pedido A2" for t in page.request.get(BASE + "/api/tasks").json()["tasks"]))
    page.get_by_role("searchbox", name="Buscar pendiente").fill("no coincide")
    expect(complete).to_have_count(0)
    page.get_by_role("searchbox", name="Buscar pendiente").fill("")
    complete.click()
    page.get_by_role("button", name="Completados", exact=True).click()
    reopen = page.get_by_role("button", name="Reabrir", exact=True)
    expect(reopen).to_be_visible()
    check("completion is persisted", any(t["title"] == "Recibir pedido A2" and t["status"] == "done" for t in page.request.get(BASE + "/api/tasks").json()["tasks"]))
    reopen.click()
    page.get_by_role("button", name="Hoy", exact=True).click()
    expect(complete).to_be_visible()
    check("reopen and tab return", True)
    page.goto(BASE + "/metas")
    page.locator(".mc-metas-native").get_by_role("button", name="Nueva meta", exact=True).click()
    dialog = page.get_by_role("dialog")
    check("goal creation dialog opens", dialog.is_visible())
    page.keyboard.press("Escape")
    expect(dialog).to_have_count(0)
    # Create a second real record in the temporary DB, then inspect both cards.
    response = page.request.post(BASE + "/api/goals", headers={"Origin": BASE}, data={"title": "Refrigerador A2", "targetCents": 800000})
    check("second goal supported by existing API", response.ok)
    page.reload()
    expect(page.locator(".mc-metas-native-card")).to_have_count(2)
    check("both saved goals have determined progress", page.locator(".mc-metas-native-card [role=progressbar]").count() == 2)
    page.goto(BASE + "/corte")
    initial = page.request.get(BASE + "/api/cash").json()
    page.get_by_role("button", name="Agregar $500", exact=True).click()
    expect(page.get_by_role("textbox", name="Total contado en pesos")).to_have_value("500.00")
    page.get_by_role("button", name="Monedas", exact=True).click()
    page.get_by_role("button", name="Agregar $10", exact=True).click()
    expect(page.get_by_role("textbox", name="Total contado en pesos")).to_have_value("510.00")
    page.get_by_role("button", name="Billetes", exact=True).click()
    expect(page.get_by_role("spinbutton", name="Cantidad de $500", exact=True)).to_have_value("1")
    check("counts survive denomination tab switch", True)
    page.get_by_role("button", name="Realizar corte", exact=True).click()
    expect(page.get_by_role("dialog")).to_be_visible()
    check("server preview requires final confirmation", page.get_by_role("dialog").get_by_role("button", name="Guardar corte", exact=True).is_visible())
    check("preview did not save a close", page.request.get(BASE + "/api/cash").json().get("saved") == initial.get("saved"))
    browser.close()
(OUT / "flows.json").write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"A2 FLOWS OK: {len(checks)}/{len(checks)}")
