import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const origin = "http://127.0.0.1:4666";
const password = "Prueba-onboarding-aislada-2026";
const choices = {
  produce: "Frutas y verduras", food: "Comida y bebidas",
  goods: "Ropa y artículos", general: "Un poco de todo",
} as const;
type BusinessType = keyof typeof choices;
type Profile = { businessType: BusinessType; completedAt: string };
type OrderSnapshot = { total: number; ids: string[] };

test.beforeAll(async ({ request }) => {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  expect(execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { encoding: "utf8" }).trim(),
    "Onboarding evidence requires the complete implementation committed").toBe("");
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).buildSha).toBe(sha);
});

async function submitAccess(page: Page, action: "sign-up" | "sign-in", button: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const pending = page.waitForResponse(response => response.url().endsWith(`/api/access/${action}`) && response.request().method() === "POST");
    await page.getByRole("button", { name: button, exact: true }).click();
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
    return;
  }
}

async function register(page: Page) {
  const email = `onboarding-${randomUUID()}@example.test`;
  await page.goto("/registro");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Prueba de giro");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Crea una contraseña", { exact: true }).fill(password);
  await submitAccess(page, "sign-up", "Crear mi cuenta");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("group", { name: "¿Qué vendes en tu puesto?", exact: true })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(4);
  await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
  return email;
}

async function profile(context: BrowserContext): Promise<Profile | null> {
  const response = await context.request.get("/api/business-profile");
  expect(response.status()).toBe(200);
  return (await response.json()).profile;
}

