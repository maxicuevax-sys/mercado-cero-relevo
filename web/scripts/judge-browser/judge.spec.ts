import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const password = "Prueba-jueces-aislada-2026";
const privatePages = [
  "/", "/inicio", "/caja", "/ventas", "/ventas/ajeno", "/movimientos", "/movimientos/ajeno",
  "/fiados", "/fiados/nuevo", "/fiados/registrado", "/fiados/ajeno", "/fiados/ajeno/abono",
  "/fiados/juan/abono", "/corte", "/corte/historial", "/corte/historial/2026-11-07",
  "/pendientes", "/pendientes/nuevo", "/metas", "/metas/nueva", "/notificaciones",
  "/ajustes", "/ayuda", "/onboarding",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : [file];
  });
}

test("source inventory prevents new page or API exports from bypassing account scope", () => {
  const app = path.resolve("src/app");
  const buyerApis = ["/api/checkout/[id]", "/api/verify", "/api/webhooks/pey"];
  const discoveredPages: string[] = [];
  for (const file of sourceFiles(app)) {
    const relative = path.relative(app, file).split(path.sep).join("/");
    if (!relative.endsWith("page.tsx") && !relative.endsWith("route.ts")) continue;
    const source = readFileSync(file, "utf8");
    const route = `/${relative.replace(/\/?(?:page\.tsx|route\.ts)$/, "")}`;
    if (relative.endsWith("page.tsx")) {
      if (["/acceso", "/registro"].includes(route)) continue;
      expect(source, route).toMatch(/export default withPilotPage\(/);
      if (route.startsWith("/pay/")) {
        expect(source, route).toMatch(/withPilotPage\([^;]+\{ buyer: true \}/);
      } else {
        discoveredPages.push(route.replace(/\[id\]/g, "ajeno").replace(/\[fecha\]/g, "2026-11-07"));
      }
    } else if (route !== "/api/health" && !route.startsWith("/api/access/")) {
      const exported = [...source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)];
      expect(exported.length, `Missing classified handlers: ${route}`).toBeGreaterThan(0);
      for (const [, method] of exported) {
        expect(source, `${method} ${route}`).toMatch(new RegExp(`export const ${method} = withPilotRoute\\(`));
        if (buyerApis.includes(route)) {
          expect(source, `${method} ${route}`).toMatch(new RegExp(`export const ${method} = withPilotRoute\\([^;]+\\{ buyer: true \\}`));
        }
      }
    }
  }
  expect(discoveredPages.sort(), "Every private page must also have a live unauthenticated redirect check").toEqual([...privatePages].sort());
});

test.beforeAll(async ({ request }) => {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  expect(execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { encoding: "utf8" }).trim(),
    "Commit the complete implementation before generating exact-SHA evidence").toBe("");
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect((await response.json()).buildSha).toBe(sha);
});

async function signUp(page: Page, email: string) {
  await page.goto("/registro");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Juez temporal");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Crea una contraseña", { exact: true }).fill(password);
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    const pending = page.waitForResponse(response => response.url().endsWith("/api/access/sign-up") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Crear mi cuenta", exact: true }).click();
    const response = await pending;
    if (response.status() === 429 && attempt < 2) {
      expect((await page.context().request.get("/api/access/session")).status(), "Rate limiting must not create a session").toBe(401);
      const retryAfter = Number(response.headers()["retry-after"]);
      expect(Number.isInteger(retryAfter), "Native limiter must provide Retry-After seconds").toBe(true);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(10);
      await page.waitForTimeout(retryAfter * 1000);
      continue;
    }
    expect(response.status()).toBe(200);
    expect(await response.json(), "The browser gets an HttpOnly cookie, never a bearer token").toEqual({ ok: true });
    break;
  }
  await expect(page).toHaveURL(/\/inicio$/);
  const session = await page.context().request.get("/api/access/session");
  expect(session.status()).toBe(200);
  expect((await session.json()).user.email).toBe(email);
}

