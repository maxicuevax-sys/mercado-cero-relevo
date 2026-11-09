import { test, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

test.use({ viewport: { width: 390, height: 844 } });
test.beforeAll(async ({ request }) => {
  const health = await (await request.get("/api/health")).json();
  expect(health.demoMode).toBe(true);
  expect(health.buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
});
async function guest(context: BrowserContext, origin: string) {
  expect(new URL(origin).hostname).toBe("127.0.0.1");
  expect((await context.request.post("/api/access/guest", { headers: { Origin: origin }, data: {} })).status()).toBe(200);
  expect((await context.request.put("/api/business-profile", { headers: { Origin: origin }, data: { businessType: "general" } })).status()).toBe(200);
}

test("receipt never confirms a missing or mismatched ledger record", async ({ page, context, baseURL }) => {
  await guest(context, baseURL!);
  const rows = (await (await context.request.get("/api/credits")).json()).credits;
  const seed = rows[0];
  for (const query of ["", "?creditId=missing&orderId=missing", `?creditId=${seed.id}&orderId=missing`, `?tipo=abono&creditId=${seed.id}&requestId=missing&aplicado=999999&cliente=Inventado`]) {
    await page.goto(`/fiados/registrado${query}`);
    await expect(page.getByRole("heading", { name: "Registro no confirmado", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^(Fiado|Abono) registrado$/ })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("La venta se guardó");
    await expect(page.locator("main")).not.toContainText("Inventado");
  }
});

test("new fiado and abono receipts use saved records and ignore forged query amounts", async ({ page, context, baseURL }, testInfo) => {
  await guest(context, baseURL!);
  const customer = `QA receipt ${randomUUID().slice(0, 8)}`;
  await page.goto("/fiados/nuevo");
  await page.getByLabel("Cliente", { exact: true }).fill(customer);
  await page.getByLabel("Monto del fiado", { exact: true }).fill("50");
  await page.getByLabel(/Nota/).fill("Nota guardada QA");
  await page.getByRole("button", { name: "Registrar fiado", exact: true }).click();
  await page.waitForURL(/\/fiados\/registrado\?/);
  await expect(page.getByRole("heading", { name: "Fiado registrado", exact: true })).toBeVisible();
  const receipt = new URL(page.url());
  const creditId = receipt.searchParams.get("creditId")!;
  expect(receipt.searchParams.get("orderId")).toBeTruthy();
  receipt.searchParams.set("amount", "99999999");
  receipt.searchParams.set("note", "NOTA FALSA");
  await page.goto(receipt.href);
  await expect(page.locator(".mc-flow__dialog-rows")).toContainText("$50.00");
  await expect(page.locator(".mc-flow__dialog-rows")).toContainText("Nota guardada QA");
  await expect(page.locator("main")).not.toContainText("NOTA FALSA");
  await page.screenshot({ path: testInfo.outputPath("new-fiado-server-receipt.png") });

  await page.goto(`/fiados/juan/abono?credito=${creditId}`);
  await page.locator(".mc-abono__amount input").fill("20");
  await page.getByRole("button", { name: "Registrar abono", exact: true }).click();
  await page.waitForURL(/\/fiados\/registrado\?/);
  await expect(page.getByRole("heading", { name: "Abono registrado", exact: true })).toBeVisible();
  const paidReceipt = new URL(page.url());
  expect(paidReceipt.searchParams.get("requestId")).toBeTruthy();
  paidReceipt.searchParams.set("aplicado", "99999999");
  paidReceipt.searchParams.set("metodo", "Tarjeta inventada");
  paidReceipt.searchParams.set("cliente", "Cliente inventado");
  await page.goto(paidReceipt.href);
  await page.reload();
  await expect(page.locator(".mc-flow__dialog-customer")).toContainText(customer);
  await expect(page.locator(".mc-flow__dialog-customer")).toContainText("$30.00");
  await expect(page.locator(".mc-flow__dialog-rows")).toContainText("$20.00");
  await expect(page.locator(".mc-flow__dialog-rows")).toContainText("Efectivo");
  await expect(page.locator("main")).not.toContainText("inventado");
  await page.screenshot({ path: testInfo.outputPath("abono-server-receipt.png") });
  const credits = (await (await context.request.get("/api/credits")).json()).credits;
  expect(credits.find((row: { id: string }) => row.id === creditId).balanceCents).toBe(3000);
});

test("legacy abono detail confirms a stored payment and never trusts abono=ok", async ({ page, context, baseURL }) => {
  await guest(context, baseURL!);
  const created = await context.request.post("/api/orders", {
    headers: { Origin: baseURL! },
    data: { items: [{ description: "QA legacy receipt", quantity: 1, unitPriceCents: 1000 }], creditCents: 1000, customerName: "QA legacy receipt", requestId: `qa-receipt-${randomUUID()}` },
  });
  expect(created.status()).toBe(201);
  const creditId = (await created.json()).order.creditId;
  for (const query of ["abono=ok", "abonoRequestId=missing&abono=ok"]) {
    await page.goto(`/fiados/${creditId}?${query}`);
    await expect(page.locator(".mc-flow__card[role=status]")).toContainText("No pude confirmar este abono");
    await expect(page.locator(".mc-flow__card[role=status]")).not.toContainText("Abono registrado");
  }
  await page.goto(`/fiados/${creditId}/abono`);
  await page.getByLabel("Monto del abono", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Registrar abono", exact: true }).click();
  await page.waitForURL(/abonoRequestId=/);
  await expect(page.locator(".mc-flow__card[role=status]")).toContainText("Abono registrado: $2.00");
  await expect(page.locator(".mc-flow__card[role=status]")).toContainText("$8.00");
  await page.reload();
  await expect(page.locator(".mc-flow__card[role=status]")).toContainText("Abono registrado: $2.00");
});
