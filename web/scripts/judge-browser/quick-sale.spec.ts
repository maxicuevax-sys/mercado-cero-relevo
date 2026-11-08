import { test, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { Order, Payment } from "../../src/lib/types";

const origin = "http://127.0.0.1:4666";
const quickName = "Cobrar efectivo exacto";

test.beforeAll(async ({ request }) => {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  expect(execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { encoding: "utf8" }).trim(),
    "Cash shortcut evidence requires the complete implementation committed").toBe("");
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).buildSha).toBe(sha);
});

async function register(page: Page) {
  await page.goto("/registro");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Prueba efectivo");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(`cash-${randomUUID()}@example.test`);
  await page.getByLabel("Crea una contraseña", { exact: true }).fill("Prueba-efectivo-aislada-2026");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const pending = page.waitForResponse(response => response.url().endsWith("/api/access/sign-up") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Crear mi cuenta", exact: true }).click();
    const response = await pending;
    if (response.status() === 429 && attempt < 2) {
      const seconds = Number(response.headers()["retry-after"]);
      expect(Number.isInteger(seconds)).toBe(true);
      expect(seconds).toBeGreaterThanOrEqual(1);
      expect(seconds).toBeLessThanOrEqual(10);
      await page.waitForTimeout(seconds * 1000);
      continue;
    }
    expect(response.status()).toBe(200);
    break;
  }
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("radio", { name: "Un poco de todo", exact: true }).check();
  await page.getByRole("button", { name: "Empezar con mi puesto", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
}

async function orders(context: BrowserContext): Promise<Order[]> {
  const all: Order[] = [];
  let total = 0;
  do {
    const response = await context.request.get(`/api/orders?limit=200&offset=${all.length}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    total = body.total;
    expect(body.orders.length > 0 || all.length === total, "Order pagination must progress").toBe(true);
    all.push(...body.orders);
  } while (all.length < total);
  expect(new Set(all.map(order => order.id)).size).toBe(total);
  return all;
}

function ids(list: Order[]) { return list.map(order => order.id).sort(); }
function quick(page: Page) { return page.getByRole("button", { name: quickName, exact: true }); }

async function unavailable(button: Locator) {
  if (await button.count()) await expect(button).toBeDisabled();
  else await expect(button).toHaveCount(0);
}

async function addManual(page: Page, description = "Producto manual", amount = "20") {
  const manual = page.locator("details#mc-caja-manual");
  if (await manual.getAttribute("open") === null) {
    const summary = manual.locator("summary");
    if (await summary.isVisible()) await summary.click();
    else await page.locator(".mc-sale-voice__chip--more").click();
  }
  await expect(manual).toHaveAttribute("open", "");
  await expect(manual.getByLabel("Producto o servicio", { exact: true })).toBeVisible();
  await expect(manual.getByLabel("Cantidad", { exact: true })).toBeVisible();
  await expect(manual.getByLabel("Precio unitario", { exact: true })).toBeVisible();
  await manual.getByLabel("Producto o servicio", { exact: true }).fill(description);
  await manual.getByLabel("Cantidad", { exact: true }).fill("1");
  await manual.getByLabel("Precio unitario", { exact: true }).fill(amount);
  await manual.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.locator(".mc-caja-line textarea").last()).toHaveValue(description);
}

async function expectCashResult(page: Page, baseline: Order[], amount: number) {
  await expect(page.locator(".mc-caja-result")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Venta cobrada en efectivo (demo)", exact: true })).toBeVisible();
  await expect(page.locator(".mc-caja-result")).not.toContainText(/Pey|pago confirmado|confirmación del proveedor/i);
  const after = await orders(page.context());
  expect(after).toHaveLength(baseline.length + 1);
  expect(ids(after).filter(id => ids(baseline).includes(id))).toEqual(ids(baseline));
  const added = after.filter(order => !baseline.some(previous => previous.id === order.id));
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({ status: "demo_paid", totalCents: amount, paidCents: amount, digitalPaidCents: 0, paymentMethod: "cash", lastPaymentProvider: "cash", creditCents: 0 });
  expect(added[0].status).not.toBe("paid");
  const response = await page.request.get(`/api/orders/${added[0].id}`);
  expect(response.status()).toBe(200);
  const detail = await response.json() as { order: Order; payments: Payment[] };
  expect(detail.order.id).toBe(added[0].id);
  expect(detail.payments).toHaveLength(1);
  expect(detail.payments[0]).toMatchObject({ provider: "cash", method: "cash", amountCents: amount, status: "paid", demo: true, transactionId: null });
  return added[0];
}

async function nextSale(page: Page) {
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await expect(page.locator(".mc-caja-line")).toHaveCount(0);
}

for (const width of [1280, 1448]) {
  test(`cash shortcut preserves desktop navigation and transaction truth at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1086 });
    await register(page);
    const baseline = await orders(page.context());
    const rail = page.locator("aside.inicio-sidebar:visible");
    await expect(rail).toHaveCount(1);
    const original = await rail.boundingBox();
    expect(original).not.toBeNull();
    await rail.getByRole("link", { name: "Caja", exact: true }).click();
    await expect(page).toHaveURL(/\/caja$/);
    await expect(rail).toHaveCount(1);
    await expect(rail.locator('a[href="/caja"]')).toHaveAttribute("aria-current", "page");
    const cajaRail = await rail.boundingBox();
    expect(Math.abs(cajaRail!.x - original!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(cajaRail!.width - original!.width)).toBeLessThanOrEqual(1);
    await expect(page.locator(".mc-caja-line")).toHaveCount(0);
    await unavailable(quick(page));
    const amounts = page.getByRole("group", { name: "Montos rápidos directos", exact: true });
    await expect(amounts.getByRole("button")).toHaveCount(4);
    await amounts.getByRole("button", { name: "Agregar monto $20", exact: true }).click();
    await expect(page.locator(".mc-caja-line")).toHaveCount(1);
    await expect(page.locator(".mc-caja-line textarea")).toHaveValue("Venta rápida");
    await page.locator(".mc-caja-line textarea").fill("Monto directo editable");
    await expect(page.locator(".mc-caja-line__total")).toContainText("$20.00");
    expect(ids(await orders(page.context()))).toEqual(ids(baseline));
    const discardTrigger = page.getByRole("button", { name: "Descartar venta", exact: true });
    await discardTrigger.click();
    const discard = page.getByRole("dialog", { name: "¿Descartar la venta sin confirmar?", exact: true });
    await expect(discard).toBeVisible();
    await expect(discard.getByRole("button", { name: "Seguir con la venta", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(discard).toBeHidden();
    await expect(discardTrigger).toBeFocused();
    await expect(page.locator(".mc-caja-line textarea")).toHaveValue("Monto directo editable");
    await discardTrigger.click();
    await discard.getByRole("button", { name: "Sí, descartar venta", exact: true }).click();
    await expect(page.locator(".mc-caja-line")).toHaveCount(0);
    await expect(page.locator("#mc-sale-voice-text")).toBeFocused();
    expect(ids(await orders(page.context()))).toEqual(ids(baseline));
    await amounts.getByRole("button", { name: "Agregar monto $20", exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`cash-direct-${width}.png`), fullPage: true });

    let postCount = 0;
    let payload: Record<string, unknown> | undefined;
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const providerWrites: string[] = [];
    page.on("request", request => {
      if (request.method() === "POST" && /\/api\/(checkout|demo\/pay|webhooks\/pey)/.test(request.url())) providerWrites.push(request.url());
    });
    await page.route("**/api/orders", async route => {
      if (route.request().method() !== "POST") return route.continue();
      postCount += 1;
      payload = route.request().postDataJSON();
      await held;
      await route.continue();
    });
    try {
      await quick(page).dblclick();
      await expect.poll(() => postCount).toBe(1);
      await unavailable(quick(page));
      await expect(page.locator(".mc-caja-line textarea")).toBeDisabled();
      await expect(discardTrigger).toBeDisabled();
    } finally { release(); }
    const added = await expectCashResult(page, baseline, 2000);
    expect(postCount).toBe(1);
    expect(payload).toMatchObject({ cashCents: 2000, creditCents: 0 });
    expect(typeof payload?.requestId).toBe("string");
    expect(providerWrites).toEqual([]);
    await page.unroute("**/api/orders");
    const replay = await page.request.post("/api/orders", { data: payload, headers: { Origin: origin } });
    expect(replay.status()).toBe(201);
    expect((await replay.json()).order.id).toBe(added.id);
    expect(ids(await orders(page.context()))).toEqual([...ids(baseline), added.id].sort());
    await page.screenshot({ path: testInfo.outputPath(`cash-result-${width}.png`), fullPage: true });

    await nextSale(page);
    await addManual(page);
    await page.getByRole("button", { name: "Mixto", exact: true }).click();
    await page.getByLabel("Efectivo recibido", { exact: true }).fill("10");
    await unavailable(quick(page));
    await expect(page.getByLabel("Efectivo recibido", { exact: true })).toHaveValue("10");
    await expect(page.getByRole("button", { name: "Mixto", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Digital", exact: true }).click();
    await unavailable(quick(page));
    expect(ids(await orders(page.context()))).toEqual([...ids(baseline), added.id].sort());
    await rail.getByRole("link", { name: "Inicio", exact: true }).click();
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(rail).toHaveCount(1);
  });
}

for (const width of [320, 390]) {
  test(`cash shortcut stays accessible and preserves tendered cash at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 320 ? 569 : 693 });
    await register(page);
    const baseline = await orders(page.context());
    await page.goto("/caja");
    await expect(page.locator(".mc-caja-line")).toHaveCount(0);
    await unavailable(quick(page));
    const amounts = page.getByRole("group", { name: "Montos rápidos directos", exact: true });
    for (const amount of [20, 50, 100, 200]) {
      const button = amounts.getByRole("button", { name: `Agregar monto $${amount}`, exact: true });
      await expect(button).toBeVisible();
      const bounds = await button.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    if (width === 390) await amounts.getByRole("button", { name: "Agregar monto $20", exact: true }).click();
    else await addManual(page);
    await expect(page.locator(".mc-caja-line")).toHaveCount(1);
    expect(ids(await orders(page.context()))).toEqual(ids(baseline));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`cash-compose-${width}.png`), fullPage: true });
    if (width === 320) {
      await page.getByRole("button", { name: "Registrar venta", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Método de pago", exact: true })).toBeVisible();
    }
    await expect(quick(page)).toBeEnabled();
    await quick(page).click();
    await expectCashResult(page, baseline, 2000);
    await nextSale(page);
    const afterQuick = await orders(page.context());
    await addManual(page);
    await page.getByRole("button", { name: "Registrar venta", exact: true }).click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByLabel("Efectivo recibido", { exact: true }).fill("100");
    await unavailable(quick(page));
    await expect(page.getByLabel("Efectivo recibido", { exact: true })).toHaveValue("100");
    await expect(page.getByText(/Cambio a devolver/)).toBeVisible();
    await page.getByRole("button", { name: "Registrar venta", exact: true }).click();
    await expectCashResult(page, afterQuick, 2000);
    await expect(page.locator(".mc-caja-result")).toContainText("$80.00");
    await page.screenshot({ path: testInfo.outputPath(`cash-change-${width}.png`), fullPage: true });
  });
}

test("ambiguous quick cash response blocks a second charge until real reconciliation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 693 });
  await register(page);
  const baseline = await orders(page.context());
  await page.goto("/caja");
  await addManual(page);
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("mercado-cero:caja-draft:v2");
    return raw ? JSON.parse(raw).lines.length : 0;
  })).toBe(1);
  // Open the same durable draft before the first attempt. This tab deliberately
  // remains untouched until the first tab has recovered its committed order.
  const twin = await page.context().newPage();
  await twin.setViewportSize({ width: 390, height: 693 });
  await twin.goto("/caja");
  await expect(twin.locator(".mc-caja-line textarea")).toHaveValue("Producto manual");
  let attempts = 0;
  let firstPayload: Record<string, unknown> | undefined;
  await page.route("**/api/orders", async route => {
    if (route.request().method() !== "POST") return route.continue();
    attempts += 1;
    firstPayload = route.request().postDataJSON();
    // The real server commits successfully; only its delivery is ambiguous.
    // Reconciliation must discover that order instead of creating another.
    const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 });
    expect(response.status()).toBe(201);
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Respuesta interrumpida después del registro" }) });
  });
  await quick(page).click();
  await expect(page.locator(".mc-caja-unknown")).toBeVisible();
  await unavailable(quick(page));
  await expect(page.locator(".mc-caja-line textarea")).toBeDisabled();
  expect(attempts).toBe(1);
  const committed = await orders(page.context());
  expect(committed).toHaveLength(baseline.length + 1);
  await page.screenshot({ path: testInfo.outputPath("cash-unknown-390.png"), fullPage: true });
  await page.getByRole("button", { name: "Consultar si se registró", exact: true }).click();
  const recovered = await expectCashResult(page, baseline, 2000);
  expect(ids(await orders(page.context()))).toEqual(ids(committed));
  expect(attempts).toBe(1);
  expect(firstPayload).toBeDefined();
  const twinPost = twin.waitForRequest(request => request.url().endsWith("/api/orders") && request.method() === "POST");
  await quick(twin).click();
  const twinPayload = (await twinPost).postDataJSON();
  expect(twinPayload.requestId, "The stale tab must reuse the reconciled draft's original request key").toBe(firstPayload?.requestId);
  expect(twinPayload).toEqual(firstPayload);
  const sameOrder = await expectCashResult(twin, baseline, 2000);
  expect(sameOrder.id).toBe(recovered.id);
  expect(ids(await orders(page.context()))).toEqual(ids(committed));
  await twin.close();
  await page.unroute("**/api/orders");
  await nextSale(page);
  await addManual(page);
  const newPost = page.waitForRequest(request => request.url().endsWith("/api/orders") && request.method() === "POST");
  await quick(page).click();
  const newPayload = (await newPost).postDataJSON();
  expect(newPayload.requestId, "A legitimate identical new sale needs its own request key").not.toBe(firstPayload?.requestId);
  const legitimate = await expectCashResult(page, committed, 2000);
  expect(legitimate.id).not.toBe(recovered.id);
});

test("uncommitted quick cash survives reload and a 404 lookup before retrying the same key", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 693 });
  await register(page);
  const baseline = await orders(page.context());
  await page.goto("/caja");
  await addManual(page);
  const payloads: Array<Record<string, unknown>> = [];
  await page.route("**/api/orders", async route => {
    if (route.request().method() !== "POST") return route.continue();
    payloads.push(route.request().postDataJSON());
    if (payloads.length === 1) {
      // No upstream write: unlike the post-commit503 scenario, the lookup must
      // genuinely return404 and the durable attempt must remain retryable.
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "El servidor no confirmó el registro" }) });
    } else await route.continue();
  });
  await quick(page).click();
  await expect(page.locator(".mc-caja-unknown")).toBeVisible();
  expect(payloads).toHaveLength(1);
  expect(payloads[0]).toMatchObject({ cashCents: 2000, creditCents: 0 });
  expect(typeof payloads[0].requestId).toBe("string");
  expect(ids(await orders(page.context()))).toEqual(ids(baseline));
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("mercado-cero:caja-draft:v2");
    return raw ? JSON.parse(raw).cashInput : null;
  })).toBe("20.00");
  await page.reload();
  await expect(page.locator(".mc-caja-unknown")).toBeVisible();
  await unavailable(quick(page));
  await expect(page.locator(".mc-caja-line textarea")).toBeDisabled();
  expect(await page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("mercado-cero:caja-draft:v2")!);
    const request = JSON.parse(localStorage.getItem("mercado-cero:caja-request:v2")!);
    return { cashInput: draft.cashInput, method: draft.method, requestId: request.requestId };
  })).toEqual({ cashInput: "20.00", method: "cash", requestId: payloads[0].requestId });
  const lookup = page.waitForResponse(response => response.url().includes("/api/orders?requestId=") && response.request().method() === "GET");
  await page.getByRole("button", { name: "Consultar si se registró", exact: true }).click();
  expect((await lookup).status()).toBe(404);
  await expect(page.locator(".mc-caja-unknown")).toBeVisible();
  await unavailable(quick(page));
  expect(ids(await orders(page.context()))).toEqual(ids(baseline));
  await page.screenshot({ path: testInfo.outputPath("cash-retry-after-404-390.png"), fullPage: true });
  await page.getByRole("button", { name: "Reintentar con la misma llave", exact: true }).click();
  await expectCashResult(page, baseline, 2000);
  expect(payloads).toHaveLength(2);
  expect(payloads[1], "Retry must retain the exact durable cash payload and request key").toEqual(payloads[0]);
  await page.unroute("**/api/orders");
});
