import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the case-study screenshot harness. Drives the bench
 * dev server (port 3001) and writes screenshots into `results/case-studies/`.
 *
 * Each case study takes 10–20 s to build all stages (the OCC kernel does
 * real work), so the per-test timeout is generous. Workers are kept at 1
 * because the bench server is single-port and several simultaneous
 * heavyweight tabs would compete for the same Worker pool.
 */
export default defineConfig({
  testDir: "./playwright",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  use: {
    baseURL: process.env.BENCH_BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    viewport: { width: 720, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 720, height: 720 },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    port: 3001,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