async function save(page: Page, type: BusinessType) {
  await page.getByRole("radio", { name: choices[type], exact: true }).check();
  await page.getByRole("button", { name: "Empezar con mi puesto", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  const saved = await profile(page.context());
  expect(saved?.businessType).toBe(type);
  expect(Number.isFinite(Date.parse(saved!.completedAt))).toBe(true);
  return saved!;
}

async function ordersSnapshot(context: BrowserContext): Promise<OrderSnapshot> {
  const ids: string[] = [];
  let total = 0;
  do {
    const response = await context.request.get(`/api/orders?limit=200&offset=${ids.length}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    total = body.total;
    expect(Array.isArray(body.orders)).toBe(true);
    const pageIds = body.orders.map((order: { id: string }) => order.id);
    expect(pageIds.length > 0 || ids.length === total, "Pagination must progress until all order IDs are recorded").toBe(true);
    ids.push(...pageIds);
  } while (ids.length < total);
  expect(new Set(ids).size).toBe(total);
  return { total, ids: ids.sort() };
}

async function emptyCaja(page: Page, baseline: OrderSnapshot) {
  await page.goto("/caja");
  await expect(page.getByRole("heading", { name: "Nueva venta", exact: true })).toBeVisible();
  await expect(page.getByLabel("¿Qué vendiste? Describe los productos", { exact: true })).toBeEnabled();
  await expect(page.locator(".mc-caja-line")).toHaveCount(0);
  expect(await ordersSnapshot(page.context()), "Choosing a business type must retain the original order IDs and count without adding a sale").toEqual(baseline);
  const suggestions = (await page.locator(".mc-sale-voice__phrases button").allTextContents()).map(value => value.trim());
  await expect(page.locator("#mc-sale-voice-text")).toHaveValue("");
  await page.locator(".mc-sale-voice__phrases button").first().click();
  await expect(page.locator("#mc-sale-voice-text")).not.toHaveValue("");
  await expect(page.locator("#mc-sale-voice-text")).toBeFocused();
  await expect(page.locator(".mc-caja-line")).toHaveCount(0);
  expect(await ordersSnapshot(page.context()), "A suggestion fills editable input without adding an item or creating an order").toEqual(baseline);
  return suggestions;
}

test("business profile fails closed for unauthenticated requests", async ({ request }) => {
  expect((await request.get("/api/business-profile")).status()).toBe(401);
  expect((await request.put("/api/business-profile", {
    data: { businessType: "produce" }, headers: { Origin: origin },
  })).status()).toBe(401);
});

test("two accounts retain distinct business types across reload and login without creating a sale", async ({ browser }) => {
  const first = await browser.newContext({ baseURL: origin });
  const second = await browser.newContext({ baseURL: origin });
  try {
    const pageA = await first.newPage();
    const pageB = await second.newPage();
    const emailA = await register(pageA);
    const baselineA = await ordersSnapshot(first);
    expect(await profile(first)).toBeNull();
    await pageA.goto("/inicio");
    await expect(pageA).toHaveURL(/\/onboarding$/);
    const savedA = await save(pageA, "produce");
    await register(pageB);
    const baselineB = await ordersSnapshot(second);
    expect(await profile(second)).toBeNull();
    const savedB = await save(pageB, "food");
    for (const [page, context, expected] of [[pageA, first, savedA], [pageB, second, savedB]] as const) {
      await page.reload();
      await expect(page).toHaveURL(/\/inicio$/);
      expect(await profile(context)).toEqual(expected);
    }
    const suggestionsA = await emptyCaja(pageA, baselineA);
    const suggestionsB = await emptyCaja(pageB, baselineB);
    expect(suggestionsA.length).toBeGreaterThan(1);
    expect(suggestionsB.length).toBeGreaterThan(1);
    expect(suggestionsA).not.toEqual(suggestionsB);
    for (const payload of [{ businessType: "unknown" }, { businessType: "general", accountId: "forged" }]) {
      expect((await first.request.put("/api/business-profile", { data: payload, headers: { Origin: origin } })).status()).toBe(400);
      expect(await profile(first)).toEqual(savedA);
      expect(await profile(second)).toEqual(savedB);
    }
    await pageA.goto("/ajustes");
    await pageA.locator("summary").filter({ hasText: "Mi negocio" }).click();
    await pageA.getByRole("link", { name: "Cambiar giro", exact: true }).click();
    await expect(pageA).toHaveURL(/\/onboarding$/);
    await expect(pageA.getByRole("radio", { name: choices.produce, exact: true })).toBeChecked();
    const changed = await save(pageA, "goods");
    expect(changed.completedAt).toBe(savedA.completedAt);
    expect(await profile(second)).toEqual(savedB);
    await pageA.goto("/ajustes");
    await pageA.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await expect(pageA).toHaveURL(/\/acceso$/);
    await pageA.getByLabel("Correo electrónico", { exact: true }).fill(emailA);
    await pageA.getByLabel("Contraseña", { exact: true }).fill(password);
    await submitAccess(pageA, "sign-in", "Entrar a mi demo");
    await expect(pageA).toHaveURL(/\/inicio$/);
    expect(await profile(first)).toEqual(changed);
    await emptyCaja(pageA, baselineA);
    await emptyCaja(pageB, baselineB);
  } finally {
    await first.close();
    await second.close();
  }
});

test("onboarding is accessible at 320, 390 and 1448 and preserves choice after a failed save", async ({ page }, testInfo) => {
  await register(page);
  const baseline = await ordersSnapshot(page.context());
  for (const width of [320, 390, 1448]) {
    await page.setViewportSize({ width, height: width === 1448 ? 1086 : width === 390 ? 693 : 569 });
    await expect(page.getByRole("radio")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`onboarding-${width}.png`), fullPage: true });
    // Double actual computed text sizes, including px-based typography. Merely
    // changing :root font-size would leave this page's px labels unchanged.
    const zoomCss = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".onb-shell *"))
      .filter(element => Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()))
      .map((element, index) => {
        element.dataset.onboardingTextzoom = String(index);
        return `[data-onboarding-textzoom="${index}"] { font-size: ${parseFloat(getComputedStyle(element).fontSize) * 2}px !important; }`;
      }).join("\n"));
    const zoom = await page.addStyleTag({ content: zoomCss });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Text at 200% must reflow within ${width}px`).toBe(true);
    for (const label of Object.values(choices)) {
      const radio = page.getByRole("radio", { name: label, exact: true });
      const bounds = await radio.locator("..").boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
    await page.screenshot({ path: testInfo.outputPath(`onboarding-${width}-text200.png`), fullPage: true });
    await zoom.evaluate(element => element.parentNode?.removeChild(element));
  }
  // Exercise the application's actual persisted preference mechanism separately
  // from the synthetic text-at-200% check above.
  await page.setViewportSize({ width: 320, height: 569 });
  const normalLabelSize = await page.locator(".onb-choice-copy strong").first().evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  await page.evaluate(() => {
    localStorage.setItem("mercado-cero:text-size", "xlarge");
    localStorage.setItem("mercado-cero:contrast", "high");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "xlarge");
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  expect(await page.locator(".onb-choice-copy strong").first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(normalLabelSize);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Persisted xlarge/high preferences must reflow at 320px").toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("onboarding-320-xlarge-high.png"), fullPage: true });
  expect(await profile(page.context())).toBeNull();
  expect(await ordersSnapshot(page.context())).toEqual(baseline);
  await page.evaluate(() => {
    localStorage.removeItem("mercado-cero:text-size");
    localStorage.removeItem("mercado-cero:contrast");
  });
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-text-size", "xlarge");
  await expect(page.locator("html")).not.toHaveAttribute("data-contrast", "high");
  expect(await page.locator(".onb-choice-copy strong").first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBe(normalLabelSize);
  await page.getByRole("radio", { name: choices.general, exact: true }).check();
  await page.route("**/api/business-profile", async route => {
    if (route.request().method() !== "PUT") return route.continue();
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "No pudimos guardar el giro. Inténtalo otra vez." }) });
  });
  await page.getByRole("button", { name: "Empezar con mi puesto", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No pudimos guardar tu giro" })).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("radio", { name: choices.general, exact: true })).toBeChecked();
  expect(await profile(page.context())).toBeNull();
  await page.unroute("**/api/business-profile");
  await save(page, "general");
  await emptyCaja(page, baseline);
});
