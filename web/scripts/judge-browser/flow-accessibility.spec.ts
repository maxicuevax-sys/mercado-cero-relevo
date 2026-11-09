import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ viewport: { width: 320, height: 844 } });

test("secondary forms and enlarged Fiados history keep readable navigation and contained actions", async ({ page, context, baseURL }, testInfo) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  expect((await context.request.post("/api/access/guest", { headers: { Origin: baseURL! }, data: {} })).status()).toBe(200);
  expect((await context.request.put("/api/business-profile", { headers: { Origin: baseURL! }, data: { businessType: "general" } })).status()).toBe(200);
  const credits = await context.request.get("/api/credits");
  expect(credits.status()).toBe(200);
  const id = (await credits.json()).credits[0].id;
  await page.goto("/inicio");
  for (const large of [false, true]) {
    await page.evaluate(({ large }) => {
      localStorage.setItem("mercado-cero:text-size", large ? "xlarge" : "normal");
      localStorage.setItem("mercado-cero:contrast", large ? "high" : "normal");
    }, { large });
    for (const route of ["/fiados/nuevo", "/metas/nueva", "/pendientes/nuevo", `/fiados/${id}`, `/fiados/${id}/abono`]) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      const nav = page.getByRole("navigation", { name: "Principal", exact: true });
      await expect(nav).toBeVisible();
      const background = await nav.evaluate(element => getComputedStyle(element).backgroundColor);
      expect(background).not.toBe("rgba(0, 0, 0, 0)");
      expect(background).not.toBe("transparent");
      expect((await nav.boundingBox())!.height).toBeGreaterThanOrEqual(56);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(result.violations).toEqual([]);
    }
    await page.screenshot({ path: testInfo.outputPath(large ? "history-xlarge.png" : "history-normal.png"), fullPage: true });
  }
});
