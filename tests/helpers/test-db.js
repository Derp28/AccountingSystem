import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDatabase, openDatabase } from "../../server/db/connection.js";
import { runMigrations } from "../../server/db/migrations.js";

/**
 * Create an isolated SQLite file with the production migrations applied.
 * The database is closed and the directory removed by cleanup().
 */
export function createTestDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ledgerline-test-"));
  const file = path.join(directory, "accounting.sqlite");
  const db = openDatabase(file);
  runMigrations(db);
  return {
    db,
    file,
    directory,
    reopen() {
      closeDatabase(db);
      return openDatabase(file);
    },
    cleanup() {
      closeDatabase(db);
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}
