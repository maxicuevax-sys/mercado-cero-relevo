import { test, expect, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const destinations = [
  ["Inicio", "/inicio"], ["Movimientos de ventas y pagos", "/movimientos"], ["Caja", "/caja"], ["Ventas", "/ventas"],
  ["Fiados", "/fiados"], ["Corte de caja", "/corte"], ["Metas", "/metas"],
  ["Pendientes", "/pendientes"], ["Ayuda", "/ayuda"], ["Ajustes", "/ajustes"],
  ["Inicio", "/inicio"],
] as const;
const sidebarInventory = [
  "/inicio", "/movimientos", "/caja", "/ventas", "/fiados", "/corte",
  "/metas", "/pendientes", "/ayuda", "/ajustes",
].sort();

test.beforeAll(async ({ request }) => {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  expect(execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { encoding: "utf8" }).trim(),
    "Desktop evidence requires the complete implementation committed").toBe("");
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).buildSha).toBe(sha);
});

async function register(page: Page) {
  await page.goto("/registro");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Prueba escritorio");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(`desktop-${randomUUID()}@example.test`);
  await page.getByLabel("Crea una contraseña", { exact: true }).fill("Prueba-escritorio-aislada-2026");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const pending = page.waitForResponse(response => response.url().endsWith("/api/access/sign-up") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Crear mi cuenta", exact: true }).click();
    const response = await pending;
    if (response.status() === 429 && attempt < 2) {
      const retryAfter = Number(response.headers()["retry-after"]);
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(10);
      await page.waitForTimeout(retryAfter * 1000);
      continue;
    }
    expect(response.status()).toBe(200);
    break;
  }
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("radio", { name: "Un poco de todo", exact: true }).check();
  await page.getByRole("button", { name: "Empezar con mi puesto", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  expect((await page.request.get("/api/access/session")).status()).toBe(200);
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

async function expectCodiGeometry(page: Page) {
  const hub = page.locator("#cobrar-codi");
  await hub.scrollIntoViewIfNeeded();
  const panel = await box(hub);
  const form = await box(hub.locator(".mc-codi__form"));
  const amount = await box(hub.getByLabel("Monto a cobrar", { exact: true }));
  const cta = hub.getByRole("button", { name: "Cobrar con CoDi", exact: true });
  const button = await box(cta);
  expect(form.width, "Desktop CoDi form must remain usable, not a narrow overflow-free column").toBeGreaterThanOrEqual(240);
  expect(amount.width).toBeGreaterThanOrEqual(140);
  expect(amount.height).toBeGreaterThanOrEqual(44);
  expect(button.width).toBeGreaterThanOrEqual(220);
  expect(button.height).toBeGreaterThanOrEqual(44);
  for (const bounds of [form, amount, button]) {
    expect(bounds.x).toBeGreaterThanOrEqual(panel.x - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(panel.x + panel.width + 1);
    expect(bounds.y).toBeGreaterThanOrEqual(panel.y - 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(panel.y + panel.height + 1);
  }
  expect(button.y, "The amount field must not overlap the charge action").toBeGreaterThanOrEqual(amount.y + amount.height);
  await cta.click({ trial: true }); // Includes hit-target/overlay checks without creating an order.
  await hub.getByRole("button", { name: "$100", exact: true }).click();
  await expect(hub.getByLabel("Monto a cobrar", { exact: true })).toHaveValue("100.00");
  await expect(hub.getByRole("button", { name: /^Cobrar \$100/ })).toBeEnabled();
}

for (const width of [1448, 1280]) {
  test(`authenticated desktop sidebar, CoDi and discard presentation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1086 });
    const nativeDialogs: string[] = [];
    page.on("dialog", async dialog => {
      nativeDialogs.push(`${dialog.type()}: ${dialog.message()}`);
      await dialog.dismiss();
    });
    await register(page);
    let originalRail: { x: number; width: number } | undefined;
    const originalLinkHeights = new Map<string, number>();
    for (const [name, route] of destinations) {
      await test.step(`sidebar → ${route}`, async () => {
        // Next retains previous route trees in hidden Activity containers.
        // Assert the user's visible shell, while rejecting two visible rails.
        const rail = page.locator("aside.inicio-sidebar:visible");
        await expect(rail).toHaveCount(1);
        await rail.getByRole("link", { name, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${route}$`));
        await expect(rail).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        const bounds = await box(rail);
        expect(bounds.width).toBeGreaterThanOrEqual(200);
        expect(bounds.width).toBeLessThanOrEqual(300);
        originalRail ??= { x: bounds.x, width: bounds.width };
        expect(Math.abs(bounds.x - originalRail.x), `${route}: sidebar left edge changed`).toBeLessThanOrEqual(1);
        expect(Math.abs(bounds.width - originalRail.width), `${route}: sidebar width changed`).toBeLessThanOrEqual(1);
        const links = rail.locator("a.inicio-nav__item");
        expect((await links.evaluateAll(elements => elements.map(element => element.getAttribute("href")))).sort()).toEqual(sidebarInventory);
        for (const link of await links.all()) {
          const linkBounds = await box(link);
          const href = (await link.getAttribute("href"))!;
          if (!originalLinkHeights.has(href)) originalLinkHeights.set(href, linkBounds.height);
          expect(Math.abs(linkBounds.height - originalLinkHeights.get(href)!), `${route}: ${href} changed height when active`).toBeLessThanOrEqual(1);
          expect(linkBounds.x).toBeGreaterThanOrEqual(bounds.x - 1);
          expect(linkBounds.x + linkBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
          expect(linkBounds.y).toBeGreaterThanOrEqual(0);
          expect(linkBounds.y + linkBounds.height).toBeLessThanOrEqual(1086);
        }
        await expect(rail.locator(`a.inicio-nav__item[href="${route}"]`)).toHaveAttribute("aria-current", "page");
        if (route === "/caja") await expect(page.getByText("Aún no hay conceptos.", { exact: true })).toBeVisible();
        if (route === "/corte") {
          await expect(page.locator("main:visible")).not.toContainText(/[ÃÂ]/);
          expect((await box(page.locator(".mc-corte-v2-hero__art img:visible"))).width).toBeLessThanOrEqual(200);
        }
        if (route === "/metas") {
          await expect(page.locator(".mc-metas-native")).toBeHidden();
          expect((await box(page.locator(".mc-metas-hero__art img:visible"))).width).toBeLessThanOrEqual(240);
        }
        if (route === "/pendientes") {
          const lines = await page.locator(".mc-pend-summary__value:visible").evaluateAll(elements => elements.map(element => {
            const range = document.createRange(); range.selectNodeContents(element);
            return new Set(Array.from(range.getClientRects(), rect => Math.round(rect.top))).size;
          }));
          expect(lines.length).toBeGreaterThanOrEqual(2);
          expect(lines.every(count => count === 1), "Task summary numbers must not split into vertical fragments").toBe(true);
          expect((await box(page.locator(".mc-pend-hero__art img:visible"))).width).toBeLessThanOrEqual(200);
        }
        await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-${width}.png`), fullPage: true });
        if (route === "/corte") {
          await page.locator(".mc-corte-v2-count > summary").click();
          await expect(page.getByLabel("Total contado en pesos", { exact: true })).toBeVisible();
          await page.screenshot({ path: testInfo.outputPath(`corte-conteo-${width}.png`), fullPage: true });
          await page.locator(".mc-corte-v2-count > summary").click();
        }
        if (route === "/metas") {
          await page.locator(".mc-metas-hero:visible").getByRole("button", { name: "Apartar", exact: true }).click();
          const goalDialog = page.getByRole("dialog", { name: /^Apartar a / });
          await expect(goalDialog).toBeVisible();
          await page.screenshot({ path: testInfo.outputPath(`metas-apartar-${width}.png`), fullPage: false });
          await page.keyboard.press("Escape");
          await expect(goalDialog).toBeHidden();
        }
      });
    }
    await expectCodiGeometry(page);
    await page.screenshot({ path: testInfo.outputPath(`inicio-codi-${width}.png`), fullPage: true });
    const hub = page.locator("#cobrar-codi");
    await hub.getByRole("button", { name: /^Cobrar \$100/ }).click();
    await expect(hub.getByRole("img", { name: /^QR de cobro CoDi/ })).toBeVisible();
    await expect(hub.getByRole("heading", { name: "Esperando pago", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`inicio-codi-qr-${width}.png`), fullPage: true });
    await hub.getByRole("button", { name: "Simular pago CoDi", exact: true }).click();
    await expect(hub.getByRole("heading", { name: "Pago simulado", exact: true })).toBeVisible();
    await expect(hub.getByText(/No lo cuentes como cobrado/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`inicio-codi-simulado-${width}.png`), fullPage: true });

    // Presentation evidence only; B1 owns discard/restore behavior contracts.
    await page.locator("aside.inicio-sidebar:visible").getByRole("link", { name: "Caja", exact: true }).click();
    await expect(page).toHaveURL(/\/caja$/);
    await page.getByText("Agregar concepto a mano", { exact: true }).click();
    await page.getByLabel("Producto o servicio", { exact: true }).fill("Concepto temporal para diálogo");
    await page.getByLabel("Precio unitario", { exact: true }).fill("25");
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await page.getByRole("button", { name: "Descartar venta", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "¿Descartar la venta sin confirmar?", exact: true });
    await expect(dialog).toBeVisible();
    expect(nativeDialogs, "Discard must use the application dialog, never window.confirm").toEqual([]);
    const dialogBounds = await box(dialog.locator(".mc-caja-discard__card"));
    expect(dialogBounds.x).toBeGreaterThanOrEqual(0);
    expect(dialogBounds.y).toBeGreaterThanOrEqual(0);
    expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(width);
    expect(dialogBounds.y + dialogBounds.height).toBeLessThanOrEqual(1086);
    // Capture the viewport: full-page stitching misrepresents fixed top-layer
    // dialogs and sticky rails when the trigger was below the fold.
    await page.screenshot({ path: testInfo.outputPath(`caja-discard-dialog-${width}.png`), fullPage: false });
  });
}