async function seedBrowserState(page: Page) {
  await page.evaluate(() => {
    for (const storage of [localStorage, sessionStorage]) {
      storage.setItem("mercado-cero:draft:v1", "private previous account draft");
      storage.setItem("mercado-cero:pending-order:v1", "private previous pending order");
      storage.setItem("mercado-cero:sale-request:v1", "private idempotency key");
      storage.setItem("mercado-cero:caja-draft:v2", "private legacy draft");
      storage.setItem("trangui:draft", "private app draft");
      storage.setItem("unrelated-app:keep", "preserve me");
    }
  });
}

async function expectBrowserStateCleared(page: Page) {
  expect(await page.evaluate(() => [localStorage, sessionStorage].map(storage => ({
    remaining: Object.keys(storage).filter(key => ["mercado-cero:draft:v1", "mercado-cero:pending-order:v1",
      "mercado-cero:sale-request:v1", "mercado-cero:caja-draft:v2", "trangui:draft"].includes(key)),
    unrelated: storage.getItem("unrelated-app:keep"),
  })))).toEqual([{ remaining: [], unrelated: "preserve me" }, { remaining: [], unrelated: "preserve me" }]);
}

async function createSale(context: BrowserContext, description: string) {
  const response = await context.request.post("/api/orders", {
    data: { items: [{ description, quantity: 1, unitPriceCents: 1350 }], cashCents: 1350, requestId: "same-key-in-each-account" },
    headers: { Origin: "http://127.0.0.1:4666" },
  });
  expect(response.status()).toBe(201);
  const { order } = await response.json();
  expect(order.status).toBe("demo_paid");
  return order.id as string;
}

