import { test, expect } from '@playwright/test';
// TEMPLATE: adapt route and data-testid after auditing the actual app.
test('sale can be entered manually without microphone or assistant', async ({ page }) => {
  await page.goto('/ventas/nueva'); // TODO: map to actual route
  await expect(page.getByRole('heading', { name: /nueva venta/i })).toBeVisible();
  await expect(page.getByLabel(/qué vendiste|producto/i)).toBeVisible();
  // Add fixture registration with a safe isolated test DB.
});
test('QR requested is not payment verified', async ({ page }) => {
  // TODO: inject an authenticated mock provider that returns "requested", no verified event.
  // assert "Pendiente de confirmación" text, and no "Pago verificado".
});
test('mobile has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/'); // TODO: authenticated fixture
  const dimensions = await page.evaluate(() => ({ w:document.documentElement.scrollWidth, v:window.innerWidth }));
  expect(dimensions.w).toBeLessThanOrEqual(dimensions.v + 1);
});
