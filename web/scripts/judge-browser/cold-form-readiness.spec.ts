import { test, expect } from "@playwright/test";

const forms = [
  { route: "/fiados/nuevo", field: "form input", value: "Primera captura QA" },
  { route: "/metas/nueva", field: "form input", value: "Primera captura QA" },
  { route: "/pendientes/nuevo", field: "form input", value: "Primera captura QA" },
  { route: "/corte", field: ".mc-corte-form input", value: "123.45" },
  { route: "/caja", field: "#mc-caja-new-description", value: "Primera captura QA" },
];

for (const { route, field, value } of forms) {
  test(`cold ${route} waits for handlers and retains its first edit`, async ({ page, context, baseURL }) => {
    expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
    const headers = { Origin: baseURL! };
    expect((await context.request.post("/api/access/guest", { headers, data: {} })).status()).toBe(200);
    expect((await context.request.put("/api/business-profile", { headers, data: { businessType: "general" } })).status()).toBe(200);
    const before = (await (await context.request.get("/api/orders?limit=100")).json()).orders.map((order: { id: string }) => order.id).sort();
    let release!: () => void;
    let scriptsReleased = false;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const writes: string[] = [];
    page.on("request", request => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) && new URL(request.url()).pathname.startsWith("/api/")) writes.push(new URL(request.url()).pathname);
    });
    await context.route("**/_next/static/**", async request => {
      if (new URL(request.request().url()).pathname.endsWith(".js") && !scriptsReleased) await gate;
      await request.continue();
    });
    try {
      await page.goto(route, { waitUntil: "commit" });
      const inputs = page.locator(field);
      await expect(inputs.first()).toBeVisible();
      for (const input of await inputs.all()) await expect(input).toBeDisabled();
      const submit = page.locator("form button[type=submit]");
      for (const button of await submit.all()) await expect(button).toBeDisabled();
      expect(new URL(page.url()).search).toBe("");
      scriptsReleased = true;
      release();
      await expect(inputs.first()).toBeEnabled();
      await inputs.first().fill(value);
      await inputs.first().blur();
      await expect(inputs.first()).toHaveValue(value);
      const after = (await (await context.request.get("/api/orders?limit=100")).json()).orders.map((order: { id: string }) => order.id).sort();
      expect(after).toEqual(before);
      expect(writes).toEqual([]);
    } finally {
      scriptsReleased = true;
      release();
    }
  });
}
