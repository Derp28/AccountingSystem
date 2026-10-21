import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "../helpers/test-db.js";
import {
  accountByCode,
  currentLedgerId,
  draftPayload,
  setupProfileWorkspace,
} from "../helpers/fixtures.js";
import { runMigrations } from "../../server/db/migrations.js";
import { getProfile, getWorkspace } from "../../server/services/setup.js";
import { listAccounts, setAccountActive } from "../../server/services/accounts.js";
import {
  createDraft,
  deleteDraft,
  getEntry,
  listEntries,
  postEntry,
  reverseEntry,
  updateDraft,
} from "../../server/services/entries.js";
import { getDashboard, getTrialBalance } from "../../server/services/reports.js";

function hasStatus(status) {
  return (error) => error.status === status;
}

test("migrations are idempotent for an already migrated database", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const second = runMigrations(db);
    assert.equal(second.applied, 0);
  } finally {
    cleanup();
  }
});

test("account-code range triggers reject out-of-range direct database writes", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = currentLedgerId(db);
    const now = new Date().toISOString();
    assert.throws(
      () =>
        db
          .prepare(`
            INSERT INTO accounts (id, ledger_id, code, name, category, description, active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run("acct-bad", ledgerId, "520", "Misclassified", "ASSET", "", 1, now, now),
      /outside its category hundred series/,
    );

    db.prepare(`
      INSERT INTO accounts (id, ledger_id, code, name, category, description, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("acct-199", ledgerId, "199", "Furniture", "ASSET", "", 1, now, now);

    assert.throws(
      () => db.prepare("UPDATE accounts SET category = 'EXPENSE' WHERE id = 'acct-199'").run(),
      /outside its category hundred series/,
    );
  } finally {
    cleanup();
  }
});

test("profile and workspace persist and survive reopening the file", () => {
  const context = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(context.db);
    assert.equal(getProfile(context.db).name, "Test Studio");
    assert.equal(getWorkspace(context.db, ledgerId).currency, "USD");

    const reopened = context.reopen();
    assert.equal(getProfile(reopened).name, "Test Studio");
    assert.equal(getWorkspace(reopened, ledgerId).name, "Test Books");
    assert.equal(listAccounts(reopened, ledgerId).length, 10);
  } finally {
    context.cleanup();
  }
});

test("drafts are excluded from balances until posted", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    const { entry } = createDraft(db, ledgerId, draftPayload());
    assert.equal(entry.status, "DRAFT");
    assert.equal(listAccounts(db, ledgerId).find((a) => a.code === "101").balanceCents, 0);

    const posted = postEntry(db, ledgerId, entry.id);
    assert.equal(posted.status, "POSTED");
    assert.equal(listAccounts(db, ledgerId).find((a) => a.code === "101").balanceCents, 250000);

    const trial = getTrialBalance(db, ledgerId);
    assert.equal(trial.totalDebitCents, 250000);
    assert.equal(trial.totalCreditCents, 250000);
    assert.equal(trial.differenceCents, 0);

    const dashboard = getDashboard(db, ledgerId);
    assert.equal(dashboard.assetsCents, 250000);
    assert.equal(dashboard.revenueCents, 250000);
    assert.equal(dashboard.netIncomeCents, 250000);
    assert.equal(dashboard.equationDifferenceCents, 0);
    assert.equal(dashboard.counts.draftEntries, 0);
  } finally {
    cleanup();
  }
});

test("unbalanced posting is rejected atomically and leaves the draft unchanged", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    const { entry } = createDraft(
      db,
      ledgerId,
      draftPayload({
        lines: [
          { accountId: "acct-110", debitCents: 250000, creditCents: 0 },
          { accountId: "acct-400", debitCents: 0, creditCents: 240000 },
        ],
      }),
    );

    assert.throws(() => postEntry(db, ledgerId, entry.id), hasStatus(422));
    const reloaded = getEntry(db, ledgerId, entry.id);
    assert.equal(reloaded.status, "DRAFT");
    assert.equal(reloaded.postedAt, null);
    assert.equal(getTrialBalance(db, ledgerId).rows.length, 0);
  } finally {
    cleanup();
  }
});

