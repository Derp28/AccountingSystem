import { ConflictError, ValidationError } from "../lib/errors.js";
import { normalizeProfileInput, normalizeWorkspaceInput } from "../lib/validation.js";
import { transaction } from "../db/connection.js";

function mapProfile(row) {
  if (!row) return null;
  return { name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapWorkspace(row) {
  if (!row) return null;
  return {
    name: row.name,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getProfile(db) {
  return mapProfile(db.prepare("SELECT * FROM profile WHERE id = 1").get());
}

export function getWorkspace(db) {
  return mapWorkspace(db.prepare("SELECT * FROM workspace WHERE id = 1").get());
}

export function saveProfile(db, body) {
  const input = normalizeProfileInput(body);
  return transaction(db, () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO profile (id, name, created_at, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at
    `).run(input.name, now, now);
    return getProfile(db);
  });
}

export function saveWorkspace(db, body) {
  const input = normalizeWorkspaceInput(body);
  return transaction(db, () => {
    if (!getProfile(db)) {
      throw new ConflictError("Create a profile before naming the workspace.", [
        { field: "workspace", message: "Create a profile before naming the workspace." },
      ]);
    }
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO workspace (id, name, currency, created_at, updated_at)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        currency = excluded.currency,
        updated_at = excluded.updated_at
    `).run(input.name, input.currency, now, now);
    return getWorkspace(db);
  });
}

export function requireSetup(db) {
  if (!getProfile(db)) {
    throw new ValidationError(
      [{ field: "setup", message: "Complete profile setup first." }],
      "Complete profile setup first.",
    );
  }
}
