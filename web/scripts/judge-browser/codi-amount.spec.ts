import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("CoDi preserves decimal input and rejects invalid signs without creating an order", async ({ page, context, baseURL }) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  expect((await context.request.post("/api/access/guest", { headers: { Origin: baseURL! }, data: {} })).status()).toBe(200);
  expect((await context.request.put("/api/business-profile", { headers: { Origin: baseURL! }, data: { businessType: "general" } })).status()).toBe(200);
  const orders: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname === "/api/orders") orders.push(request.url()); });
  await page.goto("/inicio");
  const hub = page.locator("#cobrar-codi");
  const amount = hub.locator("#mc-codi-amount");
  const submit = hub.locator(".mc-codi__cta");
  for (const [input, formatted] of [["1,5", "1.50"], ["1.50", "1.50"], ["1,234.56", "1234.56"], ["1.234,56", "1234.56"]]) {
    await amount.fill(input);
    await amount.blur();
    await expect(amount).toHaveValue(formatted);
    await expect(submit).toBeEnabled();
  }
  for (const input of ["-2", "1,234", "1.234", "1..5", "0.005", "1a5"]) {
    await amount.fill(input);
    await amount.blur();
    await expect(amount).toHaveValue(input);
    await expect(amount).toHaveAttribute("aria-invalid", "true");
    await expect(submit).toBeDisabled();
  }
  await amount.fill("0");
  await submit.click();
  await expect(hub.getByRole("alert")).toContainText("$0.01");
  await hub.getByRole("button", { name: "$0.01", exact: true }).click();
  await expect(amount).toHaveValue("0.01");
  await expect(submit).toBeEnabled();
  expect(orders).toEqual([]);
});
