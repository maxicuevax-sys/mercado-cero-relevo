import { test, expect, type Route } from "@playwright/test";
import { execFileSync } from "node:child_process";

test("Nuevo ignores late automatic QR, manual Consultar and polling responses", async ({ page }) => {
  test.setTimeout(90_000);
  expect((await (await page.request.get("/api/health")).json()).buildSha).toBe(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());
  await page.goto("/acceso");
  await page.getByRole("button", { name: "Entrar sin cuenta", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("radio", { name: "Un poco de todo", exact: true }).check();
  await page.getByRole("button", { name: "Empezar con mi puesto", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  const response = await page.request.post("/api/orders", { data: {
    items: [{ description: "QA async CoDi", quantity: 1, unitPriceCents: 1100 }],
    cashCents: 0, creditCents: 0, requestId: "qa_async_codi_regression",
  } });
  expect(response.status()).toBe(201);
  const order = (await response.json()).order;
  const count = (await (await page.request.get("/api/orders")).json()).orders.length;
  let unexpectedCreates = 0;
  page.on("request", r => { if (r.method() === "POST" && new URL(r.url()).pathname === "/api/orders") unexpectedCreates++; });
  for (const mode of ["automatic QR", "manual Consultar", "polling"] as const) {
    await test.step(mode, async () => {
      let release!: () => void, arrived!: () => void, delivered!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const received = new Promise<void>(resolve => { arrived = resolve; });
      const finished = new Promise<void>(resolve => { delivered = resolve; });
      const pattern = mode === "automatic QR" ? `**/api/orders/${order.id}/pay` : `**/api/orders/${order.id}`;
      let held = false;
      const handler = async (route: Route) => {
        if (held) return route.continue();
        held = true;
        const upstream = await route.fetch();
        expect(upstream.status()).toBe(200);
        arrived();
        await gate;
        await route.fulfill({ response: upstream });
        delivered();
      };
      await page.route(pattern, handler);
      try {
        await page.goto(`/inicio?pedido=${order.id}#cobrar-codi`);
        if (mode === "manual Consultar") await page.getByRole("button", { name: "Consultar estado", exact: true }).click();
        // Polling runs naturally after five seconds, without mocked payloads.
        await received;
        await page.getByRole("button", { name: "Nuevo cobro", exact: true }).click();
        await expect(page.locator("#mc-codi-amount")).toHaveValue("");
        release();
        await finished;
        // Flush the real fetch/json continuation and any pending React render.
        await page.waitForTimeout(300);
        await expect(page.locator("#mc-codi-amount")).toHaveValue("");
        await expect(page.locator(".mc-codi__order-amount")).toHaveCount(0);
        await expect(page.locator(".mc-codi__error")).toHaveCount(0);
        await expect(page.locator(".mc-codi__cta")).toBeEnabled();
        expect(new URL(page.url()).searchParams.has("pedido")).toBe(false);
      } finally {
        release();
        await page.unroute(pattern, handler);
      }
    });
  }
  expect(unexpectedCreates).toBe(0);
  expect((await (await page.request.get("/api/orders")).json()).orders).toHaveLength(count);
  expect((await (await page.request.get(`/api/orders/${order.id}`)).json()).order.paidCents).toBe(0);
});
