import { test, expect, type APIRequestContext } from "@playwright/test";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { sealDemoCheckout } from "../../src/lib/auth/demo-checkout-capability";

// Capabilities are short-lived bearer secrets: never retain their URLs/headers in traces.
test.use({ viewport: { width: 390, height: 844 }, trace: "off", screenshot: "off", video: "off" });
const decoderScript = resolve(process.cwd(), "node_modules/@zxing/browser/umd/zxing-browser.min.js");

test("anonymous demo QR uses one scoped order, strict body and idempotent simulated payment", async ({ page, context, browser, baseURL }, info) => {
  test.setTimeout(40000);
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  const origin = new URL(baseURL!).origin;
  const health = await (await context.request.get("/api/health")).json();
  expect(health.demoMode).toBe(true);
  expect(health.buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
  const ownHeaders = { Origin: origin };
  expect((await context.request.post("/api/access/guest", { headers: ownHeaders, data: {} })).status()).toBe(200);
  expect((await context.request.put("/api/business-profile", { headers: ownHeaders, data: { businessType: "general" } })).status()).toBe(200);
  const initial = await (await context.request.get("/api/orders?limit=100")).json();
  const beforeTotal = initial.total;
  const seeded = initial.orders.find((item: { id: string; status: string }) => item.id.startsWith("demo_hist_pending_") && item.status === "payment_pending");
  expect(Boolean(seeded), "real seeded pending fixture exists").toBe(true);
  const seededQr = await context.request.post(`/api/orders/${seeded.id}/pay`, { headers: ownHeaders, data: { mode: "qr" } });
  expect(seededQr.status(), "seeded pending QR generation must not reject its identifier").toBe(200);
  const seededTarget = new URL((await seededQr.json()).order.qrString);
  expect(seededTarget.pathname === "/cobro/demo" && seededTarget.hash.startsWith("#v1.")).toBe(true);
  const created = await context.request.post("/api/orders", { headers: ownHeaders, data: { items: [{ description: "QA public demo QR", quantity: 1, unitPriceCents: 1234 }], requestId: `qa-cap-${randomUUID()}` } });
  expect(created.status()).toBe(201);
  const order = (await created.json()).order;
  const generated = await context.request.post(`/api/orders/${order.id}/pay`, { headers: ownHeaders, data: { mode: "qr" } });
  expect(generated.status()).toBe(200);
  const qrOrder = (await generated.json()).order;
  const target = new URL(qrOrder.qrString);
  expect(target.origin === origin && target.pathname === "/cobro/demo" && !target.search && target.hash.startsWith("#v1.")).toBe(true);
  const capability = target.hash.slice(1);
  // Decode actual pixels with the installed ZXing browser library, no mocked scanner response.
  const decoder = await context.newPage();
  await decoder.goto("about:blank");
  await decoder.addScriptTag({ path: decoderScript });
  async function decode(image: string) {
    try {
      return await decoder.evaluate(async image => {
        const sdk = (globalThis as unknown as { ZXingBrowser: { BrowserQRCodeReader: new () => { decodeFromImageUrl(value: string): Promise<{ getText(): string }> } } }).ZXingBrowser;
        return (await new sdk.BrowserQRCodeReader().decodeFromImageUrl(image)).getText();
      }, image);
    } catch { throw new Error("ZXing could not decode the actual QR image (capability redacted)"); }
  }
  expect(await decode(qrOrder.qrImage) === target.href, "original QR exact payload").toBe(true);
  await page.goto(`/inicio?pedido=${encodeURIComponent(order.id)}`);
  const qrImage = page.locator(".mc-codi__figure img");
  await expect(qrImage).toBeVisible();
  await expect(qrImage).toHaveJSProperty("complete", true);
  // The component intentionally falls back to the original for dense payloads.
  await page.waitForTimeout(700);
  const originalButton = page.getByRole("button", { name: "QR original", exact: true });
  if (await originalButton.isVisible()) {
    expect(await decode((await qrImage.getAttribute("src"))!) === target.href, "decorated Tianguis QR exact payload").toBe(true);
    await originalButton.click();
    expect(await decode((await qrImage.getAttribute("src"))!) === target.href, "component original QR exact payload").toBe(true);
  } else {
    expect(await decode((await qrImage.getAttribute("src"))!) === target.href, "dense original fallback payload").toBe(true);
    info.annotations.push({ type: "coverage-limit", description: "This actual capability QR is too dense for decoration; original fallback decoded. Decorated capability QR is not certified." });
  }
  await decoder.close();

  const buyer = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buyerPage = await buyer.newPage();
  const buyerErrors: string[] = [];
  buyerPage.on("pageerror", () => buyerErrors.push("buyer pageerror (details redacted)"));
  const header = { "X-Trangui-Demo-Checkout": capability };
  // Catch transport errors without emitting request headers or capability in a test failure.
  async function publicRequest(api: APIRequestContext, method: "get" | "post", headers: Record<string, string>, data?: unknown) {
    try { return await api[method](`${origin}/api/demo-checkout`, { headers, ...(data === undefined ? {} : { data }), timeout: 6000 }); }
    catch { throw new Error("Fixed demo checkout transport failed (capability redacted)"); }
  }
  try {
    expect((await buyer.cookies()).length).toBe(0);
    const seededRead = await publicRequest(buyer.request, "get", { "X-Trangui-Demo-Checkout": seededTarget.hash.slice(1) });
    expect(seededRead.status()).toBe(200); expect((await seededRead.json()).dueCents).toBe(12000);
    let response;
    try { response = await buyerPage.goto(target.href); }
    catch { throw new Error("Anonymous demo page navigation failed (capability redacted)"); }
    expect(response?.status()).toBe(200);
    await expect(buyerPage.locator("#demo-checkout-title")).toHaveText("Revisa tu cobro DEMO");
    await expect(buyerPage.getByRole("button", { name: "Simular pago", exact: true })).toBeEnabled();
    await expect(buyerPage.locator(".mc-demo-checkout__amount")).toContainText("$12.34");
    const dtoResponse = await publicRequest(buyer.request, "get", header);
    expect(dtoResponse.status()).toBe(200);
    const dto = await dtoResponse.json();
    expect(Object.keys(dto).sort()).toEqual(["demo", "dueCents", "items", "reference", "status", "totalCents"]);
    expect(dto.demo).toBe(true); expect(dto.totalCents).toBe(1234); expect(dto.dueCents).toBe(1234);
    expect(JSON.stringify(dto).includes(order.id), "public DTO omits merchant order identifier").toBe(false);
    expect(Object.keys(dto.items[0]).sort()).toEqual(["description", "quantity", "totalCents"]);
    expect((await publicRequest(buyer.request, "get", { "X-Trangui-Demo-Checkout": capability + "=" })).status()).toBe(404);
    expect((await publicRequest(buyer.request, "post", { ...header, Origin: "https://untrusted.invalid" }, { method: "codi" })).status()).toBe(403);
    const otherId = initial.orders[0]?.id ?? "ord_unrelated";
    expect((await publicRequest(buyer.request, "post", { ...header, Origin: origin }, { method: "codi", orderId: otherId, amountCents: 1, accountId: "other" })).status()).toBe(400);
    // Use only the private ephemeral CI webServer fixture key; never a production secret.
    const secret = info.config.webServer?.env?.PILOT_AUTH_SECRET;
    expect(typeof secret === "string" && secret.length >= 32, "private CI capability expiry fixture configured").toBe(true);
    const user = (await (await context.request.get("/api/access/session")).json()).user;
    const past = Date.now() - 1200000;
    const expired = sealDemoCheckout({ accountId: user.id, orderId: order.id }, { secret: secret!, origin, nowMs: past });
    expect((await publicRequest(buyer.request, "get", { "X-Trangui-Demo-Checkout": expired })).status()).toBe(404);
    const beforePayment = await (await context.request.get(`/api/orders/${order.id}`)).json();
    expect(beforePayment.payments.length).toBe(0);
    expect((await buyer.request.get(`${origin}/pay/${order.id}`, { maxRedirects: 0 })).status()).toBe(404);
    expect((await buyer.request.get(`${origin}/api/checkout/${order.id}`)).status()).toBe(404);
    await buyerPage.getByRole("button", { name: "Simular pago", exact: true }).click();
    await expect(buyerPage.locator("#demo-checkout-title")).toHaveText("Cobro DEMO registrado");
    const replays = await Promise.all([0, 1].map(() => publicRequest(buyer.request, "post", { ...header, Origin: origin }, { method: "codi" })));
    expect(replays.map(r => r.status())).toEqual([200, 200]);
    const final = await (await context.request.get(`/api/orders/${order.id}`)).json();
    expect(final.order.status).toBe("demo_paid"); expect(final.order.paidCents).toBe(1234);
    expect(final.payments).toHaveLength(1); expect(final.payments[0].provider).toBe("demo"); expect(final.payments[0].demo).toBe(true);
    const after = await (await context.request.get("/api/orders?limit=100")).json();
    expect(after.total).toBe(beforeTotal + 1);
    expect((await buyer.cookies()).length).toBe(0); expect(buyerErrors).toEqual([]);
    await buyerPage.reload(); await expect(buyerPage.locator("#demo-checkout-title")).toHaveText("Cobro DEMO registrado");
    // Screenshot deliberately excludes the address bar/QR; no capability is serialized.
    await info.attach("anonymous-demo-receipt", { body: await buyerPage.locator(".mc-demo-checkout__paper").screenshot(), contentType: "image/png" });
  } finally { await buyer.close(); }
});
