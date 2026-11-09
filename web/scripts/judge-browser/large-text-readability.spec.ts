import { test, expect, type Locator } from "@playwright/test";

async function wordLines(locator: Locator, word: string) {
  return locator.evaluate((element, word) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const start = node.textContent?.indexOf(word) ?? -1;
      if (start < 0) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + word.length);
      return new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top))).size;
    }
    return 0;
  }, word);
}

test("large mobile text keeps assistant and merchant words readable", async ({ page, context, baseURL }, testInfo) => {
  expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
  expect((await context.request.post("/api/access/guest", { headers: { Origin: baseURL! }, data: {} })).status()).toBe(200);
  expect((await context.request.put("/api/business-profile", { headers: { Origin: baseURL! }, data: { businessType: "general" } })).status()).toBe(200);
  await page.goto("/ayuda");
  await page.locator("#asistente").getByRole("switch", { name: /Asistente opcional/ }).click();
  await page.evaluate(() => {
    localStorage.setItem("mercado-cero:text-size", "xlarge");
    localStorage.setItem("mercado-cero:contrast", "high");
  });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const font of [20, 32]) {
      // 20px is the app's xlarge option; 32px explicitly emulates 200% root text.
      await page.goto("/ayuda");
      await page.evaluate(font => { document.documentElement.style.fontSize = `${font}px`; }, font);
      await page.evaluate(() => document.fonts.ready);
      const assistant = page.locator("#asistente");
      await expect(assistant.locator(".mc-assistant-body")).toBeVisible();
      expect(await wordLines(assistant.locator("h2"), "Asistente")).toBe(1);
      const topics = assistant.locator(".mc-assistant-topics button span");
      for (const label of await topics.all()) {
        for (const word of (await label.innerText()).match(/\p{L}+/gu) ?? []) {
          expect(await wordLines(label, word), word).toBe(1);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await assistant.evaluate(element => element.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: testInfo.outputPath(`assistant-${width}-${font}.png`) });

      await page.goto("/fiados/nuevo");
      await page.evaluate(font => { document.documentElement.style.fontSize = `${font}px`; }, font);
      await page.evaluate(() => document.fonts.ready);
      expect(await wordLines(page.locator(".mc-flow__merchant strong"), "Antojitos")).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath(`merchant-${width}-${font}.png`) });
    }
  }
});
