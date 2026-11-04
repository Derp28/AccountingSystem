import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "../helpers/test-db.js";
import { draftPayload, setupProfileWorkspace } from "../helpers/fixtures.js";
import { createDraft, postEntry, reverseEntry } from "../../server/services/entries.js";
import { createAccount } from "../../server/services/accounts.js";
import {
  getBalanceSheet,
  getCashFlows,
  getIncomeStatement,
  getOwnerEquity,
  getTrialBalance,
} from "../../server/services/reports.js";
import { todayIso } from "../../server/lib/validation.js";

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
    // The reversal is dated today (D-019), so the as-of date must include it.
    const unadjusted = getTrialBalance(db, ledgerId, { asOf: todayIso(), basis: "unadjusted" });
    assert.equal(unadjusted.totalDebitCents, 250000);
    assert.equal(unadjusted.totalCreditCents, 250000);

    const adjusted = getTrialBalance(db, ledgerId, { asOf: todayIso(), basis: "adjusted" });
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

function cashPost(
  db,
  ledgerId,
  { date, debit, credit, amount, memo = "Cash entry", sourceType = "CASH_RECEIPT" },
) {
  return post(db, ledgerId, {
    sourceType,
    date,
    memo,
    lines: [
      { accountId: debit, debitCents: amount, creditCents: 0 },
      { accountId: credit, debitCents: 0, creditCents: amount },
    ],
  });
}

test("owner's equity rolls forward and ties to the balance sheet", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    cashPost(db, ledgerId, {
      date: "2026-10-01",
      debit: "acct-100",
      credit: "acct-300",
      amount: 10000000,
      memo: "Owner investment",
      sourceType: "GENERAL_JOURNAL",
    });
    cashPost(db, ledgerId, {
      date: "2026-10-25",
      debit: "acct-301",
      credit: "acct-100",
      amount: 300000,
      memo: "Owner drawing",
      sourceType: "CASH_PAYMENT",
    });
    cashPost(db, ledgerId, {
      date: "2026-10-28",
      debit: "acct-100",
      credit: "acct-400",
      amount: 500000,
      memo: "Cash services",
    });
    cashPost(db, ledgerId, {
      date: "2026-10-30",
      debit: "acct-500",
      credit: "acct-100",
      amount: 1000000,
      memo: "Salaries paid",
      sourceType: "CASH_PAYMENT",
    });
    post(db, ledgerId, draftPayload()); // 250,000 AR/revenue, non-cash
    adjustment(db, ledgerId); // 50,000 expense/201, non-cash

    const adjusted = getOwnerEquity(db, ledgerId, {
      from: "2026-10-01",
      to: "2026-10-31",
      basis: "adjusted",
    });
    assert.equal(adjusted.beginningCapitalCents, 0);
    assert.equal(adjusted.additionalInvestmentsCents, 10000000);
    assert.equal(adjusted.netIncomeCents, -300000);
    assert.equal(adjusted.withdrawalsCents, 300000);
    assert.equal(adjusted.endingCapitalCents, 9400000);
    assert.equal(adjusted.reportedEquityCents, 9400000);
    assert.equal(adjusted.balanced, true);
    assert.equal(adjusted.investmentRows.length, 1);
    assert.equal(adjusted.investmentRows[0].account.code, "300");
    assert.equal(adjusted.withdrawalRows.length, 1);
    assert.equal(adjusted.withdrawalRows[0].account.code, "301");

    const balanceSheet = getBalanceSheet(db, ledgerId, {
      asOf: "2026-10-31",
      basis: "adjusted",
    });
    assert.equal(adjusted.endingCapitalCents, balanceSheet.totalEquityCents);

    const unadjusted = getOwnerEquity(db, ledgerId, {
      from: "2026-10-01",
      to: "2026-10-31",
      basis: "unadjusted",
    });
    // Only the normal salaries payment is an expense; the 50,000 adjustment is excluded.
    assert.equal(unadjusted.netIncomeCents, -250000);
    assert.equal(unadjusted.endingCapitalCents, 9450000);
    const unadjustedSheet = getBalanceSheet(db, ledgerId, {
      asOf: "2026-10-31",
      basis: "unadjusted",
    });
    assert.equal(unadjusted.endingCapitalCents, unadjustedSheet.totalEquityCents);

    // A later period starts from the adjusted ending capital and rolls forward.
    laterSale(db, ledgerId);
    const november = getOwnerEquity(db, ledgerId, {
      from: "2026-11-01",
      to: "2026-11-30",
      basis: "adjusted",
    });
    assert.equal(november.beginningCapitalCents, 9400000);
    assert.equal(november.netIncomeCents, 100000);
    assert.equal(november.endingCapitalCents, 9500000);
  } finally {
    cleanup();
  }
});

