import crypto from "node:crypto";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
import { normalizeEntryInput, todayIso } from "../lib/validation.js";
import { transaction } from "../db/connection.js";
import { accountRows } from "./accounts.js";

const PREFIXES = {
  SALES_INVOICE: "SI",
  PURCHASE_BILL: "PB",
  CASH_RECEIPT: "CR",
  CASH_PAYMENT: "CP",
  GENERAL_JOURNAL: "JE",
  ADJUSTMENT: "ADJ",
};

function requestId(value) {
  if (value === undefined || value === null || value === "") return null;
  const id = String(value).trim();
  if (id.length > 100) {
    throw new ValidationError([{ field: "clientRequestId", message: "Request ID is too long." }]);
  }
  return id;
}

function allocateEntryNo(db, sourceType) {
  const row = db.prepare("SELECT next_value FROM number_sequences WHERE name = 'entry'").get();
  if (!row) throw new Error("Entry number sequence is missing.");
  const value = Number(row.next_value);
  db.prepare("UPDATE number_sequences SET next_value = ? WHERE name = 'entry'").run(value + 1);
  return `${PREFIXES[sourceType] || "JE"}-${String(value).padStart(6, "0")}`;
}

function insertLines(db, entryId, lines) {
  const statement = db.prepare(`
    INSERT INTO journal_lines (entry_id, line_no, account_id, description, debit_cents, credit_cents)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const line of lines) {
    statement.run(
      entryId,
      line.lineNo,
      line.accountId,
      line.description || "",
      line.debitCents,
      line.creditCents,
    );
  }
}

function lineRows(db, entryId) {
  return db
    .prepare(`
      SELECT id, entry_id, line_no, account_id, description, debit_cents, credit_cents
      FROM journal_lines
      WHERE entry_id = ?
      ORDER BY line_no ASC
    `)
    .all(entryId);
}

function mapLine(row) {
  return {
    id: String(row.id),
    lineNo: row.line_no,
    accountId: row.account_id,
    description: row.description,
    debitCents: row.debit_cents,
    creditCents: row.credit_cents,
  };
}

function mapEntry(row, lines, reversedBy = null) {
  return {
    id: row.id,
    entryNo: row.entry_no,
    sourceType: row.source_type,
    status: row.status,
    date: row.entry_date,
    memo: row.memo,
    reference: row.reference,
    adjustmentType: row.adjustment_type,
    adjustmentReason: row.adjustment_reason,
    clientRequestId: row.client_request_id,
    reversalOf: row.reversal_of_entry_id,
    reversalReason: row.reversal_reason,
    reversedBy,
    lines: lines.map(mapLine),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    postedAt: row.posted_at,
  };
}

export function getEntry(db, id) {
  const row = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(id);
  if (!row) return null;
  const link = db
    .prepare("SELECT reversal_entry_id FROM reversal_links WHERE original_entry_id = ?")
    .get(id);
  return mapEntry(row, lineRows(db, id), link?.reversal_entry_id || null);
}

export function listEntries(db) {
  const rows = db
    .prepare("SELECT * FROM journal_entries ORDER BY entry_date DESC, entry_no DESC")
    .all();
  const lines = db
    .prepare(`
      SELECT id, entry_id, line_no, account_id, description, debit_cents, credit_cents
      FROM journal_lines
      ORDER BY entry_id, line_no
    `)
    .all();
  const linesByEntry = new Map();
  for (const line of lines) {
    const list = linesByEntry.get(line.entry_id) || [];
    list.push(line);
    linesByEntry.set(line.entry_id, list);
  }
  const links = new Map(
    db
      .prepare("SELECT original_entry_id, reversal_entry_id FROM reversal_links")
      .all()
      .map((row) => [row.original_entry_id, row.reversal_entry_id]),
  );
  return rows.map((row) =>
    mapEntry(row, linesByEntry.get(row.id) || [], links.get(row.id) || null),
  );
}

function payloadFromRow(row, lines) {
  return {
    sourceType: row.source_type,
    date: row.entry_date,
    memo: row.memo,
    reference: row.reference,
    adjustmentType: row.adjustment_type,
    adjustmentReason: row.adjustment_reason,
    lines: lines.map((line) => ({
      accountId: line.account_id,
      description: line.description,
      debitCents: line.debit_cents,
      creditCents: line.credit_cents,
    })),
  };
}

function ensureActiveAccounts(db) {
  return accountRows(db).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    active: Boolean(row.active),
  }));
}

export function createDraft(db, body, { clientRequestId } = {}) {
  const request = requestId(clientRequestId);
  const accounts = ensureActiveAccounts(db);
  const input = normalizeEntryInput(body, { forPost: false, accounts });

  return transaction(db, () => {
    if (request) {
      const existing = db
        .prepare("SELECT id FROM journal_entries WHERE client_request_id = ?")
        .get(request);
      if (existing) {
        return { entry: getEntry(db, existing.id), idempotent: true };
      }
    }

    const id = `entry-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const entryNo = allocateEntryNo(db, input.sourceType);
    db.prepare(`
      INSERT INTO journal_entries (
        id, entry_no, source_type, status, entry_date, memo, reference,
        adjustment_type, adjustment_reason, client_request_id, version,
        created_at, updated_at, posted_at
      ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)
    `).run(
      id,
      entryNo,
      input.sourceType,
      input.date,
      input.memo,
      input.reference,
      input.adjustmentType,
      input.adjustmentReason,
      request,
      now,
      now,
    );
    insertLines(db, id, input.lines);
    return { entry: getEntry(db, id), idempotent: false };
  });
}

