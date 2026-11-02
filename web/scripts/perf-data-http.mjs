#!/usr/bin/env node
/**
 * Contrato HTTP de límites, caché y compresión contra un servidor aislado.
 * No arranca ni reinicia el servidor.
 *
 * Uso, con el servidor ya levantado en :3160+:
 *   BASE_URL=http://127.0.0.1:3160 npm run test:perf-data:http
 */
import assert from "node:assert/strict";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3160").replace(/\/+$/, "");

function assertCache(response, profile) {
  const cache = response.headers.get("cache-control") ?? "";
  assert.match(cache, /^private, max-age=\d+, stale-while-revalidate=\d+$/);
  assert.ok(cache.includes(`max-age=${profile}`), cache);
  assert.ok(response.headers.get("etag"), "falta ETag");
}

async function json(path, headers = {}) {
  const response = await fetch(`${BASE}${path}`, { headers });
  const body = await response.json();
  return { response, body };
}

console.log(`Perf-data HTTP · ${BASE}`);

const dashboard = await json("/api/dashboard");
assert.equal(dashboard.response.status, 200);
assertCache(dashboard.response, 5);
assert.ok(Array.isArray(dashboard.body.orders));
assert.ok(Array.isArray(dashboard.body.credits));
assert.ok(dashboard.body.pagination?.orders);
assert.ok(dashboard.body.pagination?.credits);

const five = await json("/api/orders?limit=5");
assert.equal(five.body.orders.length, 5);
assert.equal(five.body.limit, 5);
assert.ok(five.body.total >= 5);
assert.equal(five.body.hasMore, true);
assertCache(five.response, 10);

const capped = await json("/api/orders?limit=999999");
assert.equal(capped.body.limit, 200);
assert.ok(capped.body.orders.length <= 200);

const credits = await json("/api/credits?limit=3");
assert.ok(credits.body.credits.length <= 3);
assert.equal(credits.body.limit, 3);
assertCache(credits.response, 10);

const tasks = await json("/api/tasks?limit=2");
assert.ok(tasks.body.tasks.length <= 2);
assert.equal(tasks.body.limit, 2);
assert.equal(tasks.response.status, 200);

const analytics = await json("/api/analytics?period=today");
assert.equal(analytics.response.status, 200);
assertCache(analytics.response, 30);

const etag = dashboard.response.headers.get("etag");
const conditional = await fetch(`${BASE}/api/dashboard`, {
  headers: { "If-None-Match": etag },
});
assert.equal(conditional.status, 304);
assert.equal((await conditional.arrayBuffer()).byteLength, 0);
assert.equal(conditional.headers.get("etag"), etag);

const gzip = await fetch(`${BASE}/api/dashboard`, {
  headers: { "Accept-Encoding": "gzip" },
});
const gzipBody = await gzip.arrayBuffer();
assert.equal(gzip.headers.get("content-encoding"), "gzip");
assert.ok(Number(gzip.headers.get("content-length")) < gzipBody.byteLength);

const identity = await fetch(`${BASE}/api/dashboard`, {
  headers: { "Accept-Encoding": "identity" },
});
assert.equal(identity.headers.get("content-encoding"), null);

console.log(
  JSON.stringify(
    {
      ok: true,
      dashboardBytes: gzipBody.byteLength,
      dashboardWireBytes: Number(gzip.headers.get("content-length")),
      etag,
      conditional: conditional.status,
      limits: {
        orders: capped.body.limit,
        credits: credits.body.limit,
        tasks: tasks.body.limit,
      },
    },
    null,
    2,
  ),
);
