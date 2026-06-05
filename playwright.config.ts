import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4179",
    trace: "on-first-retry",
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
  ],
});
