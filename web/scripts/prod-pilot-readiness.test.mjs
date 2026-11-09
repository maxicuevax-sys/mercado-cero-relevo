import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server.js";
import ts from "typescript";

function transpileTsFile(relativeUrl, replacements = []) {
  const filePath = fileURLToPath(new URL(relativeUrl, import.meta.url));
  let source = readFileSync(filePath, "utf8");
  for (const [from, to] of replacements) {
    source = source.replaceAll(from, to);
  }
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
}

// data: modules have no directory: resolve the new telemetry dependencies explicitly.
const diagnosticsUrl = transpileTsFile("../src/lib/observability/sentry-diagnostics.ts");
const captureUnexpectedUrl = transpileTsFile("../src/lib/observability/capture-unexpected.ts", [
  ['from "./sentry-diagnostics"', `from "${diagnosticsUrl}"`],
  ['import("@sentry/nextjs")', `import("${import.meta.resolve("@sentry/nextjs")}")`],
]);
const errorsUrl = transpileTsFile("../src/lib/errors.ts", [
  ['from "./observability/capture-unexpected"', `from "${captureUnexpectedUrl}"`],
]);
const configUrl = transpileTsFile("../src/lib/config.ts");
const pilotModeUrl = transpileTsFile("../src/lib/auth/pilot-mode.ts");
const httpSecurityUrl = transpileTsFile("../src/lib/http-security.ts", [
  ['from "./errors"', `from "${errorsUrl}"`],
]);
const nextServerUrl = new URL(
  "../node_modules/next/server.js",
  import.meta.url,
).href;
const proxyUrl = transpileTsFile("../src/proxy.ts", [
  ['from "./lib/observability/sentry-diagnostics"', `from "${diagnosticsUrl}"`],
  ['from "next/server"', `from "${nextServerUrl}"`],
  ['from "@/lib/config"', `from "${configUrl}"`],
  ['from "@/lib/auth/pilot-mode"', `from "${pilotModeUrl}"`],
  ['from "@/lib/http-security"', `from "${httpSecurityUrl}"`],
]);

const {
  hasValidOperatorAccessToken,
  isPublicPerimeterPath,
  OPERATOR_COOKIE_NAME,
} = await import(httpSecurityUrl);
const { proxy } = await import(proxyUrl);

async function withEnv(overrides, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("isPublicPerimeterPath separa rutas de comprador/webhook de rutas de operadora", () => {
  assert.equal(isPublicPerimeterPath("/api/health", false), true);
  assert.equal(isPublicPerimeterPath("/api/webhooks/pey", false), true);
  assert.equal(isPublicPerimeterPath("/api/checkout/ord_123", false), true);
  assert.equal(isPublicPerimeterPath("/pay/ord_123", false), true);
  assert.equal(isPublicPerimeterPath("/pay/ord_123/success", false), true);

  // /api/demo/pay solo es público en modo demo; en producción está cerrado.
  assert.equal(isPublicPerimeterPath("/api/demo/pay", true), true);
  assert.equal(isPublicPerimeterPath("/api/demo/pay", false), false);

  // Rutas privadas de la comerciante nunca son públicas.
  assert.equal(isPublicPerimeterPath("/api/orders", false), false);
  assert.equal(isPublicPerimeterPath("/api/dashboard", false), false);
  assert.equal(isPublicPerimeterPath("/api/cash/close", false), false);
  assert.equal(isPublicPerimeterPath("/api/credits", false), false);
  assert.equal(isPublicPerimeterPath("/api/demo/reset", true), false);
});

test("proxy bloquea /api/demo/* con 403 cuando DEMO_MODE=false", async () => {
  await withEnv({ DEMO_MODE: "false", OPERATOR_ACCESS_TOKEN: "" }, async () => {
    const payReq = new NextRequest("http://localhost:3000/api/demo/pay", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ orderId: "ord_1", method: "codi" }),
    });
    const payRes = proxy(payReq);
    assert.equal(payRes.status, 403);
    const payBody = await payRes.json();
    assert.equal(payBody.code, "demo_disabled");

    const resetReq = new NextRequest("http://localhost:3000/api/demo/reset", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
      },
    });
    const resetRes = proxy(resetReq);
    assert.equal(resetRes.status, 403);
    const resetBody = await resetRes.json();
    assert.equal(resetBody.code, "demo_disabled");
  });
});

test("proxy exige OPERATOR_ACCESS_TOKEN en rutas privadas pero permite webhook y checkout público", async () => {
  const token = "op_secret_token_prod_2026";
  await withEnv(
    { DEMO_MODE: "false", OPERATOR_ACCESS_TOKEN: token },
    async () => {
      // 1. Ruta privada sin token → 401
      const unauthOrders = new NextRequest("http://localhost:3000/api/orders", {
        method: "GET",
      });
      const unauthRes = proxy(unauthOrders);
      assert.equal(unauthRes.status, 401);
      const unauthBody = await unauthRes.json();
      assert.equal(unauthBody.code, "operator_auth_required");

      // 2. Ruta privada con x-operator-token → pasa al handler (200 next)
      const authHeaderOrders = new NextRequest("http://localhost:3000/api/orders", {
        method: "GET",
        headers: { "x-operator-token": token },
      });
      const authHeaderRes = proxy(authHeaderOrders);
      assert.equal(authHeaderRes.status, 200);

      // 3. Ruta privada con cookie mc_operator_token → pasa al handler
      const cookieReq = new NextRequest("http://localhost:3000/api/dashboard", {
        method: "GET",
        headers: {
          cookie: `${OPERATOR_COOKIE_NAME}=${encodeURIComponent(token)}`,
        },
      });
      assert.equal(hasValidOperatorAccessToken(cookieReq), true);
      assert.equal(proxy(cookieReq).status, 200);

      // 4. Checkout público del comprador sin token de operadora → pasa al handler
      const buyerCheckout = new NextRequest(
        "http://localhost:3000/api/checkout/ord_abc",
        { method: "GET" },
      );
      assert.equal(proxy(buyerCheckout).status, 200);

      // 5. Webhook de pey sin token de operadora → pasa al handler (la ruta valida firma)
      const webhookReq = new NextRequest(
        "http://localhost:3000/api/webhooks/pey",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
      );
      assert.equal(proxy(webhookReq).status, 200);

      // 6. Health check público sin token de operadora → pasa al handler
      const healthReq = new NextRequest("http://localhost:3000/api/health", {
        method: "GET",
      });
      assert.equal(proxy(healthReq).status, 200);
    },
  );
});


test("account mode rejects buyer routes before any streaming response", async () => {
  await withEnv({ JUDGE_DEMO_ACCOUNTS: "true", DEMO_MODE: "true" }, async () => {
    for (const route of ["/pay/order", "/pay/order/success", "/api/checkout/order", "/api/verify", "/api/webhooks/pey"]) {
      const response = proxy(new NextRequest(`http://localhost:3000${route}`));
      assert.equal(response.status, 404);
      assert.equal((await response.json()).code, "demo_buyer_unavailable");
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    }
  });
});
