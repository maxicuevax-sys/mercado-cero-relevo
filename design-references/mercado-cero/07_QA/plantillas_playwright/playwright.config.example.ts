import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  use: { baseURL: process.env.MC_TEST_BASE_URL || 'http://localhost:3000', screenshot: 'only-on-failure' },
  projects: [
    { name: 'mobile-android', use: { ...devices['Pixel 5'], reducedMotion: 'reduce' } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' } },
  ],
  /* webServer is deliberately omitted: inspect the app's actual start command first. */
});