export function updateDraft(db, id, body) {
  const version = Number(body?.version);
  if (!Number.isInteger(version) || version < 1) {
    throw new ValidationError([
      { field: "version", message: "Reload the draft before saving changes." },
    ]);
  }

  const accounts = ensureActiveAccounts(db);
  const input = normalizeEntryInput(body, { forPost: false, accounts });

  return transaction(db, () => {
    const existing = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(id);
    if (!existing) throw new NotFoundError("The draft was not found.");
    if (existing.status !== "DRAFT") {
      throw new ConflictError("Posted entries cannot be edited.", [
        { field: "status", message: "Posted entries cannot be edited." },
      ]);
    }
    if (existing.source_type !== input.sourceType) {
      throw new ValidationError([
        { field: "sourceType", message: "The transaction type cannot be changed after a draft is created." },
      ]);
    }
    if (Number(existing.version) !== version) {
      throw new ConflictError("This draft changed in another request. Reload it and try again.", [
        { field: "version", message: "This draft changed in another request. Reload it and try again." },
      ]);
    }

    const now = new Date().toISOString();
    db.prepare("DELETE FROM journal_lines WHERE entry_id = ?").run(id);
    db.prepare(`
      UPDATE journal_entries
      SET entry_date = ?, memo = ?, reference = ?, adjustment_type = ?,
          adjustment_reason = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND status = 'DRAFT'
    `).run(
      input.date,
      input.memo,
      input.reference,
      input.adjustmentType,
      input.adjustmentReason,
      now,
      id,
    );
    insertLines(db, id, input.lines);
    return getEntry(db, id);
  });
}

export function deleteDraft(db, id) {
  return transaction(db, () => {
    const existing = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(id);
    if (!existing) throw new NotFoundError("The draft was not found.");
    if (existing.status !== "DRAFT") {
      throw new ConflictError("Posted entries cannot be deleted.", [
        { field: "status", message: "Posted entries cannot be deleted." },
      ]);
    }
    db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);
    return { id };
  });
}

