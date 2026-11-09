import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";

const port = 4666;
const origin = `http://127.0.0.1:${port}`;
const dataRoot = mkdtempSync(path.join(tmpdir(), "trangui-judge-browser-"));
const browser = process.env.JUDGE_BROWSER ?? "chromium";
if (browser !== "chromium" && browser !== "webkit") throw new Error("JUDGE_BROWSER must be chromium or webkit");

export default defineConfig({
  testDir: "./scripts/judge-browser",
  workers: 1,
  retries: 0,
  timeout: 60000,
  projects: [{ name: browser, use: { browserName: browser } }],
  outputDir: `./test-results/judge-ui-${browser}`,
  reporter: [["list"], ["json", { outputFile: `./test-results/judge-${browser}-results.json` }]],
  use: { browserName: "chromium", headless: true, baseURL: origin, trace: "retain-on-failure" },
  webServer: {
    command: `node node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
    url: `${origin}/api/health`,
    timeout: 30000,
    reuseExistingServer: false,
    env: {
      JUDGE_DEMO_ACCOUNTS: "true",
      JUDGE_DATA_ROOT: dataRoot,
      PILOT_AUTH_SECRET: randomBytes(48).toString("base64url"),
      DEMO_MODE: "true",
      APP_URL: origin,
      DATABASE_PATH: path.join(dataRoot, "legacy-must-not-be-used.db"),
      PEY_API_KEY: "",
      PEY_WEBHOOK_SECRET: "",
      OPENAI_API_KEY: "",
      OPERATOR_ACCESS_TOKEN: "",
      DEMO_RESET_TOKEN: "",
    },
  },
});
