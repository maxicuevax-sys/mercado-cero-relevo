import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

const WEB = path.resolve(import.meta.dirname, "..");

function collect(child) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: null, stdout, stderr: `${stderr}\n(timeout)` });
    }, 60_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function runAgainstStub(handler) {
  const hits = [];
  const server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      hits.push(`${request.method} ${request.url}`);
      handler(request, response, body);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn("python", ["scripts/checkout-audit.py"], {
    cwd: WEB,
    env: {
      ...process.env,
      CHECKOUT_BASE_URL: base,
      BASE_URL: base,
    },
    windowsHide: true,
  });
  const result = await collect(child);
  await new Promise((resolve) => server.close(resolve));
  return { ...result, hits };
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

test("checkout-audit: si falla la creación de la orden, resetea en finally", async () => {
  const result = await runAgainstStub((request, response) => {
    if (request.method === "POST" && request.url === "/api/orders") {
      return json(response, 500, { error: "sin orden" });
    }
    if (request.method === "POST" && request.url === "/api/demo/reset") {
      return json(response, 200, { ok: true });
    }
    return json(response, 404, {});
  });

  assert.equal(result.code, 1, result.stderr);
  assert.match(result.stdout, /no se pudo crear el pedido/i);
  assert.ok(result.hits.includes("POST /api/demo/reset"));
});

test("checkout-audit: si falla el link, resetea en finally", async () => {
  const result = await runAgainstStub((request, response) => {
    if (request.method === "POST" && request.url === "/api/orders") {
      return json(response, 200, { order: { id: "ord_test_checkout" } });
    }
    if (
      request.method === "POST" &&
      request.url === "/api/orders/ord_test_checkout/pay"
    ) {
      return json(response, 500, { error: "sin link" });
    }
    if (request.method === "POST" && request.url === "/api/demo/reset") {
      return json(response, 200, { ok: true });
    }
    return json(response, 404, {});
  });

  assert.equal(result.code, 1, result.stderr);
  assert.match(result.stdout, /no se pudo crear el link/i);
  assert.ok(result.hits.includes("POST /api/demo/reset"));
});