test("two actual browser registrations keep sales and writes isolated across reloads", async ({ browser }) => {
  const first = await browser.newContext({ baseURL: "http://127.0.0.1:4666" });
  const second = await browser.newContext({ baseURL: "http://127.0.0.1:4666" });
  try {
    const pageA = await first.newPage();
    const pageB = await second.newPage();
    await signUp(pageA, "judge-a@example.test");
    await signUp(pageB, "judge-b@example.test");
    for (const context of [first, second]) {
      expect((await context.cookies()).some(cookie => cookie.httpOnly && cookie.sameSite === "Lax")).toBe(true);
    }
    const orderA = await createSale(first, "Producto exclusivo A");
    const orderB = await createSale(second, "Producto exclusivo B");
    expect(orderA).not.toBe(orderB);
    for (const [owner, foreign, id] of [[first, second, orderA], [second, first, orderB]] as const) {
      expect((await owner.request.get(`/api/orders/${id}`)).status()).toBe(200);
      expect((await foreign.request.get(`/api/orders/${id}`)).status()).toBe(404);
      expect((await foreign.request.patch(`/api/orders/${id}`, {
        data: { action: "fulfill" }, headers: { Origin: "http://127.0.0.1:4666" },
      })).status()).toBe(404);
    }
    for (const [page, id, foreignId] of [[pageA, orderA, orderB], [pageB, orderB, orderA]] as const) {
      await page.reload();
      await expect(page).toHaveURL(/\/inicio$/);
      const orders = await (await page.context().request.get("/api/orders")).json();
      expect(orders.orders.map((order: { id: string }) => order.id)).toContain(id);
      expect(orders.orders.map((order: { id: string }) => order.id)).not.toContain(foreignId);
    }
    expect((await new AxeBuilder({ page: pageA }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  } finally {
    await first.close();
    await second.close();
  }
});

test("unauthenticated pages, forged tenant headers and invalid session cookies fail closed", async ({ page, context }) => {
  for (const route of privatePages) {
    await page.goto(route);
    await expect(page, route).toHaveURL(/\/acceso(?:\?|$)/);
  }
  for (const route of ["/api/orders", "/api/orders/ajeno", "/api/credits", "/api/dashboard", "/api/tasks", "/api/cash", "/api/goals", "/api/analytics", "/api/pey/status", "/api/reconcile"]) {
    expect((await context.request.get(route, { headers: { "X-Account-Id": "judge-a", "X-Tenant-Id": "judge-a" } })).status(), route).toBe(401);
  }
  for (const route of ["/api/orders", "/api/tasks", "/api/goals", "/api/cash/close", "/api/cash/preview", "/api/demo/pay", "/api/demo/reset", "/api/tts", "/api/voice/parse", "/api/voice/transcribe", "/api/orders/ajeno/pay", "/api/orders/ajeno/sync-pey", "/api/credits/ajeno/pay", "/api/credits/ajeno/pay-link", "/api/goals/ajeno/contribute"]) {
    expect((await context.request.post(route, { data: {}, headers: { "X-Account-Id": "judge-a", "X-Tenant-Id": "judge-a" } })).status(), route).toBe(401);
  }
  for (const [method, route] of [["PATCH", "/api/orders/ajeno"], ["PATCH", "/api/tasks/ajeno"], ["DELETE", "/api/tasks/ajeno"]]) {
    expect((await context.request.fetch(route, { method, data: {}, headers: { "X-Account-Id": "judge-a", "X-Tenant-Id": "judge-a" } })).status(), `${method} ${route}`).toBe(401);
  }
  await signUp(page, "judge-invalid-cookie@example.test");
  const cookies = await context.cookies();
  expect(cookies.length).toBeGreaterThan(0);
  await context.addCookies(cookies.map(cookie => ({ ...cookie, value: "invalid-or-expired-session" })));
  expect((await context.request.get("/api/access/session")).status()).toBe(401);
  expect((await context.request.get("/api/orders")).status()).toBe(401);
});

test("public buyer and payment entrypoints cannot cross into legacy data", async ({ page, context }) => {
  await signUp(page, "judge-no-buyer@example.test");
  const id = await createSale(context, "Venta sin acceso público");
  for (const route of [`/pay/${id}`, `/pay/${id}/success`, `/api/checkout/${id}`, `/api/verify?transactionId=${id}`]) {
    expect((await context.request.get(route)).status(), route).toBe(404);
  }
  expect((await context.request.post("/api/webhooks/pey", { data: {} })).status()).toBe(404);
});

test("account transitions clear drafts, retain unrelated storage and revoke the old cookie", async ({ page, context, browser }) => {
  await page.goto("/registro");
  await seedBrowserState(page);
  await signUp(page, "judge-logout@example.test");
  await expectBrowserStateCleared(page);
  await page.goto("/ajustes");
  await seedBrowserState(page);
  const oldCookies = await context.cookies();
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/acceso$/);
  await expectBrowserStateCleared(page);
  expect((await context.request.get("/api/access/session")).status()).toBe(401);
  const replay = await browser.newContext({ baseURL: "http://127.0.0.1:4666" });
  try {
    await replay.addCookies(oldCookies);
    expect((await replay.request.get("/api/access/session")).status()).toBe(401);
    expect((await replay.request.get("/api/orders")).status()).toBe(401);
  } finally { await replay.close(); }
  await seedBrowserState(page);
  await page.getByLabel("Correo electrónico", { exact: true }).fill("judge-logout@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("Incorrecta-contraseña-2026");
  await page.getByRole("button", { name: "Entrar a mi demo", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  expect((await context.request.get("/api/access/session")).status()).toBe(401);
  await expect(page).toHaveURL(/\/acceso$/);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi demo", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  expect((await context.request.get("/api/access/session")).status()).toBe(200);
  await expectBrowserStateCleared(page);
});

for (const width of [390, 320]) {
  test(`auth accessibility and screenshots at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 693 });
    for (const route of ["/acceso", "/registro"]) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-${width}.png`), fullPage: true });
    }
  });
}