test("posted entries are immutable in the API and at the database layer", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    const { entry } = createDraft(db, ledgerId, draftPayload());
    postEntry(db, ledgerId, entry.id);

    assert.throws(
      () => updateDraft(db, ledgerId, entry.id, { ...draftPayload(), version: 1 }),
      hasStatus(409),
    );
    assert.throws(() => deleteDraft(db, ledgerId, entry.id), hasStatus(409));

    assert.throws(
      () => db.prepare("UPDATE journal_entries SET memo = 'silent edit' WHERE id = ?").run(entry.id),
      /immutable/,
    );
    assert.throws(
      () => db.prepare("DELETE FROM journal_entries WHERE id = ?").run(entry.id),
      /immutable/,
    );
    assert.throws(
      () => db.prepare("UPDATE journal_lines SET debit_cents = 1 WHERE entry_id = ?").run(entry.id),
      /immutable/,
    );
  } finally {
    cleanup();
  }
});

test("reversal creates a linked posted entry and nets the original to zero", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    const { entry } = createDraft(db, ledgerId, draftPayload());
    postEntry(db, ledgerId, entry.id);

    assert.throws(() => reverseEntry(db, ledgerId, entry.id, { reason: "   " }), hasStatus(422));
    const { entry: reversal } = reverseEntry(db, ledgerId, entry.id, {
      reason: "Customer cancelled",
    });
    assert.equal(reversal.status, "POSTED");
    assert.equal(reversal.reversalOf, entry.id);
    assert.equal(reversal.reversalReason, "Customer cancelled");

    const original = getEntry(db, ledgerId, entry.id);
    assert.equal(original.reversedBy, reversal.id);

    const trial = getTrialBalance(db, ledgerId);
    assert.equal(trial.totalDebitCents, trial.totalCreditCents);
    assert.equal(trial.differenceCents, 0);

    const dashboard = getDashboard(db, ledgerId);
    assert.equal(dashboard.assetsCents, 0);
    assert.equal(dashboard.revenueCents, 0);
    assert.equal(dashboard.equationDifferenceCents, 0);

    assert.throws(() => reverseEntry(db, ledgerId, entry.id, { reason: "Again" }), hasStatus(409));
    assert.throws(
      () => reverseEntry(db, ledgerId, reversal.id, { reason: "Reverse a reversal" }),
      hasStatus(409),
    );
    assert.equal(listEntries(db, ledgerId).length, 2);
  } finally {
    cleanup();
  }
});

test("duplicate posting and duplicate draft creation are idempotent or rejected without duplicates", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);

    const first = createDraft(db, ledgerId, draftPayload(), { clientRequestId: "req-create-1" });
    const retry = createDraft(db, ledgerId, draftPayload(), { clientRequestId: "req-create-1" });
    assert.equal(retry.idempotent, true);
    assert.equal(retry.entry.id, first.entry.id);
    assert.equal(listEntries(db, ledgerId).length, 1);

    postEntry(db, ledgerId, first.entry.id);
    assert.throws(() => postEntry(db, ledgerId, first.entry.id), hasStatus(409));
    assert.equal(
      listEntries(db, ledgerId).filter((entry) => entry.status === "POSTED").length,
      1,
    );
  } finally {
    cleanup();
  }
});

test("optimistic concurrency stops stale draft updates", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    const { entry } = createDraft(db, ledgerId, draftPayload());
    const updated = updateDraft(db, ledgerId, entry.id, {
      ...draftPayload({ memo: "First edit" }),
      version: 1,
    });
    assert.equal(updated.version, 2);

    assert.throws(
      () => updateDraft(db, ledgerId, entry.id, { ...draftPayload({ memo: "Stale edit" }), version: 1 }),
      hasStatus(409),
    );
    assert.equal(getEntry(db, ledgerId, entry.id).memo, "First edit");
  } finally {
    cleanup();
  }
});

