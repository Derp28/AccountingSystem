import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDatabase, openDatabase } from "../../server/db/connection.js";
import { runMigrations } from "../../server/db/migrations.js";

/**
 * Remove the temporary database directory. Windows refuses to delete files that
 * are still open and briefly holds file handles after close, so the removal
 * retries instead of failing the test on a spurious EPERM/EBUSY.
 */
function removeDirectory(directory) {
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}

/**
 * Create an isolated SQLite file with the production migrations applied.
 * The database is closed and the directory removed by cleanup().
 *
 * The live handle is tracked internally so a test that calls reopen() still
 * cleans up the connection it actually used; otherwise Windows keeps the file
 * locked and the directory removal fails.
 */
export function createTestDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ledgerline-test-"));
  const file = path.join(directory, "accounting.sqlite");
  let handle = openDatabase(file);
  runMigrations(handle);

  return {
    get db() {
      return handle;
    },
    file,
    directory,
    reopen() {
      closeDatabase(handle);
      handle = openDatabase(file);
      return handle;
    },
    cleanup() {
      closeDatabase(handle);
      removeDirectory(directory);
    },
  };
}
