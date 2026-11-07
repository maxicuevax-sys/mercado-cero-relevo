#!/usr/bin/env node
/**
 * Prueba real de $0.01 contra pey.
 *
 * 1. Verifica que el modo demo esté apagado.
 * 2. Crea una venta de $0.01.
 * 3. Genera el link real de pey.
 * 4. Espera el webhook y muestra la orden pagada + la conciliación.
 *
 * Uso:
 *   node scripts/pey-smoke.mjs
 *
 * Variables opcionales:
 *   AMOUNT_CENTS=1
 *   TIMEOUT_MS=300000
 */

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const AMOUNT_CENTS = Number(process.env.AMOUNT_CENTS ?? 1);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 5 * 60 * 1000);

function money(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(pathname, init = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function main() {
  if (!Number.isInteger(AMOUNT_CENTS) || AMOUNT_CENTS <= 0) {
    throw new Error("AMOUNT_CENTS debe ser un entero positivo.");
  }

  const dashboard = await request("/api/dashboard");
  if (dashboard.status !== 200) {
    throw new Error(`No hay servidor en ${BASE}.`);
  }
  if (dashboard.body.demoMode) {
    console.error("La app está en modo demo. Falta PEY_API_KEY en .env.local.");
    process.exit(1);
  }

  console.log(`Mercado Cero · prueba real por ${money(AMOUNT_CENTS)}`);

  const created = await request("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          description: "Prueba real Mercado Cero",
          quantity: 1,
          unitPriceCents: AMOUNT_CENTS,
        },
      ],
    }),
  });
  if (created.status !== 201) {
    throw new Error(`No se pudo crear la venta: ${created.status} ${JSON.stringify(created.body)}`);
  }

  const orderId = created.body.order.id;
  const linked = await request(`/api/orders/${orderId}/pay`, {
    method: "POST",
    body: JSON.stringify({ mode: "link" }),
  });
  if (linked.status !== 200) {
    throw new Error(`No se pudo crear el link: ${linked.status} ${JSON.stringify(linked.body)}`);
  }

  const order = linked.body.order;
  console.log("");
  console.log(`Pedido: ${orderId}`);
  console.log(`Monto:  ${money(order.totalCents)}`);
  console.log(`Link:   ${order.paymentUrl}`);
  console.log("");
  console.log("Abre el link y paga con CoDi. Esperando el webhook firmado...");

  const started = Date.now();
  let lastStatus = order.status;

  while (Date.now() - started < TIMEOUT_MS) {
    await sleep(3000);
    const detail = await request(`/api/orders/${orderId}`);
    if (detail.status !== 200) {
      process.stdout.write("!");
      continue;
    }
    const current = detail.body.order;
    if (current.status !== lastStatus) {
      lastStatus = current.status;
      console.log(`\nEstado: ${current.status} · pagado ${money(current.paidCents)}`);
    } else {
      process.stdout.write(".");
    }

    if (current.status === "paid" || current.status === "fulfilled") {
      console.log("\n\nPAGO CONFIRMADO POR WEBHOOK");
      console.log(`Pedido: ${current.id}`);
      console.log(`Total: ${money(current.totalCents)} · pagado: ${money(current.paidCents)}`);
      console.log(`Método: ${current.paymentMethod ?? "desconocido"}`);
      for (const payment of detail.body.payments) {
        console.log(
          `- ${payment.method} · ${money(payment.amountCents)} · ${payment.transactionId ?? "sin tx"}`,
        );
      }

      const report = await request("/api/reconcile");
      console.log("\nConciliación:");
      if (report.status !== 200) {
        console.log(`No se pudo conciliar: ${JSON.stringify(report.body)}`);
      } else if (report.body.demoMode) {
        console.log("Modo demo.");
      } else {
        console.log(
          `Local ${money(report.body.localDigitalCents)} · pey ${money(report.body.peyConfirmedCents)} · diferencia ${money(report.body.differenceCents)}`,
        );
        console.log(
          report.body.reconciled
            ? "Cuadra con pey."
            : `Hay ${report.body.issues} diferencia(s); revisa el detalle en la app.`,
        );
      }

      const issues = detail.body.payments.filter(
        (payment) => payment.status !== "paid",
      );
      if (issues.length > 0) {
        console.log(`\nAtención: ${issues.length} pago(s) no están en estado paid.`);
      }
      return;
    }
  }

  console.error("\n\nTimeout esperando el webhook.");
  console.error("Revisa el historial de webhooks en el portal de pey y el estado del pedido en la app.");
  process.exit(1);
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