test("deactivating an account blocks new drafts and posting but preserves history and corrections", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    const { entry } = createDraft(db, ledgerId, draftPayload());
    postEntry(db, ledgerId, entry.id);
    const pending = createDraft(db, ledgerId, draftPayload({ memo: "Created before deactivation" }));
    const receivable = accountByCode(db, "101", ledgerId);
    setAccountActive(db, ledgerId, receivable.id, false);

    assert.throws(
      () =>
        createDraft(db, ledgerId, {
          ...draftPayload(),
          lines: [
            { accountId: receivable.id, debitCents: 1000, creditCents: 0 },
            { accountId: "acct-400", debitCents: 0, creditCents: 1000 },
          ],
        }),
      hasStatus(422),
    );
    assert.throws(() => postEntry(db, ledgerId, pending.entry.id), hasStatus(422));

    assert.equal(listAccounts(db, ledgerId).find((a) => a.id === receivable.id).balanceCents, 250000);

    // A correction must remain possible for an account that was later deactivated.
    const reversal = reverseEntry(db, ledgerId, entry.id, { reason: "Account was closed after posting" });
    assert.equal(reversal.entry.status, "POSTED");
    assert.equal(listAccounts(db, ledgerId).find((a) => a.id === receivable.id).balanceCents, 0);

    setAccountActive(db, ledgerId, receivable.id, true);
    const after = createDraft(db, ledgerId, draftPayload());
    assert.equal(after.entry.status, "DRAFT");
  } finally {
    cleanup();
  }
});

test("adjustments require a type and reason before posting", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    assert.throws(
      () =>
        createDraft(db, ledgerId, {
          sourceType: "ADJUSTMENT",
          date: "2026-10-20",
          memo: "Accrue rent",
          lines: [
            { accountId: "acct-510", debitCents: 50000, creditCents: 0 },
            { accountId: "acct-210", debitCents: 0, creditCents: 50000 },
          ],
        }),
      hasStatus(422),
    );

    const { entry } = createDraft(db, ledgerId, {
      sourceType: "ADJUSTMENT",
      date: "2026-10-20",
      memo: "Accrue rent",
      adjustmentType: "ACCRUED_EXPENSE",
      adjustmentReason: "October rent not yet invoiced",
      lines: [
        { accountId: "acct-510", debitCents: 50000, creditCents: 0 },
        { accountId: "acct-210", debitCents: 0, creditCents: 50000 },
      ],
    });
    const posted = postEntry(db, ledgerId, entry.id);
    assert.equal(posted.status, "POSTED");
    const dashboard = getDashboard(db, ledgerId);
    assert.equal(dashboard.assetsCents, 0);
    assert.equal(dashboard.liabilitiesCents, 50000);
    assert.equal(dashboard.expensesCents, 50000);
    assert.equal(dashboard.netIncomeCents, -50000);
    assert.equal(dashboard.equationDifferenceCents, 0);
  } finally {
    cleanup();
  }
});

test("money columns reject non-integer values even before posting", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    const { entry } = createDraft(db, ledgerId, draftPayload());
    assert.throws(
      () =>
        db
          .prepare("UPDATE journal_lines SET debit_cents = 1.5 WHERE entry_id = ? AND line_no = 1")
          .run(entry.id),
      /constraint/i,
    );
  } finally {
    cleanup();
  }
});

test("entry numbers are server-generated, unique, and prefixed by source type", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    const sale = createDraft(db, ledgerId, draftPayload({ memo: "Sale" })).entry;
    const bill = createDraft(
      db,
      ledgerId,
      draftPayload({
        sourceType: "PURCHASE_BILL",
        memo: "Bill",
        lines: [
          { accountId: "acct-500", debitCents: 1000, creditCents: 0 },
          { accountId: "acct-200", debitCents: 0, creditCents: 1000 },
        ],
      }),
    ).entry;
    const adjustment = createDraft(db, ledgerId, {
      sourceType: "ADJUSTMENT",
      date: "2026-10-20",
      memo: "Adjustment",
      adjustmentType: "OTHER",
      adjustmentReason: "Test numbering",
      lines: [
        { accountId: "acct-510", debitCents: 1000, creditCents: 0 },
        { accountId: "acct-210", debitCents: 0, creditCents: 1000 },
      ],
    }).entry;

    assert.match(sale.entryNo, /^SI-\d{6}$/);
    assert.match(bill.entryNo, /^PB-\d{6}$/);
    assert.match(adjustment.entryNo, /^ADJ-\d{6}$/);
    assert.equal(new Set([sale.entryNo, bill.entryNo, adjustment.entryNo]).size, 3);
  } finally {
    cleanup();
  }
});
