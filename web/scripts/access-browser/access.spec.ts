import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { mkdirSync } from "node:fs";

test.beforeEach(async ({ page }) => {
  if (process.env.DEBUG_ACCESS_UI === "1") {
    page.on("console", message => console.log(message.type(), message.text().slice(0, 500)));
    page.on("pageerror", error => console.log("pageerror", error.message.slice(0, 500)));
    page.on("requestfailed", request => console.log("failed", request.url(), request.failure()?.errorText));
    page.on("response", response => { if (response.request().isNavigationRequest()) console.log("navigation", response.status(), response.headers()["refresh"] ?? "no refresh"); });
  }
});

test("correo, contraseña y teclado funcionan sin fingir una sesión", async ({ page }) => {
  await page.goto("/acceso");
  await expect(page.getByRole("heading", { name: "Qué gusto verte de nuevo." })).toBeVisible();
  await page.getByLabel("Correo electrónico", { exact: true }).fill("no-es-correo");
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba-visual-2026");
  await page.getByRole("button", { name: "Mostrar contraseña", exact: true }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar contraseña", exact: true }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Entrar a mi demo", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Escribe un correo electrónico válido.");
  await page.getByLabel("Correo electrónico", { exact: true }).fill("juez-visual@example.test");
  await page.getByLabel("Contraseña", { exact: true }).press("Enter");
  await expect(page.getByRole("alert")).toHaveText("El acceso de prueba todavía no está abierto.");
  await expect(page).toHaveURL(/\/acceso$/);
  expect((await page.context().cookies()).filter(cookie => cookie.name.includes("session"))).toEqual([]);
  await page.getByRole("button", { name: "Crear cuenta de prueba", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("El registro de pruebas estará disponible próximamente.");
});

for (const viewport of [{ width: 390, height: 693 }, { width: 320, height: 569 }, { width: 1448, height: 1086 }]) {
  test(`referencia visual y accesibilidad ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const response = await page.goto("/acceso");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("Iniciar sesión · Trangui");
    await expect(page.getByRole("img", { name: /comerciante.*tianguis/i })).toBeVisible();
    await expect(page.getByText("Trangui", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(axe.violations).toEqual([]);
    const evidence = path.resolve("../harness/evidence/runs/trangui-access");
    mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, `access-${viewport.width}x${viewport.height}.png`), fullPage: true });
  });
}
