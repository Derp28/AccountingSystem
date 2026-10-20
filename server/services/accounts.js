import crypto from "node:crypto";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { normalizeAccountInput } from "../lib/validation.js";
import { transaction } from "../db/connection.js";

function mapAccount(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function accountRows(db) {
  return db.prepare("SELECT * FROM accounts ORDER BY code COLLATE NOCASE ASC").all();
}

export function accountActivity(db) {
  const rows = db
    .prepare(`
      SELECT l.account_id,
             SUM(l.debit_cents) AS debit_cents,
             SUM(l.credit_cents) AS credit_cents
      FROM journal_lines l
      JOIN journal_entries e ON e.id = l.entry_id
      WHERE e.status = 'POSTED'
      GROUP BY l.account_id
    `)
    .all();
  return new Map(rows.map((row) => [row.account_id, row]));
}

export function listAccounts(db) {
  const activity = accountActivity(db);
  return accountRows(db).map((row) => {
    const totals = activity.get(row.id) || { debit_cents: 0, credit_cents: 0 };
    const raw = Number(totals.debit_cents || 0) - Number(totals.credit_cents || 0);
    const debitNormal = row.category === "ASSET" || row.category === "EXPENSE";
    return {
      ...mapAccount(row),
      debitCents: Number(totals.debit_cents || 0),
      creditCents: Number(totals.credit_cents || 0),
      rawBalanceCents: raw,
      balanceCents: debitNormal ? raw : -raw,
    };
  });
}

export function getAccount(db, id) {
  const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
  return row ? mapAccount(row) : null;
}

function assertCodeAvailable(db, code, excludeId = null) {
  const row = db
    .prepare("SELECT id FROM accounts WHERE lower(code) = lower(?) AND (? IS NULL OR id <> ?)")
    .get(code, excludeId, excludeId);
  if (row) {
    throw new ConflictError("That account code is already in use.", [
      { field: "code", message: "That account code is already in use." },
    ]);
  }
}

export function createAccount(db, body) {
  const input = normalizeAccountInput(body);
  return transaction(db, () => {
    assertCodeAvailable(db, input.code);
    const id = `acct-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO accounts (id, code, name, category, description, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.code,
      input.name,
      input.category,
      input.description,
      input.active ? 1 : 0,
      now,
      now,
    );
    return getAccount(db, id);
  });
}

export function updateAccount(db, id, body) {
  const input = normalizeAccountInput(body);
  return transaction(db, () => {
    const existing = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
    if (!existing) throw new NotFoundError("The account was not found.");
    assertCodeAvailable(db, input.code, id);
    db.prepare(`
      UPDATE accounts
      SET code = ?, name = ?, category = ?, description = ?, active = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.code,
      input.name,
      input.category,
      input.description,
      input.active ? 1 : 0,
      new Date().toISOString(),
      id,
    );
    return getAccount(db, id);
  });
}

export function setAccountActive(db, id, active) {
  return transaction(db, () => {
    const existing = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
    if (!existing) throw new NotFoundError("The account was not found.");
    db.prepare("UPDATE accounts SET active = ?, updated_at = ? WHERE id = ?").run(
      active ? 1 : 0,
      new Date().toISOString(),
      id,
    );
    return getAccount(db, id);
  });
}
