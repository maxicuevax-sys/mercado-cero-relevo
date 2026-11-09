import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test("CoDi Nuevo clears its URL and expired QR renews the same unpaid demo order", async ({ page }) => {
  const health = await page.request.get("/api/health");
  expect((await health.json()).buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
  await page.goto("/acceso");
  await page.getByRole("button", { name: "Entrar sin cuenta", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("radio", { name: "Un poco de todo", exact: true }).check();
  await page.getByRole("button", { name: "Empezar con mi puesto", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  let creates = 0;
  page.on("request", r => { if (r.method() === "POST" && new URL(r.url()).pathname === "/api/orders") creates++; });
  await page.locator("#mc-codi-amount").fill("13.00");
  const created = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/orders");
  await page.locator(".mc-codi__cta").click();
  const order = (await (await created).json()).order;
  await expect(page.getByRole("img", { name: /QR de cobro CoDi/ })).toBeVisible();
  const count = (await (await page.request.get("/api/orders")).json()).orders.length;
  await page.goto(`/inicio?pedido=${order.id}&keep=1#cobrar-codi`);
  await page.getByRole("button", { name: "Nuevo cobro", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("pedido")).toBe(false);
  expect(new URL(page.url()).searchParams.get("keep")).toBe("1");
  expect(new URL(page.url()).hash).toBe("#cobrar-codi");
  await page.reload();
  await expect(page.locator("#mc-codi-amount")).toHaveValue("");
  await expect(page.locator(".mc-codi__order-amount")).toHaveCount(0);

  // Shorten only the GET view expiry: server clock and database stay unchanged.
  const start = Date.now(), viewExpiry = start + 5_000;
  await page.clock.install({ time: new Date(start) });
  await page.goto(`/inicio?pedido=${order.id}#cobrar-codi`);
  const readPattern = `**/api/orders/${order.id}`;
  await page.route(readPattern, async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.order.qrExpiresAt = new Date(viewExpiry).toISOString();
    await route.fulfill({ response, json: data });
  });
  await page.getByRole("button", { name: "Consultar estado", exact: true }).click();
  await expect(page.getByRole("button", { name: "Consultar estado", exact: true })).toBeEnabled();
  await page.clock.fastForward(6_000);
  await expect(page.locator("#mc-codi-title")).toHaveText("QR vencido");
  await expect(page.getByRole("img", { name: /QR de cobro CoDi/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Simular pago CoDi", exact: true })).toHaveCount(0);
  // Returning from a background tab also refreshes wall time without a timer.
  await page.clock.setFixedTime(new Date(viewExpiry + 10_000));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByRole("button", { name: "Renovar QR", exact: true })).toBeVisible();
  await page.unroute(readPattern);
  const pendingRenew = page.waitForResponse(r => new URL(r.url()).pathname === `/api/orders/${order.id}/pay` && r.request().method() === "POST");
  await page.getByRole("button", { name: "Renovar QR", exact: true }).click();
  const renewed = await pendingRenew;
  expect(renewed.request().postDataJSON()).toEqual({ mode: "qr", forceRefresh: true });
  expect(renewed.status()).toBe(200);
  expect((await renewed.json()).order.id).toBe(order.id);
  await expect(page.locator("#mc-codi-title")).toHaveText("Esperando pago");
  await expect(page.getByRole("img", { name: /QR de cobro CoDi/ })).toBeVisible();
  expect((await (await page.request.get(`/api/orders/${order.id}`)).json()).order.paidCents).toBe(0);
  expect((await (await page.request.get("/api/orders")).json()).orders).toHaveLength(count);
  expect(creates).toBe(1);
});
