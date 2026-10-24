import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // scripts/e2e-server.mjs resets data/e2e.sqlite and starts the real server
    // on port 3100. Kept in Node so Windows, WSL, and CI use one command.
    command: "node scripts/e2e-server.mjs",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
