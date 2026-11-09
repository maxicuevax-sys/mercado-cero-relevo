import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

test("native digital abonos reset cancelled/successful attempts and keep their own credit", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  expect((await (await page.request.get("/api/health")).json()).buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
  await page.goto("/acceso");
  await page.getByRole("button", { name: "Entrar sin cuenta", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("radio", { name: "Un poco de todo", exact: true }).check();
  await page.getByRole("button", { name: "Empezar con mi puesto", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  // Supported API fixture before the navigation/accounting baseline.
  const seeded = await page.request.post("/api/orders", { data: {
    items: [{ description: "QA fiado digital", quantity: 1, unitPriceCents: 5000 }],
    cashCents: 0, creditCents: 5000, customerName: "Cliente QA", requestId: "qa_fiado_digital_fixture",
  } });
  expect(seeded.status()).toBe(201);
  const creditId = (await seeded.json()).order.creditId as string;
  expect(creditId).toBeTruthy();
  const ordersBefore = (await (await page.request.get("/api/orders")).json()).orders.length;
  const cashBefore = await (await page.request.get("/api/cash")).json();
  expect(typeof cashBefore.cashCreditCents).toBe("number");
  const writes: { amountCents: number; method: string; expectedBalanceCents: number; requestId: string }[] = [];
  const forbidden: string[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === "POST") {
      if (pathname === `/api/credits/${creditId}/pay`) writes.push(request.postDataJSON());
      else { forbidden.push(pathname); return route.abort(); }
    }
    await route.continue();
  });
  const detail = `/fiados/${creditId}`, main = page.locator("main:visible");
  const digitalUrl = new URL(`${detail}/abono?metodo=codi`, page.url()).href;
  const documentRequests: string[] = [];
  page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests.push(request.url()); });
  await page.goto(detail); // No further hard navigation during the abono flow.
  const nonce = randomUUID();
  await page.evaluate(value => Reflect.set(window, "__qaFiadoNonce", value), nonce);
  await main.getByRole("link", { name: "Registrar abono", exact: true }).click();
  await expect(page).toHaveURL(new URL(`${detail}/abono`, page.url()).href);
  await expect(main.getByRole("button", { name: "Efectivo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await main.getByLabel("Monto del abono", { exact: true }).fill("4");
  await main.getByRole("link", { name: "Cancelar", exact: true }).click();
  await expect(page).toHaveURL(new URL(detail, page.url()).href);
  expect(writes).toHaveLength(0);
  for (const [index, amount, balance] of [[0, 2, 4800], [1, 1, 4700]]) {
    await main.getByRole("link", { name: "Registrar abono digital", exact: true }).click();
    await expect(page).toHaveURL(digitalUrl);
    await expect(main.getByLabel("Monto del abono", { exact: true })).toHaveValue("");
    await expect(main.getByRole("button", { name: "Digital recibido", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(main.getByText(/abono declarado; pey no lo verifica/)).toBeVisible();
    await expect(main.getByText(/esta pantalla no genera un QR/)).toBeVisible();
    await expect(main.locator(".mc-flow__error")).toHaveCount(0);
    if (index === 1) await expect(main.locator("section.mc-flow__row")).toContainText("$48.00");
    await main.getByLabel("Monto del abono", { exact: true }).fill(String(amount));
    await main.getByLabel("Monto del abono", { exact: true }).blur();
    await expect(main.getByLabel("Monto del abono", { exact: true })).toHaveValue(String(amount));
    const paid = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/credits/${creditId}/pay`);
    await main.getByRole("button", { name: "Registrar abono", exact: true }).click();
    const response = await paid;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toMatchObject({ amountCents: amount * 100, method: "codi", expectedBalanceCents: index === 0 ? 5000 : 4800 });
    const result = await response.json();
    expect(result).toMatchObject({ appliedCents: amount * 100, balanceCents: balance, duplicate: false });
    expect(result.credit.id).toBe(creditId);
    await expect(page).toHaveURL(new RegExp(`/fiados/${creditId}\\?abonoRequestId=`));
    await expect(main.locator('.mc-flow__card[role="status"]')).toContainText(`Abono registrado: $${amount}.00`);
    expect(await page.evaluate(() => Reflect.get(window, "__qaFiadoNonce"))).toBe(nonce);
  }
  expect(writes).toHaveLength(2);
  expect(writes[0].requestId).not.toBe(writes[1].requestId);
  expect((await (await page.request.get("/api/credits")).json()).credits.find((credit: { id: string }) => credit.id === creditId).balanceCents).toBe(4700);
  expect((await (await page.request.get("/api/orders")).json()).orders).toHaveLength(ordersBefore);
  const cashAfter = await (await page.request.get("/api/cash")).json();
  expect(cashAfter.cashCreditCents).toBe(cashBefore.cashCreditCents);
  expect(cashAfter.cashSalesCents).toBe(cashBefore.cashSalesCents);
  expect(documentRequests).toHaveLength(1);
  expect(forbidden).toEqual([]);

  const root = testInfo.config.webServer?.env?.JUDGE_DATA_ROOT;
  if (typeof root !== "string" || !path.isAbsolute(root)) throw new Error("Isolated judge data root required");
  const account = (await (await page.request.get("/api/access/session")).json()).user;
  const tenant = createHash("sha256").update(account.id).digest("hex");
  const db = new DatabaseSync(path.join(root, "business", tenant, "demo.sqlite"), { readOnly: true });
  try {
    expect(db.prepare("SELECT amount_cents, method, provider, demo FROM credit_payments WHERE credit_id = ? ORDER BY amount_cents DESC").all(creditId))
      .toEqual([{ amount_cents: 200, method: "codi", provider: "declared", demo: 1 }, { amount_cents: 100, method: "codi", provider: "declared", demo: 1 }]);
    expect(db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS cash FROM credit_payments WHERE credit_id = ? AND method = 'cash'").get(creditId)).toEqual({ cash: 0 });
  } finally { db.close(); }
  // Unknown methods still use the safe default; outside the native flow above.
  await page.goto(`${detail}/abono?metodo=wallet`);
  await expect(page.getByRole("button", { name: "Efectivo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Monto del abono", { exact: true })).toHaveValue("");
});
