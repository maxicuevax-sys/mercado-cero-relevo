import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

test.use({ viewport: { width: 390, height: 844 } });

test("native Pendientes links keep CoDi selection through cached pages, Nuevo and clean Inicio", async ({ page }) => {
  test.setTimeout(120_000);
  expect((await (await page.request.get("/api/health")).json()).buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
  await page.goto("/acceso");
  await page.getByRole("button", { name: "Entrar sin cuenta", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("radio", { name: "Un poco de todo", exact: true }).check();
  await page.getByRole("button", { name: "Empezar con mi puesto", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  // Both own unpaid DEMO orders and QR metadata exist before the UI baseline.
  const orders: { id: string; amount: number }[] = [];
  for (const amount of [1300, 1700]) {
    const created = await page.request.post("/api/orders", { data: {
      items: [{ description: `QA native ${amount}`, quantity: 1, unitPriceCents: amount }],
      cashCents: 0, creditCents: 0, requestId: `qa_native_${amount}`,
    } });
    expect(created.status()).toBe(201);
    const order = (await created.json()).order;
    const qr = await page.request.post(`/api/orders/${order.id}/pay`, { data: { mode: "qr" } });
    expect(qr.status()).toBe(200);
    orders.push({ id: order.id, amount });
  }
  const before = (await (await page.request.get("/api/orders")).json()).orders.length;
  const forbidden: string[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "POST" && !(/^\/api\/orders\/[^/]+\/pay$/.test(url.pathname) && request.postDataJSON()?.mode === "qr")) {
      forbidden.push(url.pathname);
      return route.abort();
    }
    await route.continue();
  });
  const documents: string[] = [];
  page.on("request", request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  await page.goto("/pendientes"); // The last hard navigation in this test.
  const nonce = randomUUID();
  await page.evaluate(value => Reflect.set(window, "__qaNativeCodiNonce", value), nonce);
  const hub = page.locator("#cobrar-codi:visible");
  async function pending() {
    const nav = page.locator(".mc-mobile-nav:visible"), details = nav.locator("details.mc-mobile-nav__more");
    if (!await details.evaluate(element => (element as HTMLDetailsElement).open)) await details.locator("summary").click();
    await nav.locator('.mc-mobile-nav__panel a[href="/pendientes"]').click();
    await expect(page).toHaveURL(/\/pendientes$/);
  }
  async function select(index: number) {
    const order = orders[index];
    await page.locator(`main:visible a.mc-pend-order__cta[href*="pedido=${order.id}"]`).click();
    await expect(page).toHaveURL(url => url.pathname === "/inicio" && url.searchParams.get("pedido") === order.id);
    await expect(hub.locator(".mc-codi__order-amount")).toHaveText(`$${(order.amount / 100).toFixed(2)}`);
    await expect(hub.locator(".mc-codi__order-meta")).toContainText(order.id.slice(-4).toUpperCase());
    expect(await page.evaluate(() => Reflect.get(window, "__qaNativeCodiNonce"))).toBe(nonce);
    // Verify the current component polls the selected order, rather than stale A.
    const poll = await page.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === `/api/orders/${order.id}`, { timeout: 10_000 });
    expect(poll.status()).toBe(200);
    expect((await poll.json()).order.id).toBe(order.id);
    await expect(hub.locator(".mc-codi__order-amount")).toHaveText(`$${(order.amount / 100).toFixed(2)}`);
  }
  await select(0);
  await pending();
  await select(1);
  await pending();
  await select(0);
  await hub.getByRole("button", { name: "Nuevo cobro", exact: true }).click();
  await expect(hub.locator("#mc-codi-amount")).toHaveValue("");
  expect(new URL(page.url()).searchParams.has("pedido")).toBe(false);
  await pending();
  await select(1);
  // Clear this B instance too, then select the same B after another page visit.
  await hub.getByRole("button", { name: "Nuevo cobro", exact: true }).click();
  await expect(hub.locator("#mc-codi-amount")).toHaveValue("");
  await pending();
  await select(1);
  await page.locator('.mc-mobile-nav:visible a[href="/inicio"]').click();
  await expect(page).toHaveURL(url => url.pathname === "/inicio" && !url.search);
  await expect(hub.locator("#mc-codi-amount")).toHaveValue("");
  await expect(hub.locator(".mc-codi__order-amount")).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "__qaNativeCodiNonce"))).toBe(nonce);
  expect(documents).toHaveLength(1);
  expect(forbidden).toEqual([]);
  expect((await (await page.request.get("/api/orders")).json()).orders).toHaveLength(before);
  for (const order of orders) expect((await (await page.request.get(`/api/orders/${order.id}`)).json()).order.paidCents).toBe(0);
});
