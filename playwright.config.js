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
    command:
      "rm -f data/e2e.sqlite data/e2e.sqlite-wal data/e2e.sqlite-shm && ACCOUNTING_DB_PATH=data/e2e.sqlite PORT=3100 bash scripts/dev.sh",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
