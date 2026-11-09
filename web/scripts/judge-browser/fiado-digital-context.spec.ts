import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

test("Fiados digital action keeps its credit and records only an explicitly declared abono", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  expect((await (await page.request.get("/api/health")).json()).buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
  await page.goto("/acceso");
  await page.getByRole("button", { name: "Entrar sin cuenta", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("radio", { name: "Un poco de todo", exact: true }).check();
  await page.getByRole("button", { name: "Empezar con mi puesto", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  // Fixture only: supported API creates one own10peso credit before the flow baseline.
  const seeded = await page.request.post("/api/orders", { data: {
    items: [{ description: "QA fiado digital", quantity: 1, unitPriceCents: 1000 }],
    cashCents: 0, creditCents: 1000, customerName: "Cliente QA", requestId: "qa_fiado_digital_fixture",
  } });
  expect(seeded.status()).toBe(201);
  const creditId = (await seeded.json()).order.creditId as string;
  expect(creditId).toBeTruthy();
  const ordersBefore = (await (await page.request.get("/api/orders")).json()).orders.length;
  const cashBefore = await (await page.request.get("/api/cash")).json();
  let abonoPosts = 0;
  const forbidden: string[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === "POST") {
      if (pathname === `/api/credits/${creditId}/pay`) abonoPosts++;
      else { forbidden.push(pathname); return route.abort(); }
    }
    await route.continue();
  });
  const detail = `/fiados/${creditId}`;
  await page.goto(detail);
  await page.getByRole("link", { name: "Registrar abono digital", exact: true }).click();
  expect(new URL(page.url()).pathname).toBe(`${detail}/abono`);
  expect(new URL(page.url()).searchParams.get("metodo")).toBe("codi");
  await expect(page.getByLabel("Monto del abono", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Digital recibido", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/abono declarado; pey no lo verifica/)).toBeVisible();
  await expect(page.getByText(/esta pantalla no genera un QR/)).toBeVisible();
  expect(abonoPosts).toBe(0);
  await page.getByRole("link", { name: "Cancelar", exact: true }).click();
  expect(new URL(page.url()).pathname).toBe(detail);
  await page.goto(`${detail}/abono?metodo=wallet`);
  await expect(page.getByRole("button", { name: "Efectivo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Monto del abono", { exact: true })).toHaveValue("");
  await page.goto(detail);
  await page.getByRole("link", { name: "Registrar abono digital", exact: true }).click();
  await page.getByLabel("Monto del abono", { exact: true }).fill("2");
  await page.getByLabel("Monto del abono", { exact: true }).blur();
  await expect(page.getByLabel("Monto del abono", { exact: true })).toHaveValue("2");
  const paid = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/credits/${creditId}/pay`);
  await page.getByRole("button", { name: "Registrar abono", exact: true }).click();
  const response = await paid;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({ amountCents: 200, method: "codi", expectedBalanceCents: 1000 });
  const result = await response.json();
  expect(result).toMatchObject({ appliedCents: 200, balanceCents: 800, duplicate: false });
  expect(result.credit.id).toBe(creditId);
  await expect(page).toHaveURL(new RegExp(`/fiados/${creditId}\\?abonoRequestId=`));
  await expect(page.locator('.mc-flow__card[role="status"]')).toContainText("Abono registrado: $2.00");
  const credits = (await (await page.request.get("/api/credits")).json()).credits;
  expect(credits.find((credit: { id: string }) => credit.id === creditId).balanceCents).toBe(800);
  expect((await (await page.request.get("/api/orders")).json()).orders).toHaveLength(ordersBefore);
  const cashAfter = await (await page.request.get("/api/cash")).json();
  expect(cashAfter.cashCreditCents).toBe(cashBefore.cashCreditCents);
  expect(cashAfter.cashSalesCents).toBe(cashBefore.cashSalesCents);
  expect(abonoPosts).toBe(1);
  expect(forbidden).toEqual([]);

  // Read the own isolated test tenant ledger, without adding a public API.
  const root = testInfo.config.webServer?.env?.JUDGE_DATA_ROOT;
  if (typeof root !== "string" || !path.isAbsolute(root)) throw new Error("Isolated judge data root required");
  const account = (await (await page.request.get("/api/access/session")).json()).user;
  const tenant = createHash("sha256").update(account.id).digest("hex");
  const db = new DatabaseSync(path.join(root, "business", tenant, "demo.sqlite"), { readOnly: true });
  try {
    expect(db.prepare("SELECT amount_cents, method, provider, demo FROM credit_payments WHERE credit_id = ?").all(creditId))
      .toEqual([{ amount_cents: 200, method: "codi", provider: "declared", demo: 1 }]);
    expect(db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS cash FROM credit_payments WHERE credit_id = ? AND method = 'cash'").get(creditId))
      .toEqual({ cash: 0 });
  } finally { db.close(); }
});
