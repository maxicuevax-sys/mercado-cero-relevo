import { defineConfig } from "@playwright/test";
import { lstatSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";

const port = 4666;
const origin = `http://127.0.0.1:${port}`;
// Playwright evaluates this config in the runner and again in workers. Keep
// one invocation's ephemeral scope in inherited process env, never an artifact.
const rootKey = "TRANGUI_JUDGE_BROWSER_ROOT";
const secretKey = "TRANGUI_JUDGE_BROWSER_SECRET";
const temporaryRoot = realpathSync(tmpdir());
const inheritedRoot = process.env[rootKey];
const inheritedSecret = process.env[secretKey];
if (inheritedRoot !== undefined || inheritedSecret !== undefined) {
  if (!inheritedRoot || !path.isAbsolute(inheritedRoot) ||
      path.dirname(inheritedRoot) !== temporaryRoot ||
      !/^trangui-judge-browser-[A-Za-z0-9]{6,}$/.test(path.basename(inheritedRoot)) ||
      !inheritedSecret || !/^[A-Za-z0-9_-]{64}$/.test(inheritedSecret)) {
    throw new Error("Invalid inherited isolated judge test scope");
  }
  const stat = lstatSync(inheritedRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(inheritedRoot) !== inheritedRoot) {
    throw new Error("Judge test root must be a real temporary directory");
  }
} else {
  process.env[rootKey] = mkdtempSync(path.join(temporaryRoot, "trangui-judge-browser-"));
  process.env[secretKey] = randomBytes(48).toString("base64url");
}
const dataRoot = process.env[rootKey]!;
const authSecret = process.env[secretKey]!;
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
      PILOT_AUTH_SECRET: authSecret,
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
