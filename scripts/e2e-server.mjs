import fs from "node:fs";
import path from "node:path";
import { projectRoot, run } from "./lib/runner.mjs";

/**
 * Boot a disposable server for Playwright: the E2E database is deleted first so
 * every run starts from an unclaimed installation, then the normal server starts
 * on port 3100. Used by the `webServer` block in playwright.config.js.
 */
const dbPath = path.join("data", "e2e.sqlite");

for (const suffix of ["", "-wal", "-shm"]) {
  fs.rmSync(path.join(projectRoot, dbPath + suffix), { force: true, maxRetries: 5 });
}

run(process.execPath, ["server/index.js"], {
  env: {
    HOST: "127.0.0.1",
    PORT: "3100",
    ACCOUNTING_DB_PATH: dbPath,
  },
});
