import { test, expect, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// Use the isolated judge server and a fresh tenant per test, never a shared reset.
test.use({ viewport: { width: 390, height: 844 } });

test.beforeAll(async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const health = await response.json();
  expect(health.demoMode).toBe(true);
  expect(health.buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
});

async function guest(context: BrowserContext, origin: string) {
  expect(new URL(origin).hostname).toBe("127.0.0.1");
  const access = await context.request.post("/api/access/guest", { headers: { Origin: origin }, data: {} });
  expect(access.status()).toBe(200);
  const profile = await context.request.put("/api/business-profile", { headers: { Origin: origin }, data: { businessType: "general" } });
  expect(profile.status()).toBe(200);
}

async function creditRows(context: BrowserContext) {
  const response = await context.request.get("/api/credits?limit=100");
  expect(response.status()).toBe(200);
  return (await response.json()).credits as Array<{ id: string; balanceCents: number; status: string }>;
}

test("mobile Fiados keeps the tenant total when a search has no matches or matches only the seed", async ({ page, context, baseURL }, testInfo) => {
  await guest(context, baseURL!);
  const seed = await creditRows(context);
  expect(seed).toHaveLength(1);
  expect(seed[0].balanceCents).toBe(5000);
  const created = await context.request.post("/api/orders", {
    headers: { Origin: baseURL! },
    data: { items: [{ description: "QA filtered ledger", quantity: 1, unitPriceCents: 5000 }], creditCents: 5000, customerName: "QA filtered customer", requestId: `qa-fiados-${randomUUID()}` },
  });
  expect(created.status()).toBe(201);
  const id = (await created.json()).order.creditId;
  const paid = await context.request.post(`/api/credits/${id}/pay`, {
    headers: { Origin: baseURL! }, data: { amountCents: 3100, method: "cash", expectedBalanceCents: 5000, requestId: `qa-fiados-${randomUUID()}` },
  });
  expect(paid.status()).toBe(200);
  expect((await paid.json()).balanceCents).toBe(1900);
  expect((await creditRows(context)).reduce((sum, row) => sum + row.balanceCents, 0)).toBe(6900);

  await page.goto("/fiados");
  const total = page.locator(".mc-fiados-mobile__total output");
  await expect(total).toHaveText("$69.00");
  await page.locator("#fiados-mobile-query").fill("QA-NO-MATCH");
  await page.locator(".mc-fiados-mobile__search button[type=submit]").click();
  await expect(page.locator(".mc-fiados-mobile__empty")).toHaveText("Sin coincidencias");
  await expect(total).toHaveText("$69.00");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("no-matches-total69.png") });

  await page.locator("#fiados-mobile-query").fill("Juan");
  await page.locator(".mc-fiados-mobile__search button[type=submit]").click();
  await expect(page.locator(".mc-fiados-mobile__list")).toHaveAttribute("aria-label", "Fiados por cliente");
  await expect(page.locator(".mc-fiados-mobile__list")).toContainText("$50.00");
  await expect(total).toHaveText("$69.00");
});

test("mobile Fiados shows zero with settled history instead of switching back to an illustration", async ({ page, context, baseURL }, testInfo) => {
  await guest(context, baseURL!);
  const rows = await creditRows(context);
  expect(rows).toHaveLength(1);
  const paid = await context.request.post(`/api/credits/${rows[0].id}/pay`, {
    headers: { Origin: baseURL! }, data: { amountCents: rows[0].balanceCents, method: "cash", expectedBalanceCents: rows[0].balanceCents, requestId: `qa-fiados-${randomUUID()}` },
  });
  expect(paid.status()).toBe(200);
  expect((await paid.json()).balanceCents).toBe(0);
  const settled = await creditRows(context);
  expect(settled).toHaveLength(1);
  expect(settled[0].status).toBe("settled");

  await page.goto("/fiados");
  const total = page.locator(".mc-fiados-mobile__total output");
  await expect(page.locator(".mc-fiados-mobile__empty")).toHaveText("Sin fiados pendientes");
  await expect(total).toHaveText("$0.00");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("settled-history-total0.png") });
  const history = page.locator(".mc-fiados-mobile__tabs").getByRole("link", { name: "Historial", exact: true });
  const href = await history.getAttribute("href");
  await history.click();
  await page.waitForURL(new URL(href!, baseURL!).href);
  await expect(page.locator(".mc-fiados-mobile__list")).toContainText("Saldado");
  await expect(total).toHaveText("$0.00");
});
