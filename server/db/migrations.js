import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transaction } from "./connection.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MIGRATIONS_DIR = path.resolve(here, "..", "..", "migrations");

export function runMigrations(db, migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map((row) => row.version),
  );

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    transaction(db, () => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      ).run(file, new Date().toISOString());
    });
    count += 1;
  }

  return { applied: count, versions: files };
}
