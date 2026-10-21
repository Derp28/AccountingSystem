import { normalizeProfileInput, normalizeWorkspaceInput } from "../lib/validation.js";
import { transaction } from "../db/connection.js";

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLedger(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getProfile(db, userId = null) {
  const row = userId
    ? db.prepare("SELECT * FROM users WHERE id = ?").get(userId)
    : db.prepare("SELECT * FROM users ORDER BY created_at LIMIT 1").get();
  return mapUser(row);
}

export function getWorkspace(db, ledgerId = null) {
  const row = ledgerId
    ? db.prepare("SELECT * FROM ledgers WHERE id = ?").get(ledgerId)
    : db.prepare("SELECT * FROM ledgers ORDER BY created_at LIMIT 1").get();
  return mapLedger(row);
}

export function saveProfile(db, userId, body) {
  const input = normalizeProfileInput(body);
  return transaction(db, () => {
    db.prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?").run(
      input.name,
      new Date().toISOString(),
      userId,
    );
    return getProfile(db, userId);
  });
}

export function saveWorkspace(db, ledgerId, body) {
  const input = normalizeWorkspaceInput(body);
  return transaction(db, () => {
    db.prepare("UPDATE ledgers SET name = ?, currency = ?, updated_at = ? WHERE id = ?").run(
      input.name,
      input.currency,
      new Date().toISOString(),
      ledgerId,
    );
    return getWorkspace(db, ledgerId);
  });
}
