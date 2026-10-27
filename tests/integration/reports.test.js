import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "../helpers/test-db.js";
import { draftPayload, setupProfileWorkspace } from "../helpers/fixtures.js";
import { createDraft, postEntry, reverseEntry } from "../../server/services/entries.js";
import {
  getBalanceSheet,
  getIncomeStatement,
  getTrialBalance,
} from "../../server/services/reports.js";

function hasStatus(status) {
  return (error) => error.status === status;
}

function post(db, ledgerId, payload) {
  const { entry } = createDraft(db, ledgerId, payload);
  return postEntry(db, ledgerId, entry.id);
}

function adjustment(db, ledgerId, { date = "2026-10-20", amount = 50000 } = {}) {
  return post(db, ledgerId, {
    sourceType: "ADJUSTMENT",
    date,
    memo: "Accrue rent",
    adjustmentType: "OTHER",
    adjustmentReason: "Rent used but not yet invoiced.",
    lines: [
      { accountId: "acct-501", debitCents: amount, creditCents: 0 },
      { accountId: "acct-201", debitCents: 0, creditCents: amount },
    ],
  });
}

function laterSale(db, ledgerId) {
  return post(db, ledgerId, {
    sourceType: "SALES_INVOICE",
    date: "2026-11-05",
    memo: "November invoice",
    lines: [
      { accountId: "acct-101", debitCents: 100000, creditCents: 0 },
      { accountId: "acct-400", debitCents: 0, creditCents: 100000 },
    ],
  });
}

test("trial balance is net, as-of filtered, and excludes zeros", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    post(db, ledgerId, draftPayload()); // 2026-10-15 sale, 250000
    adjustment(db, ledgerId); // 2026-10-20 adjustment, 50000
    laterSale(db, ledgerId); // 2026-11-05 sale, 100000

    const adjusted = getTrialBalance(db, ledgerId, { asOf: "2026-10-31", basis: "adjusted" });
    assert.equal(adjusted.totalDebitCents, 300000);
    assert.equal(adjusted.totalCreditCents, 300000);
    assert.equal(adjusted.differenceCents, 0);
    assert.equal(adjusted.balanced, true);
    // November activity is outside the as-of window.
    assert.equal(adjusted.rows.length, 4);
    const expense = adjusted.rows.find((row) => row.account.code === "501");
    assert.equal(expense.debitCents, 50000);
    const liability = adjusted.rows.find((row) => row.account.code === "201");
    assert.equal(liability.creditCents, 50000);
    // Zero-balance accounts are omitted rather than printed as 0.00.
    assert.ok(adjusted.rows.every((row) => row.debitCents !== 0 || row.creditCents !== 0));

    const unadjusted = getTrialBalance(db, ledgerId, { asOf: "2026-10-31", basis: "unadjusted" });
    assert.equal(unadjusted.totalDebitCents, 250000);
    assert.equal(unadjusted.totalCreditCents, 250000);
    assert.equal(unadjusted.rows.length, 2);
    assert.equal(unadjusted.rows.find((row) => row.account.code === "501"), undefined);

    assert.throws(
      () => getTrialBalance(db, ledgerId, { basis: "cash" }),
      hasStatus(422),
    );
    assert.throws(
      () => getTrialBalance(db, ledgerId, { asOf: "2026-13-40" }),
      hasStatus(422),
    );
  } finally {
    cleanup();
  }
});

test("a reversed adjustment stays out of unadjusted reporting", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    post(db, ledgerId, draftPayload());
    const adj = adjustment(db, ledgerId);
    reverseEntry(db, ledgerId, adj.id, { reason: "Adjustment reversed" });

    // If the linked reversal were wrongly included while the original was
    // excluded, the unadjusted totals would become 300000 instead of 250000.
    const unadjusted = getTrialBalance(db, ledgerId, { asOf: "2026-10-31", basis: "unadjusted" });
    assert.equal(unadjusted.totalDebitCents, 250000);
    assert.equal(unadjusted.totalCreditCents, 250000);

    const adjusted = getTrialBalance(db, ledgerId, { asOf: "2026-10-31", basis: "adjusted" });
    assert.equal(adjusted.totalDebitCents, 250000);
    assert.equal(adjusted.totalCreditCents, 250000);
    assert.equal(adjusted.balanced, true);
  } finally {
    cleanup();
  }
});

test("income statement groups revenue and expenses for the period and basis", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    post(db, ledgerId, draftPayload());
    adjustment(db, ledgerId);
    laterSale(db, ledgerId);

    const adjusted = getIncomeStatement(db, ledgerId, {
      from: "2026-10-01",
      to: "2026-10-31",
      basis: "adjusted",
    });
    assert.equal(adjusted.totalRevenueCents, 250000);
    assert.equal(adjusted.totalExpensesCents, 50000);
    assert.equal(adjusted.netIncomeCents, 200000);
    assert.equal(adjusted.revenueRows.length, 1);
    assert.equal(adjusted.expenseRows.length, 1);

    const unadjusted = getIncomeStatement(db, ledgerId, {
      from: "2026-10-01",
      to: "2026-10-31",
      basis: "unadjusted",
    });
    assert.equal(unadjusted.totalRevenueCents, 250000);
    assert.equal(unadjusted.totalExpensesCents, 0);
    assert.equal(unadjusted.netIncomeCents, 250000);

    // The November sale sits outside the period.
    const nextPeriod = getIncomeStatement(db, ledgerId, {
      from: "2026-11-01",
      to: "2026-11-30",
      basis: "adjusted",
    });
    assert.equal(nextPeriod.totalRevenueCents, 100000);
    assert.equal(nextPeriod.netIncomeCents, 100000);

    assert.throws(
      () =>
        getIncomeStatement(db, ledgerId, { from: "2026-11-30", to: "2026-11-01" }),
      hasStatus(422),
    );
    assert.throws(
      () => getIncomeStatement(db, ledgerId, { from: "not-a-date" }),
      hasStatus(422),
    );
  } finally {
    cleanup();
  }
});

test("balance sheet balances on both bases with a computed accumulated earnings line", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    post(db, ledgerId, draftPayload());
    adjustment(db, ledgerId);

    const adjusted = getBalanceSheet(db, ledgerId, { asOf: "2026-10-31", basis: "adjusted" });
    assert.equal(adjusted.totalAssetsCents, 250000);
    assert.equal(adjusted.totalLiabilitiesCents, 50000);
    assert.equal(adjusted.accumulatedEarningsCents, 200000);
    assert.equal(adjusted.totalEquityCents, 200000);
    assert.equal(adjusted.totalLiabilitiesAndEquityCents, 250000);
    assert.equal(adjusted.differenceCents, 0);
    assert.equal(adjusted.balanced, true);
    assert.equal(adjusted.assetRows.length, 1);
    assert.equal(adjusted.liabilityRows.length, 1);

    const unadjusted = getBalanceSheet(db, ledgerId, { asOf: "2026-10-31", basis: "unadjusted" });
    assert.equal(unadjusted.totalAssetsCents, 250000);
    assert.equal(unadjusted.totalLiabilitiesCents, 0);
    assert.equal(unadjusted.accumulatedEarningsCents, 250000);
    assert.equal(unadjusted.totalEquityCents, 250000);
    assert.equal(unadjusted.balanced, true);
  } finally {
    cleanup();
  }
});
