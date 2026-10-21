import crypto from "node:crypto";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { normalizeAccountInput } from "../lib/validation.js";
import { transaction } from "../db/connection.js";

function mapAccount(row) {
  return {
    id: row.id,
    ledgerId: row.ledger_id,
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function accountRows(db, ledgerId) {
  return db
    .prepare("SELECT * FROM accounts WHERE ledger_id = ? ORDER BY code COLLATE NOCASE ASC")
    .all(ledgerId);
}

export function accountActivity(db, ledgerId) {
  const rows = db
    .prepare(`
      SELECT l.account_id,
             SUM(l.debit_cents) AS debit_cents,
             SUM(l.credit_cents) AS credit_cents
      FROM journal_lines l
      JOIN journal_entries e ON e.id = l.entry_id
      WHERE e.ledger_id = ? AND e.status = 'POSTED'
      GROUP BY l.account_id
    `)
    .all(ledgerId);
  return new Map(rows.map((row) => [row.account_id, row]));
}

export function listAccounts(db, ledgerId) {
  const activity = accountActivity(db, ledgerId);
  return accountRows(db, ledgerId).map((row) => {
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

export function getAccount(db, ledgerId, id) {
  const row = db
    .prepare("SELECT * FROM accounts WHERE id = ? AND ledger_id = ?")
    .get(id, ledgerId);
  return row ? mapAccount(row) : null;
}

function assertCodeAvailable(db, ledgerId, code, excludeId = null) {
  const row = db
    .prepare(`
      SELECT id FROM accounts
      WHERE ledger_id = ? AND lower(code) = lower(?)
        AND (? IS NULL OR id <> ?)
    `)
    .get(ledgerId, code, excludeId, excludeId);
  if (row) {
    throw new ConflictError("That account code is already in use.", [
      { field: "code", message: "That account code is already in use." },
    ]);
  }
}

export function createAccount(db, ledgerId, body) {
  const input = normalizeAccountInput(body);
  return transaction(db, () => {
    assertCodeAvailable(db, ledgerId, input.code);
    const id = `acct-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO accounts (
        id, ledger_id, code, name, category, description, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      ledgerId,
      input.code,
      input.name,
      input.category,
      input.description,
      input.active ? 1 : 0,
      now,
      now,
    );
    return getAccount(db, ledgerId, id);
  });
}

export function updateAccount(db, ledgerId, id, body) {
  const input = normalizeAccountInput(body);
  return transaction(db, () => {
    const existing = db
      .prepare("SELECT * FROM accounts WHERE id = ? AND ledger_id = ?")
      .get(id, ledgerId);
    if (!existing) throw new NotFoundError("The account was not found.");
    assertCodeAvailable(db, ledgerId, input.code, id);
    db.prepare(`
      UPDATE accounts
      SET code = ?, name = ?, category = ?, description = ?, active = ?, updated_at = ?
      WHERE id = ? AND ledger_id = ?
    `).run(
      input.code,
      input.name,
      input.category,
      input.description,
      input.active ? 1 : 0,
      new Date().toISOString(),
      id,
      ledgerId,
    );
    return getAccount(db, ledgerId, id);
  });
}

export function setAccountActive(db, ledgerId, id, active) {
  return transaction(db, () => {
    const existing = db
      .prepare("SELECT * FROM accounts WHERE id = ? AND ledger_id = ?")
      .get(id, ledgerId);
    if (!existing) throw new NotFoundError("The account was not found.");
    db.prepare("UPDATE accounts SET active = ?, updated_at = ? WHERE id = ? AND ledger_id = ?").run(
      active ? 1 : 0,
      new Date().toISOString(),
      id,
      ledgerId,
    );
    return getAccount(db, ledgerId, id);
  });
}
