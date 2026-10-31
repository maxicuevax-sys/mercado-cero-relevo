#!/usr/bin/env node
/**
 * Concilia los pagos digitales del día contra pey.
 *
 * Uso:
 *   node scripts/reconcile.mjs
 *
 * Sale con código 1 si hay diferencias. En modo demo no hay nada que conciliar.
 */

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

function money(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

async function main() {
  const response = await fetch(`${BASE}/api/reconcile`, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }

  console.log(`Conciliación · ${body.date}`);

  if (body.demoMode) {
    console.log("Modo demo: no hay transacciones reales de pey.");
    console.log(`Pagos digitales locales: ${money(body.localDigitalCents)} (no conciliables en demo).`);
    return;
  }

  console.log(
    `Local: ${money(body.localDigitalCents)} · pey: ${money(body.peyConfirmedCents)} · Diferencia: ${money(body.differenceCents)}`,
  );
  console.log(
    `Revisados: ${body.checked} · OK: ${body.ok} · Diferencias: ${body.issues}`,
  );

  const issues = body.items.filter((item) => item.status !== "ok");
  for (const item of issues) {
    console.log(
      `- Pedido ${item.orderId} · ${item.transactionId ?? "sin tx"} · ${item.status}: ${item.reason ?? ""}`,
    );
  }

  console.log(body.reconciled ? "RESULTADO: cuadra." : "RESULTADO: hay diferencias.");
  if (!body.reconciled) process.exit(1);
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
