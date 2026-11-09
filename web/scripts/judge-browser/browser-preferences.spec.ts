import { test, expect, type BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
test.use({ viewport: { width: 390, height: 844 } });
test.beforeAll(async ({ request }) => {
  const r = await request.get("/api/health"), health = await r.json();
  expect(r.status()).toBe(200); expect(health.demoMode).toBe(true);
  expect(health.buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
});
async function guest(context: BrowserContext, origin: string) {
  expect(new URL(origin).hostname).toBe("127.0.0.1");
  expect((await context.request.post("/api/access/guest", { headers: { Origin: origin }, data: {} })).status()).toBe(200);
  expect((await context.request.put("/api/business-profile", { headers: { Origin: origin }, data: { businessType: "general" } })).status()).toBe(200);
}
test("visual preferences synchronize another route and persist normally", async ({ page, context, baseURL }) => {
  await guest(context, baseURL!); await page.goto("/ajustes");
  await page.getByText("Texto, contraste y preferencias avanzadas", { exact: true }).click();
  const peer = await context.newPage();
  try {
    await peer.goto("/inicio");
    await page.getByRole("group", { name: "Tamaño del texto", exact: true }).getByRole("button", { name: "Muy grande", exact: true }).click();
    await expect(peer.locator("html")).toHaveAttribute("data-text-size", "xlarge");
    await page.getByRole("group", { name: "Contraste", exact: true }).getByRole("button", { name: "Alto", exact: true }).click();
    await expect(peer.locator("html")).toHaveAttribute("data-contrast", "high");
    await peer.reload(); await expect(peer.locator("html")).toHaveAttribute("data-text-size", "xlarge");
    await expect(peer.locator("html")).toHaveAttribute("data-contrast", "high");
  } finally { await peer.close(); }
});
test("full storage keeps visual choices and session voice consistent through SPA navigation", async ({ page, context, baseURL }) => {
  await guest(context, baseURL!); await page.goto("/ajustes");
  await page.getByText("Texto, contraste y preferencias avanzadas", { exact: true }).click();
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException("QA storage full", "QuotaExceededError"); }; });
  const size = page.getByRole("group", { name: "Tamaño del texto", exact: true });
  await size.getByRole("button", { name: "Muy grande", exact: true }).click();
  await expect(size.getByRole("button", { name: "Muy grande", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge");
  await page.getByRole("group", { name: "Contraste", exact: true }).getByRole("button", { name: "Alto", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  const voice = page.getByRole("switch", { name: "Asistente de voz", exact: true });
  await voice.click(); await expect(voice).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("button", { name: "Silenciada", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Leer esta pantalla", exact: true }).click();
  await expect(page.locator(".mc-ajustes-feedback")).toHaveText("La voz está silenciada. Actívala para escuchar.");
  await page.locator(".mc-mobile-nav__more > summary").click();
  await page.getByRole("link", { name: "Corte de caja", exact: true }).click();
  await expect(page).toHaveURL(/\/corte$/);
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge");
  await page.locator(".mc-corte-detail > summary").click();
  await page.getByRole("button", { name: "Escuchar resumen del día", exact: true }).click();
  await expect(page.locator(".mc-corte-receipt__voice-status")).toHaveText("La voz está silenciada en Ajustes.");
});
