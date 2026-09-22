import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Official inputs may appear in traces and failure screenshots. Keep those artifacts private.
const privateOutput = process.env.QTI3_EXTERNAL_QTI_DIR
  ? mkdtempSync(join(tmpdir(), "qti3-certification-browser-"))
  : undefined;

export default defineConfig({
  testDir: "tests/browser",
  // Exclude Vitest *.test.ts files that live under tests/browser/.
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  workers: 4,
  retries: process.env.CI ? 1 : 0,
  outputDir: privateOutput,
  reporter: privateOutput
    ? [["list"], ["json", { outputFile: join(privateOutput, "results.json") }]]
    : process.env.CI
      ? [["dot"], ["html", { open: "never" }]]
      : "list",
  use: {
    baseURL: "http://127.0.0.1:4179",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  webServer: {
    command: "pnpm exec vite --host 127.0.0.1 --port 4179 examples/manual",
    port: 4179,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox-slider",
      testMatch: "**/player-slider-cross-browser.spec.ts",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-slider",
      testMatch: "**/player-slider-cross-browser.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
