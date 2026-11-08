import { defineConfig } from "@playwright/test";
import path from "node:path";

const port = 4664;
export default defineConfig({
  testDir: "./scripts/access-browser",
  workers: 1,
  retries: 0,
  timeout: 30000,
  outputDir: "./test-results/access-ui",
  reporter: [["list"], ["json", { outputFile: "./test-results/access-results.json" }]],
  use: { browserName: "chromium", headless: true, baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    // Like the runtime harness, this requires a clean, exact-SHA production build.
    command: `node node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    timeout: 30000,
    reuseExistingServer: false,
    env: {
      DEMO_MODE: "true",
      APP_URL: `http://127.0.0.1:${port}`,
      DATABASE_PATH: path.resolve("test-results/access-ui/demo.db"),
      PEY_API_KEY: "",
      PEY_WEBHOOK_SECRET: "",
      OPENAI_API_KEY: "",
    },
  },
});
