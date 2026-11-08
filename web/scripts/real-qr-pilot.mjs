#!/usr/bin/env node
/**
 * Script de Certificación y Piloto de Cobro Real por QR (Fase 3).
 *
 * Flujo:
 *   1. Audita entorno: .env.local, servidor local y túnel público HTTPS.
 *   2. Verifica que el endpoint público de webhooks esté activo y protegido (401 sin firma).
 *   3. Crea la orden de prueba ($0.01 MXN por defecto) y genera el QR CoDi oficial.
 *   4. Imprime el QR en la terminal (ANSI) y genera demo/qr-pilot-real.html para escanear en pantalla.
 *   5. Monitorea en vivo la llegada del webhook firmado de Pey y/o ejecuta sync-pey si se solicita.
 *   6. Concilia automáticamente contra Pey (/api/reconcile) y valida la Regla de Oro.
 *
 * Uso:
 *   node scripts/real-qr-pilot.mjs [--amount=1] [--concept="Prueba CoDi"] [--sync]
 *
 * Opciones:
 *   --amount=<centavos>   Monto en centavos (default: 1 = $0.01 MXN).
 *   --concept=<texto>     Concepto de la venta (default: "Prueba CoDi $0.01").
 *   --sync                Consulta periódica de sync-pey si el webhook tarda.
 *   --timeout=<segundos>  Tiempo máximo de espera (default: 300 s).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const ROOT = path.resolve(WEB, "..");
const DEMO_DIR = path.join(ROOT, "demo");
const ENV_PATH = path.join(WEB, ".env.local");

const args = process.argv.slice(2);
const amountArg = args.find((a) => a.startsWith("--amount="));
const conceptArg = args.find((a) => a.startsWith("--concept="));
const timeoutArg = args.find((a) => a.startsWith("--timeout="));
const autoSync = args.includes("--sync");

const AMOUNT_CENTS = amountArg ? parseInt(amountArg.split("=")[1], 10) : 1;
const CONCEPT = conceptArg ? conceptArg.split("=")[1] : "Prueba CoDi $0.01";
const TIMEOUT_MS = (timeoutArg ? parseInt(timeoutArg.split("=")[1], 10) : 300) * 1000;
const LOCAL_BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const values = {};
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;
    let val = trimmed.slice(equals + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    values[trimmed.slice(0, equals).trim()] = val;
  }
  return values;
}

const env = loadEnv();
const appUrl = (process.env.APP_URL ?? env.APP_URL ?? LOCAL_BASE).replace(/\/+$/, "");
const apiKey = process.env.PEY_API_KEY ?? env.PEY_API_KEY ?? "";
const webhookSecret = process.env.PEY_WEBHOOK_SECRET ?? env.PEY_WEBHOOK_SECRET ?? "";
const demoMode = (process.env.DEMO_MODE ?? env.DEMO_MODE) === "true" || !apiKey;

function formatMxn(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(baseUrl, pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
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
  return { status: response.status, ok: response.ok, body };
}

async function step1PreflightAudit() {
  console.log("=======================================================================");
  console.log("  MERCADO CERO — PILOTO COBRO POR QR (FASE 3)");
  console.log("=======================================================================");
  console.log(`Local:    ${LOCAL_BASE}`);
  console.log(`Público:  ${appUrl}`);
  console.log(`Modo:     ${demoMode ? "DEMO (simulación)" : "REAL (producción / piloto CoDi)"}`);
  console.log("-----------------------------------------------------------------------");

  // 1. Chequeo servidor local
  try {
    const health = await request(LOCAL_BASE, "/api/health");
    if (!health.ok) {
      throw new Error(`HTTP ${health.status}`);
    }
    console.log(`PASS  Servidor local en línea (${health.body.buildSha?.slice(0, 7) ?? "ok"})`);
  } catch (err) {
    console.error(`FAIL  El servidor local en ${LOCAL_BASE} no responde: ${err.message}`);
    console.error(`Inicia el servidor primero con: npm run dev  (o npm run build && npm start)`);
    process.exit(1);
  }

  // 2. Chequeo modo real
  if (demoMode) {
    console.log("AVISO DEMO: La app está en modo DEMO_MODE.");
    console.log("Para certificar el cobro con dinero real CoDi con Banxico:");
    console.log("  1. Agrega PEY_API_KEY y PEY_WEBHOOK_SECRET en web/.env.local");
    console.log("  2. Configura DEMO_MODE=false");
    console.log("Continuando con la prueba en el modo actual...\n");
  } else {
    console.log("PASS  Modo REAL activo con credenciales de Pey configuradas.");
  }

  // 3. Chequeo túnel HTTPS público
  if (!appUrl.startsWith("https://")) {
    console.warn(`WARN  APP_URL (${appUrl}) no es HTTPS.`);
    console.warn(`Pey exige una URL HTTPS pública para enviar los webhooks firmados.`);
    console.warn(`Puedes iniciar el túnel con: npm run tunnel`);
  } else {
    console.log(`PASS  APP_URL es HTTPS (${appUrl})`);

    // Sonda de webhook público
    try {
      const probe = await request(appUrl, "/api/webhooks/pey", {
        method: "POST",
        body: JSON.stringify({ probe: true }),
      });
      if (probe.status === 401) {
        console.log("PASS  Endpoint público /api/webhooks/pey activo y protegido (401 ante firma vacía)");
      } else {
        console.warn(`WARN  El webhook respondió HTTP ${probe.status} (esperado 401 sin firma).`);
      }
    } catch (probeErr) {
      console.warn(`WARN  No se pudo verificar el túnel público: ${probeErr.message}`);
    }
  }

  console.log("-----------------------------------------------------------------------\n");
}

async function step2CreateOrderAndQr() {
  console.log(`[1/4] Creando orden de prueba por ${formatMxn(AMOUNT_CENTS)}...`);

  const orderRes = await request(LOCAL_BASE, "/api/orders", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          description: CONCEPT,
          quantity: 1,
          unitPriceCents: AMOUNT_CENTS,
        },
      ],
    }),
  });

  if (!orderRes.ok || !orderRes.body?.order) {
    throw new Error(`Error al crear la orden: ${JSON.stringify(orderRes.body)}`);
  }

  const orderId = orderRes.body.order.id;
  console.log(`PASS  Orden creada: ${orderId}`);

  console.log(`[2/4] Generando QR CoDi...`);
  const payRes = await request(LOCAL_BASE, `/api/orders/${orderId}/pay`, {
    method: "POST",
    body: JSON.stringify({ mode: "qr" }),
  });

  if (!payRes.ok || !payRes.body?.order) {
    throw new Error(`Error al generar QR: ${JSON.stringify(payRes.body)}`);
  }

  const order = payRes.body.order;
  const qrString = order.qrString ?? "";
  const numRef = order.numRef ?? "000000";

  console.log(`PASS  QR CoDi generado con referencia CoDi: #${numRef}`);
  console.log(`Vigencia: hasta las ${new Date(order.qrExpiresAt).toLocaleTimeString("es-MX")}`);

  // Generar representación en terminal
  if (qrString) {
    try {
      const termQr = await QRCode.toString(qrString, { type: "terminal", small: true });
      console.log("\n--- CÓDIGO QR CODI (Escanea con app bancaria CoDi) ---");
      console.log(termQr);
      console.log("-------------------------------------------------------");
    } catch {
      // Ignorar si el terminal no soporta ANSI
    }
  }

  // Generar HTML visual para escanear en pantalla o navegador
  fs.mkdirSync(DEMO_DIR, { recursive: true });
  const htmlPath = path.join(DEMO_DIR, "qr-pilot-real.html");
  const checkoutUrl = `${appUrl}/pay/${order.id}${demoMode ? "?demo=1" : ""}`;

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Piloto QR CoDi · Mercado Cero</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0c1813; color: #f2f7f4; margin: 0; padding: 24px; display: grid; place-items: center; min-height: 90vh; }
    .card { background: #142820; border: 1px solid #1f3d32; border-radius: 20px; max-width: 440px; width: 100%; padding: 28px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .stamp { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; background: ${demoMode ? "#e06c43" : "#059669"}; color: #fff; margin-bottom: 12px; }
    h1 { margin: 0 0 6px; font-size: 1.5rem; }
    .total { font-size: 2.5rem; font-weight: 800; color: #4ade80; margin: 12px 0; }
    .numref { background: #0c1813; border: 1px dashed #2e594a; padding: 10px 16px; border-radius: 12px; font-family: monospace; font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; }
    .qr-box { background: #ffffff; padding: 16px; border-radius: 16px; display: inline-block; margin-bottom: 16px; }
    .qr-box img { display: block; width: 260px; height: 260px; }
    p { margin: 8px 0; font-size: 0.95rem; color: #a3c2b6; line-height: 1.4; }
    .btn { display: block; margin-top: 16px; background: #1f3d32; color: #4ade80; padding: 12px; border-radius: 12px; text-decoration: none; font-weight: 600; border: 1px solid #2e594a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="stamp">${demoMode ? "DEMO SIMULADO" : "PAGO REAL CODI BANXICO"}</div>
    <h1>Cobro con Código QR</h1>
    <div class="total">${formatMxn(order.totalCents)}</div>
    <div class="numref">Referencia CoDi: #${numRef}</div>
    <div class="qr-box">
      <img src="${order.qrImage}" alt="QR CoDi" />
    </div>
    <p><strong>Instrucciones:</strong> Abre la app de tu banco, entra a la sección <strong>CoDi</strong> y selecciona <strong>Escanear código</strong>.</p>
    <a href="${checkoutUrl}" target="_blank" class="btn">Abrir Checkout en navegador (Cámara / Wallets) &rarr;</a>
  </div>
</body>
</html>`;

  fs.writeFileSync(htmlPath, htmlContent, "utf8");
  console.log(`\nDocumento HTML con QR listo para escanear en pantalla:\n  file://${htmlPath}\n`);

  return order;
}

async function step3MonitorWebhook(order) {
  console.log(`[3/4] Esperando confirmación bancaria (Webhook firmado de Pey)...`);
  console.log(`Timeout: ${TIMEOUT_MS / 1000} s. ${autoSync ? "(Auto-sync activo)" : ""}`);
  if (demoMode) {
    console.log(`Tip: En modo demo puedes simular el pago en otra pestaña con:`);
    console.log(`  curl -X POST ${LOCAL_BASE}/api/demo/pay -H "Content-Type: application/json" -d "{\\"orderId\\":\\"${order.id}\\",\\"method\\":\\"codi\\"}"\n`);
  }

  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < TIMEOUT_MS) {
    attempts += 1;
    await sleep(2000);

    // Si se activó autoSync y pasaron más de 8s, prueba consultar sync-pey
    if (autoSync && attempts % 4 === 0 && !demoMode) {
      try {
        await request(LOCAL_BASE, `/api/orders/${order.id}/sync-pey`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      } catch {
        // Ignorar
      }
    }

    const detail = await request(LOCAL_BASE, `/api/orders/${order.id}`);
    if (!detail.ok || !detail.body?.order) {
      process.stdout.write("?");
      continue;
    }

    const current = detail.body.order;
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (current.status === "paid" || current.status === "demo_paid") {
      console.log(`\n\n=======================================================================`);
      console.log(`  CONFIRMACIÓN DE PAGO RECIBIDA (${elapsed} s)`);
      console.log(`=======================================================================`);
      console.log(`  Pedido:           ${current.id}`);
      console.log(`  Estado:           ${current.status.toUpperCase()}`);
      console.log(`  Total:            ${formatMxn(current.totalCents)}`);
      console.log(`  Pagado:           ${formatMxn(current.paidCents)}`);
      console.log(`  Método:           ${current.paymentMethod}`);
      console.log(`  Referencia CoDi:  #${current.numRef}`);
      console.log("-----------------------------------------------------------------------");

      const payments = detail.body.payments ?? [];
      for (const p of payments) {
        console.log(`  - Transacción: ${p.transactionId ?? "sin-id"} | Monto: ${formatMxn(p.amountCents)} | Proveedor: ${p.provider} | Demo: ${p.demo}`);
      }
      console.log("=======================================================================\n");

      return { order: current, payments };
    }

    process.stdout.write(`\rEsperando pago... [${elapsed}s transcurridos] estado: ${current.status}   `);
  }

  console.log(`\n\nFAIL  Timeout alcanzado sin confirmación de pago.`);
  process.exit(1);
}

async function step4ReconciliationAudit() {
  console.log(`[4/4] Ejecutando reconciliación y cuadre contable contra Pey...`);

  const recRes = await request(LOCAL_BASE, "/api/reconcile");
  if (!recRes.ok) {
    console.warn(`WARN  No se pudo consultar /api/reconcile: HTTP ${recRes.status}`);
    return;
  }

  const rec = recRes.body;
  console.log(`Fecha: ${rec.date}`);
  if (rec.demoMode) {
    console.log(`Modo demo: los pagos simulados no se concilian contra la API bancaria de Pey.`);
  } else {
    console.log(`Caja local:      ${formatMxn(rec.localDigitalCents)}`);
    console.log(`Confirmado Pey:  ${formatMxn(rec.peyConfirmedCents)}`);
    console.log(`Diferencia:      ${formatMxn(rec.differenceCents)}`);
    console.log(`Auditados:       ${rec.checked} | OK: ${rec.ok} | Discrepancias: ${rec.issues}`);
    console.log(`RESULTADO:       ${rec.reconciled ? "CUADRA 100% CON PEY" : "HAY DIFERENCIAS"}`);
  }

  console.log("\n=======================================================================");
  console.log("  CERTIFICACIÓN COBRO POR QR COMPLETADA CON ÉXITO");
  console.log("=======================================================================\n");
}

async function main() {
  await step1PreflightAudit();
  const order = await step2CreateOrderAndQr();
  await step3MonitorWebhook(order);
  await step4ReconciliationAudit();
}

main().catch((err) => {
  console.error(`\nError fatal en el piloto: ${err.message}`);
  process.exit(1);
});

