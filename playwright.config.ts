import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // E2E tests share a Dexie DB + emulator — run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker — Firebase Emulator + Dexie don't like parallel
  reporter: process.env.CI
    ? [["html"], ["junit", { outputFile: "test-results/junit.xml" }]]
    : "list",
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm run dev",
    url: "http://localhost:3000",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI, // CI starts fresh; local reuses running dev server
  },
});