export function postEntry(db, id) {
  return transaction(db, () => {
    const row = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(id);
    if (!row) throw new NotFoundError("The entry was not found.");
    if (row.status === "POSTED") {
      throw new ConflictError("This entry is already posted.", [
        { field: "status", message: "This entry is already posted." },
      ]);
    }

    const lines = lineRows(db, id);
    normalizeEntryInput(payloadFromRow(row, lines), {
      forPost: true,
      accounts: ensureActiveAccounts(db),
    });

    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE journal_entries
      SET status = 'POSTED', posted_at = ?, updated_at = ?, version = version + 1
      WHERE id = ? AND status = 'DRAFT' AND version = ?
    `).run(now, now, id, row.version);

    if (result.changes !== 1) {
      throw new ConflictError("This entry changed in another request. Reload it and try again.", [
        { field: "version", message: "This entry changed in another request. Reload it and try again." },
      ]);
    }
    return getEntry(db, id);
  });
}

export function reverseEntry(db, id, body = {}) {
  const reason = String(body?.reason ?? "").trim();
  const request = requestId(body?.clientRequestId);
  if (!reason) {
    throw new ValidationError([{ field: "reason", message: "Add a reason for the reversal." }]);
  }
  if (reason.length > 300) {
    throw new ValidationError([{ field: "reason", message: "Reversal reason must be 300 characters or fewer." }]);
  }

  return transaction(db, () => {
    const original = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(id);
    if (!original) throw new NotFoundError("The entry was not found.");
    if (original.status !== "POSTED") {
      throw new ConflictError("Only posted entries can be reversed.", [
        { field: "status", message: "Only posted entries can be reversed." },
      ]);
    }
    if (original.reversal_of_entry_id) {
      throw new ConflictError("A reversal entry cannot itself be reversed.", [
        { field: "status", message: "A reversal entry cannot itself be reversed." },
      ]);
    }

    const existingLink = db
      .prepare("SELECT reversal_entry_id FROM reversal_links WHERE original_entry_id = ?")
      .get(id);
    if (existingLink) {
      const existing = getEntry(db, existingLink.reversal_entry_id);
      if (request && existing?.clientRequestId === request) {
        return { entry: existing, idempotent: true };
      }
      throw new ConflictError("This entry already has a reversal.", [
        { field: "status", message: "This entry already has a reversal." },
      ]);
    }

    const originalLines = lineRows(db, id);
    const reversalId = `entry-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const entryNo = allocateEntryNo(db, "GENERAL_JOURNAL");
    db.prepare(`
      INSERT INTO journal_entries (
        id, entry_no, source_type, status, entry_date, memo, reference,
        adjustment_type, adjustment_reason, client_request_id,
        reversal_of_entry_id, reversal_reason, version, created_at, updated_at, posted_at
      ) VALUES (?, ?, 'GENERAL_JOURNAL', 'DRAFT', ?, ?, ?, NULL, NULL, ?, ?, ?, 1, ?, ?, NULL)
    `).run(
      reversalId,
      entryNo,
      todayIso(),
      `Reversal of ${original.entry_no}: ${original.memo}`,
      `REV-${original.entry_no}`,
      request,
      id,
      reason,
      now,
      now,
    );

    insertLines(
      db,
      reversalId,
      originalLines.map((line, index) => ({
        lineNo: index + 1,
        accountId: line.account_id,
        description: line.description || `Reversal of ${original.entry_no}`,
        debitCents: line.credit_cents,
        creditCents: line.debit_cents,
      })),
    );

    // Posting is still a separate, validated state transition. The database
    // trigger rechecks balance before the reversal becomes visible as posted.
    db.prepare(`
      UPDATE journal_entries
      SET status = 'POSTED', posted_at = ?, updated_at = ?
      WHERE id = ? AND status = 'DRAFT'
    `).run(now, now, reversalId);

    db.prepare(`
      INSERT INTO reversal_links (original_entry_id, reversal_entry_id, reason, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, reversalId, reason, now);

    return { entry: getEntry(db, reversalId), idempotent: false };
  });
}
