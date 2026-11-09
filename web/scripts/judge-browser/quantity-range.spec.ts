import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("manual quantities reject overflow and preserve fractions before registration", async ({ page, context, baseURL }) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  expect((await context.request.post("/api/access/guest", { headers: { Origin: baseURL! }, data: {} })).status()).toBe(200);
  expect((await context.request.put("/api/business-profile", { headers: { Origin: baseURL! }, data: { businessType: "general" } })).status()).toBe(200);
  const writes: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/orders") writes.push(request.url()); });
  await page.goto("/caja");
  await page.locator(".mc-sale-voice__chip--more").click();
  const manual = page.locator("#mc-caja-manual");
  await manual.getByLabel("Producto o servicio", { exact: true }).fill("Cantidad QA");
  await manual.getByLabel("Cantidad", { exact: true }).fill("1000");
  await manual.getByLabel("Precio unitario", { exact: true }).fill("20");
  await manual.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.locator("#mc-caja-add-error")).toContainText("999");
  await expect(page.locator('[id^="line-description-"]')).toHaveCount(0);
  await manual.getByLabel("Cantidad", { exact: true }).fill("1,5");
  await manual.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.locator(".mc-spec-total")).toContainText("30.00");
  await manual.getByLabel("Producto o servicio", { exact: true }).fill("Otra línea QA");
  await manual.getByLabel("Cantidad", { exact: true }).fill("1");
  await manual.getByLabel("Precio unitario", { exact: true }).fill("10");
  await manual.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.locator(".mc-spec-total")).toContainText("40.00");
  const quantity = page.locator('input[id^="line-quantity-"]').first();
  await quantity.fill("1000");
  await expect(quantity).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: "Cobrar efectivo exacto", exact: true })).toHaveCount(0);
  await page.locator(".mc-spec-register").click();
  await expect(page.locator("#caja-title")).toHaveText("Nueva venta");
  await expect(quantity).toBeFocused();
  await quantity.fill("1,5");
  await page.locator(".mc-spec-register").click();
  await expect(page.locator("#caja-title")).toHaveText("Método de pago");
  expect(writes).toEqual([]);
});

test("manual and edited prices reject malformed input instead of dropping a line", async ({ page, context, baseURL }) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  expect((await context.request.post("/api/access/guest", { headers: { Origin: baseURL! }, data: {} })).status()).toBe(200);
  expect((await context.request.put("/api/business-profile", { headers: { Origin: baseURL! }, data: { businessType: "general" } })).status()).toBe(200);
  const writes: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/orders") writes.push(request.url()); });
  await page.goto("/caja");
  await page.locator(".mc-sale-voice__chip--more").click();
  const manual = page.locator("#mc-caja-manual");
  await manual.getByLabel("Producto o servicio", { exact: true }).fill("Precio QA");
  await manual.getByLabel("Cantidad", { exact: true }).fill("1");
  for (const invalid of ["1-2", "a1.5"]) {
    await manual.getByLabel("Precio unitario", { exact: true }).fill(invalid);
    await manual.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page.locator("#mc-caja-add-error")).toBeVisible();
    await expect(page.locator('[id^="line-description-"]')).toHaveCount(0);
  }
  await manual.getByLabel("Precio unitario", { exact: true }).fill("10");
  await manual.getByRole("button", { name: "Agregar", exact: true }).click();
  await manual.getByLabel("Producto o servicio", { exact: true }).fill("Otra línea QA");
  await manual.getByLabel("Precio unitario", { exact: true }).fill("20");
  await manual.getByRole("button", { name: "Agregar", exact: true }).click();
  await page.locator(".mc-caja-line__price-toggle").first().click();
  const price = page.locator('input[id^="line-price-"]').first();
  for (const invalid of ["1-2", "a1.5"]) {
    await price.fill(invalid);
    await expect(price).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: "Cobrar efectivo exacto", exact: true })).toHaveCount(0);
    await page.locator(".mc-spec-register").click();
    await expect(page.locator("#caja-title")).toHaveText("Nueva venta");
    await expect(price).toBeFocused();
  }
  await price.fill("1,50");
  await expect(page.locator(".mc-spec-total")).toContainText("21.50");
  await page.locator(".mc-spec-register").click();
  await expect(page.locator("#caja-title")).toHaveText("Método de pago");
  expect(writes).toEqual([]);
});
