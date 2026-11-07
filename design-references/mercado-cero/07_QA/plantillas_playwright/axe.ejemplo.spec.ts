import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
// TEMPLATE: route and authentication must be replaced with real test fixtures.
test('critical screen has no automated WCAG A/AA issues detectable by axe', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});
