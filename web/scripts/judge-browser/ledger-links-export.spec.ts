import { test, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

test.use({ viewport: { width: 390, height: 844 } });
test.beforeAll(async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const health = await response.json();
  expect(health.demoMode).toBe(true);
  expect(health.buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
});

async function fixture(context: BrowserContext, origin: string) {
  expect(new URL(origin).hostname).toBe("127.0.0.1");
  expect((await context.request.post("/api/access/guest", { headers: { Origin: origin }, data: {} })).status()).toBe(200);
  expect((await context.request.put("/api/business-profile", { headers: { Origin: origin }, data: { businessType: "general" } })).status()).toBe(200);
  const response = await context.request.post("/api/orders", {
    headers: { Origin: origin }, data: {
      items: [{ description: "QA ledger link", quantity: 1, unitPriceCents: 1000 }],
      creditCents: 1000, customerName: `QA ledger ${randomUUID().slice(0, 8)}`, requestId: `qa-ledger-${randomUUID()}`,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).order.creditId as string;
}

test("native abono back and cancel reopen the same real credit instead of a customer slug", async ({ page, context, baseURL }) => {
  const id = await fixture(context, baseURL!);
  for (const selector of [".mc-abono__back", ".mc-abono__cancel"]) {
    // Cancel is deliberately desktop-only; mobile exposes the same destination
    // through its visible back control. Exercise each native visible control.
    await page.setViewportSize({ width: selector.endsWith("cancel") ? 1448 : 390, height: selector.endsWith("cancel") ? 1086 : 844 });
    await page.goto(`/fiados/juan/abono?credito=${id}`);
    const link = page.locator(selector);
    await expect(link).toHaveAttribute("href", `/fiados/${id}`);
    await link.click();
    await page.waitForURL(new URL(`/fiados/${id}`, baseURL!).href);
    await expect(page.getByRole("heading", { name: "Historial de fiados", exact: true })).toBeVisible();
    await expect(page.locator('section[aria-label="Resumen del fiado"]')).toContainText("$10.00");
    // Next may retain the previous, inactive route in the DOM. Verify the
    // visible destination, rather than matching its hidden cached main too.
    await expect(page.locator("#mc-flow-main:visible")).not.toContainText("This page could not be found");
  }
});

test("downloaded cut CSV labels cash receipts separately from sales when only an abono enters cash", async ({ page, context, baseURL }) => {
  const id = await fixture(context, baseURL!);
  const pay = await context.request.post(`/api/credits/${id}/pay`, {
    headers: { Origin: baseURL! }, data: { amountCents: 200, method: "cash", expectedBalanceCents: 1000, requestId: `qa-ledger-${randomUUID()}` },
  });
  expect(pay.status()).toBe(200);
  const cash = await (await context.request.get("/api/cash")).json();
  expect(cash.cashSalesCents).toBe(0);
  expect(cash.cashCreditCents).toBe(200);
  const input = { openingCents: cash.openingCents, expensesCents: 0, withdrawalsCents: 0, countedCents: cash.expectedCents, baseNextCents: 0 };
  const previewResponse = await context.request.post("/api/cash/preview", { headers: { Origin: baseURL! }, data: input });
  expect(previewResponse.status()).toBe(200);
  const preview = await previewResponse.json();
  const response = await context.request.post("/api/cash/close", {
    headers: { Origin: baseURL! }, data: { ...input, expectedVersion: 0, previewFingerprint: preview.preview.fingerprint, requestId: `qa-ledger-${randomUUID()}` },
  });
  expect(response.status()).toBe(200);
  const close = (await response.json()).close;
  await page.goto("/corte/historial");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar historial", exact: true }).click()]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "");
  const lines = csv.trim().split(/\r?\n/).map(line => line.slice(1, -1).split('\",\"'));
  const headers = lines[0];
  expect(headers).not.toContain("Ventas del día");
  const row = lines.slice(1).find(values => values[0] === close.date && values[2] === String(close.version))!;
  expect(row).toBeTruthy();
  expect(row[headers.indexOf("Efectivo del día (ventas y abonos)")]).toBe("2.00");
  expect(row[headers.indexOf("Efectivo de ventas")]).toBe("0.00");
  expect(row[headers.indexOf("Abonos de fiado en efectivo")]).toBe("2.00");
  expect(row[headers.indexOf("Debería haber")]).toBe((cash.expectedCents / 100).toFixed(2));
});
