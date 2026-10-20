import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Open the single local SQLite file and apply connection-level safety pragmas.
 * Only the backend opens this file; the browser never receives the path.
 */
export function openDatabase(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(filePath);

  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA temp_store = MEMORY;");

  if (filePath !== ":memory:") {
    try {
      fs.chmodSync(filePath, 0o600);
    } catch {
      // Filesystems without POSIX permissions (for example a mounted drive)
      // still benefit from loopback-only access.
    }
  }

  return db;
}

export function closeDatabase(db) {
  try {
    db.close();
  } catch {
    // Closing an already-closed handle is harmless.
  }
}

/**
 * Run a synchronous mutation in an immediate transaction so writers serialize
 * and failures roll back completely.
 */
export function transaction(db, work) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const result = work();
    db.exec("COMMIT;");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // Preserve the original error if rollback itself fails.
    }
    throw error;
  }
}

export function schemaVersion(db) {
  const row = db.prepare("SELECT COUNT(*) AS version FROM schema_migrations").get();
  return Number(row?.version || 0);
}
