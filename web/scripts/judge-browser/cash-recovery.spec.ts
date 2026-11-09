import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test("lost cash response preserves attempt tender after reload, including mixed/exact and legacy metadata", async ({ page }) => {
  test.setTimeout(120_000);
  expect((await (await page.request.get("/api/health")).json()).buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
  await page.goto("/acceso");
  await page.getByRole("button", { name: "Entrar sin cuenta", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("radio", { name: "Un poco de todo", exact: true }).check();
  await page.getByRole("button", { name: "Empezar con mi puesto", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  for (const kind of ["cash", "mixed", "exact", "legacy", "corrupt"] as const) {
    await test.step(kind, async () => {
      await page.goto("/caja");
      await page.getByRole("button", { name: "Agregar monto $20", exact: true }).click();
      if (kind !== "exact") await page.locator('input[id^="line-price-"]').fill("90");
      const before = (await (await page.request.get("/api/orders")).json()).orders.length;
      const attempts: { id: string; requestId: string }[] = [];
      await page.route("**/api/orders", async route => {
        if (route.request().method() !== "POST") return route.continue();
        const response = await route.fetch();
        expect(response.status()).toBe(201);
        const data = await response.json();
        attempts.push({ id: data.order.id, requestId: route.request().postDataJSON().requestId });
        if (kind === "mixed") await route.fulfill({ response, status: 503 });
        else await route.abort("failed");
      });
      if (kind === "exact") await page.getByRole("button", { name: "Cobrar efectivo exacto", exact: true }).click();
      else {
        await page.locator(".mc-spec-register").click();
        if (kind === "mixed") {
          await page.getByText("Otros métodos de cobro", { exact: true }).click();
          await page.getByRole("button", { name: "Mixto", exact: true }).click();
          await page.getByLabel("Monto a fiado", { exact: true }).fill("30");
          await page.getByLabel("Nombre del cliente", { exact: true }).fill("Cliente sintético QA");
        } else await page.getByRole("button", { name: "Continuar", exact: true }).click();
        await page.getByLabel("Efectivo recibido", { exact: true }).fill("100");
        await page.getByRole("button", { name: "Registrar venta", exact: true }).click();
      }
      await expect(page.locator(".mc-caja-unknown")).toBeVisible();
      await page.unroute("**/api/orders");
      const receipt = await page.evaluate(() => JSON.parse(localStorage.getItem("mercado-cero:caja-unknown:v2")!).cashReceipt);
      expect(receipt).toEqual({ cashReceivedCents: kind === "exact" ? 2000 : 10000, changeCents: kind === "mixed" ? 4000 : kind === "exact" ? 0 : 1000 });
      if (kind === "legacy" || kind === "corrupt") await page.evaluate(kind => {
        const key = "mercado-cero:caja-unknown:v2", value = JSON.parse(localStorage.getItem(key)!);
        if (kind === "legacy") delete value.cashReceipt;
        else value.cashReceipt = { cashReceivedCents: 10000, changeCents: -1000 };
        localStorage.setItem(key, JSON.stringify(value));
      }, kind);
      await page.reload();
      await expect(page.locator(".mc-caja-unknown")).toBeVisible();
      await page.getByRole("button", { name: "Consultar si se registró", exact: true }).click();
      const result = page.locator(".mc-caja-result");
      await expect(result).toBeVisible();
      expect(attempts).toHaveLength(1);
      expect((await (await page.request.get("/api/orders")).json()).orders).toHaveLength(before + 1);
      await expect(result).toContainText(attempts[0].id.slice(-4).toUpperCase());
      if (kind === "legacy" || kind === "corrupt") {
        await expect(result).toContainText("Efectivo recibido y cambio no disponibles para esta recuperación");
        await expect(result.locator("dt", { hasText: /^Cambio$/ })).toHaveCount(0);
      } else {
        await expect(result).not.toContainText("no disponibles para esta recuperación");
        if (kind !== "exact") {
          await expect(result.locator(".mc-caja-result__facts > div").filter({ has: page.locator("dt", { hasText: /^Recibiste$/ }) })).toContainText("100.00");
          await expect(result.locator(".mc-caja-result__facts > div").filter({ has: page.locator("dt", { hasText: /^Cambio$/ }) })).toContainText(kind === "mixed" ? "40.00" : "10.00");
        }
      }
      await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
      await expect(page.locator(".mc-spec-total")).toContainText("0.00");
    });
  }
});