test("cash flow sections classify cash entries and reconcile to cash", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    cashPost(db, ledgerId, {
      date: "2026-10-01",
      debit: "acct-100",
      credit: "acct-300",
      amount: 10000000,
      memo: "Owner investment",
      sourceType: "GENERAL_JOURNAL",
    });
    cashPost(db, ledgerId, {
      date: "2026-10-02",
      debit: "acct-103",
      credit: "acct-100",
      amount: 1500000,
      memo: "Office equipment",
      sourceType: "CASH_PAYMENT",
    });
    cashPost(db, ledgerId, {
      date: "2026-10-03",
      debit: "acct-102",
      credit: "acct-100",
      amount: 150000,
      memo: "Office supplies",
      sourceType: "CASH_PAYMENT",
    });
    cashPost(db, ledgerId, {
      date: "2026-10-04",
      debit: "acct-100",
      credit: "acct-400",
      amount: 500000,
      memo: "Cash services",
    });
    cashPost(db, ledgerId, {
      date: "2026-10-25",
      debit: "acct-301",
      credit: "acct-100",
      amount: 300000,
      memo: "Owner drawing",
      sourceType: "CASH_PAYMENT",
    });
    cashPost(db, ledgerId, {
      date: "2026-10-30",
      debit: "acct-500",
      credit: "acct-100",
      amount: 1000000,
      memo: "Salaries paid",
      sourceType: "CASH_PAYMENT",
    });
    post(db, ledgerId, draftPayload()); // non-cash credit sale
    adjustment(db, ledgerId); // non-cash accrual
    post(db, ledgerId, {
      sourceType: "ADJUSTMENT",
      date: "2026-10-31",
      memo: "Salaries paid at period end",
      adjustmentType: "OTHER",
      adjustmentReason: "Cash payment recorded as an adjustment.",
      lines: [
        { accountId: "acct-500", debitCents: 400000, creditCents: 0 },
        { accountId: "acct-100", debitCents: 0, creditCents: 400000 },
      ],
    });

    const adjusted = getCashFlows(db, ledgerId, {
      from: "2026-10-01",
      to: "2026-10-31",
      basis: "adjusted",
    });
    assert.equal(adjusted.operatingCents, -900000);
    assert.equal(adjusted.investingCents, -1650000);
    assert.equal(adjusted.financingCents, 9700000);
    assert.equal(adjusted.netChangeCents, 7150000);
    assert.equal(adjusted.beginningCashCents, 0);
    assert.equal(adjusted.endingCashCents, 7150000);
    assert.equal(adjusted.cashBalanceCents, 7150000);
    assert.equal(adjusted.differenceCents, 0);
    assert.equal(adjusted.reconciled, true);
    assert.deepEqual(
      adjusted.operatingRows.map((row) => [row.account.code, row.amountCents]),
      [
        ["400", 500000],
        ["500", -1400000],
      ],
    );
    assert.deepEqual(
      adjusted.investingRows.map((row) => [row.account.code, row.amountCents]),
      [
        ["102", -150000],
        ["103", -1500000],
      ],
    );
    assert.deepEqual(
      adjusted.financingRows.map((row) => [row.account.code, row.amountCents]),
      [
        ["300", 10000000],
        ["301", -300000],
      ],
    );

    const unadjusted = getCashFlows(db, ledgerId, {
      from: "2026-10-01",
      to: "2026-10-31",
      basis: "unadjusted",
    });
    // The cash adjustment is excluded on the unadjusted basis.
    assert.equal(unadjusted.operatingCents, -500000);
    assert.equal(unadjusted.netChangeCents, 7550000);
    assert.equal(unadjusted.endingCashCents, 7550000);
    assert.equal(unadjusted.cashBalanceCents, 7550000);
    assert.equal(unadjusted.reconciled, true);
  } finally {
    cleanup();
  }
});

test("transfers between cash accounts do not appear as cash flows", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerId = setupProfileWorkspace(db);
    cashPost(db, ledgerId, {
      date: "2026-10-01",
      debit: "acct-100",
      credit: "acct-300",
      amount: 1000000,
      memo: "Owner investment",
      sourceType: "GENERAL_JOURNAL",
    });
    const petty = createAccount(db, ledgerId, {
      code: "105",
      name: "Petty Cash",
      category: "ASSET",
      description: "Cash on hand.",
      cashFlowClass: "CASH",
    });
    cashPost(db, ledgerId, {
      date: "2026-10-05",
      debit: petty.id,
      credit: "acct-100",
      amount: 100000,
      memo: "Transfer to petty cash",
      sourceType: "GENERAL_JOURNAL",
    });

    const flows = getCashFlows(db, ledgerId, {
      from: "2026-10-02",
      to: "2026-10-31",
      basis: "adjusted",
    });
    assert.equal(flows.operatingCents, 0);
    assert.equal(flows.investingCents, 0);
    assert.equal(flows.financingCents, 0);
    assert.equal(flows.netChangeCents, 0);
    assert.equal(flows.beginningCashCents, 1000000);
    assert.equal(flows.endingCashCents, 1000000);
    assert.equal(flows.cashBalanceCents, 1000000);
    assert.equal(flows.reconciled, true);
  } finally {
    cleanup();
  }
});
