#!/usr/bin/env python3
"""Chequeo estable de /ventas sobre la copia 3210 (sin escritores concurrentes)."""
from __future__ import annotations

import json
import os
import sqlite3
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3210").rstrip("/")
ROOT = Path(__file__).resolve().parents[3]
DB = Path(os.environ["COPY_DB"])
OUT = Path(__file__).resolve().parent
RESULTS: list[dict] = []


def check(name: str, ok: bool, detail: str = "", severity: str = "") -> None:
    RESULTS.append({"name": name, "ok": bool(ok), "detail": detail, "severity": severity})
    print(f"{'PASS' if ok else 'FAIL'}  {name} | {detail}")


def db_one(sql: str, params: tuple = ()) -> dict | None:
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        row = con.execute(sql, params).fetchone()
        return dict(row) if row else None
    finally:
        con.close()


def money(cents: int) -> str:
    return f"${cents / 100:,.2f}"


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 1000}, locale="es-MX")
        page.goto(BASE + "/ventas", wait_until="networkidle")
        page.wait_for_timeout(500)
        cards = [page.locator(".mc-ventas-stats article").nth(i).inner_text() for i in range(3)]
        page.screenshot(path=str(OUT / "pagos-ventas-stable.png"), full_page=True)
        with page.expect_response(lambda response: "/api/dashboard" in response.url, timeout=10_000) as info:
            page.evaluate("() => fetch('/api/dashboard', {cache:'no-store'}).then(r => r.json())")
        dashboard = info.value.json()
        browser.close()

    summary = dashboard.get("summary", {})
    pending = db_one(
        """SELECT COALESCE(SUM(MAX(total_cents - paid_cents - credit_cents, 0)), 0) AS total
           FROM orders
           WHERE status IN ('confirmed','payment_pending','partially_paid')
             AND MAX(total_cents - paid_cents - credit_cents, 0) > 0"""
    )
    demo_credit = db_one(
        "SELECT COALESCE(SUM(amount_cents),0) total FROM credit_payments WHERE demo = 1 AND method = 'cash'"
    )
    expected = {
        "sales": money(int(summary.get("salesCents", 0))),
        "collected": money(int(summary.get("cashCents", 0)) + int(summary.get("verifiedDigitalCents", 0))),
        "pending": money(int(pending["total"]) if pending else 0),
        "demo_credit_cash": money(int(demo_credit["total"]) if demo_credit else 0),
        "cashCents": int(summary.get("cashCents", 0)),
        "demoCashCents": int(summary.get("demoCashCents", 0)),
    }
    check("E1 Ventas hoy coincide con el servidor", expected["sales"] in cards[0], f"{expected['sales']} vs {cards[0]}")
    check("E2 Cobrado confirmado coincide con el servidor", expected["collected"] in cards[1], f"{expected['collected']} vs {cards[1]}")
    check("E3 Por cobrar digital coincide con la deuda viva", expected["pending"] in cards[2], f"{expected['pending']} vs {cards[2]}")
    check(
        "E4 Cobrado confirmado no debe incluir abonos demo",
        expected["demo_credit_cash"] == "$0.00" or expected["demo_credit_cash"] not in cards[1],
        json.dumps(expected),
        severity="P1",
    )
    check(
        "E5 cashCents del servidor no debe incluir abonos demo",
        expected["cashCents"] == 0,
        json.dumps(expected),
        severity="P1",
    )

    failed = [item for item in RESULTS if not item["ok"]]
    payload = {
        "base": BASE,
        "db": str(DB),
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "cards": cards,
        "expected": expected,
        "summary": summary,
        "results": RESULTS,
        "pass": len(RESULTS) - len(failed),
        "fail": len(failed),
    }
    (OUT / "pagos-ventas-stable.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nVENTAS STABLE: {len(RESULTS) - len(failed)} PASS / {len(failed)} FAIL")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
