import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts/pilot-browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: "./test-results/pilot",
  reporter: [["list"], ["json", { outputFile: "./test-results/pilot-results.json" }]],
  use: { browserName: "chromium", headless: true, trace: "retain-on-failure" },
});
