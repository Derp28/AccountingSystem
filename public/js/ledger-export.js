import {
  ADJUSTMENT_TYPE_MAP,
  CATEGORY_MAP,
  CASH_FLOW_CLASS_MAP,
  entryStatus,
  entryTotalCredit,
  entryTotalDebit,
  getSourceMeta,
  sortEntries,
} from "./accounting.js";
import { buildXlsx } from "./xlsx.js";

const REPORT_KEYS = [
  "trialBalance",
  "incomeStatement",
  "ownerEquity",
  "balanceSheet",
  "cashFlows",
];

const text = (value, style = "default") => ({
  text: value === null || value === undefined ? "" : String(value),
  style,
});
const money = (cents, style = "money") => ({ cents: cents ?? 0, style });
const count = (value, style = "default") => ({ number: value ?? 0, style });
const header = (...values) => values.map((value) => text(value, "header"));
const section = (value) => text(value, "section");
const note = (value) => text(value, "note");
const title = (value) => text(value, "title");

function basisLabel(value) {
  return value === "unadjusted" ? "Unadjusted" : "Adjusted";
}

function slugify(value) {
  return (
    String(value || "ledger")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ledger"
  );
}

function safeDateStamp(value) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? text
    : new Date().toISOString().slice(0, 10);
}

export function ledgerExportFilename(workspace, filters = {}) {
  const stamp = safeDateStamp(filters.to || filters.asOf);
  return `ledgerline-${slugify(workspace?.name)}-${stamp}.xlsx`;
}

function sourceLabel(value) {
  return getSourceMeta(value).label;
}

function categoryLabel(value) {
  return CATEGORY_MAP[value]?.label || value || "";
}

function cashFlowLabel(value) {
  return CASH_FLOW_CLASS_MAP[value]?.label || value || "";
}

function adjustmentTypeLabel(value) {
  return ADJUSTMENT_TYPE_MAP[value]?.label || value || "Adjustment";
}

function accountFor(accountId, accountById) {
  return accountById.get(accountId) || { code: "", name: "Unknown account" };
}

function entryTotals(entry) {
  return {
    debit: entryTotalDebit(entry),
    credit: entryTotalCredit(entry),
  };
}

function sortedLines(entry) {
  return [...(entry.lines || [])].sort((left, right) => (left.lineNo || 0) - (right.lineNo || 0));
}

function summarySheet({ workspace, accounts, entries, filters, reports, generatedAt }) {
  const currency = workspace?.currency || "USD";
  const ledgerName = workspace?.name || "Active ledger";
  const posted = entries.filter((entry) => entry.status === "POSTED");
  const drafts = entries.filter((entry) => entry.status === "DRAFT");
  const reversed = posted.filter((entry) => entry.reversedBy);
  const adjustments = entries.filter((entry) => entry.sourceType === "ADJUSTMENT");
  const transactions = entries.filter((entry) => entry.sourceType !== "ADJUSTMENT");
  const activeAccounts = accounts.filter((account) => account.active);
  const trialBalance = reports.trialBalance;
  const incomeStatement = reports.incomeStatement;
  const ownerEquity = reports.ownerEquity;
  const balanceSheet = reports.balanceSheet;
  const cashFlows = reports.cashFlows;

  return {
    name: "Summary",
    freezeRow: 1,
    columns: [34, 24, 62],
    rows: [
      header("Item", "Value", "Notes"),
      [text("Ledger", "bold"), text(ledgerName), note("Current active ledger only")],
      [text("Currency", "bold"), text(currency)],
      [text("Report basis", "bold"), text(basisLabel(filters.basis))],
      [text("Period", "bold"), text(`${filters.from || "—"} to ${filters.to || "—"}`)],
      [text("As of", "bold"), text(filters.asOf || "—")],
      [
        text("Generated", "bold"),
        text(generatedAt instanceof Date ? generatedAt.toISOString() : String(generatedAt)),
      ],
      [section("Activity"), null, null],
      [text("Accounts", "bold"), count(accounts.length)],
      [text("Active accounts", "bold"), count(activeAccounts.length)],
      [text("Business transactions", "bold"), count(transactions.length), note("Excludes adjustments")],
      [text("Adjustments", "bold"), count(adjustments.length)],
      [text("Journal entries", "bold"), count(entries.length)],
      [text("Posted entries", "bold"), count(posted.length)],
      [text("Draft entries", "bold"), count(drafts.length), note("Included in entry tabs with status")],
      [text("Reversed entries", "bold"), count(reversed.length)],
      [section("Trial balance"), null, null],
      [text("Basis", "bold"), text(basisLabel(trialBalance.basis))],
      [text("As of", "bold"), text(trialBalance.asOf)],
      [text("Accounts with balances", "bold"), count(trialBalance.rows.length)],
      [text("Total debits", "bold"), money(trialBalance.totalDebitCents)],
      [text("Total credits", "bold"), money(trialBalance.totalCreditCents)],
      [text("Difference", "bold"), money(trialBalance.differenceCents)],
      [
        text("Status", "bold"),
        text(trialBalance.balanced ? "Balanced" : "Needs review"),
        note(trialBalance.balanced ? "Debits equal credits" : "Debits do not equal credits"),
      ],
      [section("Statements"), null, null],
      [
        text("Net income (SOCI)", "bold"),
        money(incomeStatement.netIncomeCents),
        note(`${incomeStatement.from} to ${incomeStatement.to}`),
      ],
      [
        text("Owner's capital, end (SOE)", "bold"),
        money(ownerEquity.endingCapitalCents),
        note(ownerEquity.balanced ? "Ties to the balance sheet" : "Needs review"),
      ],
      [
        text("Total assets (SOFP)", "bold"),
        money(balanceSheet.totalAssetsCents),
        note(`As of ${balanceSheet.asOf}`),
      ],
      [
        text("Total liabilities + equity", "bold"),
        money(balanceSheet.totalLiabilitiesAndEquityCents),
        note(balanceSheet.balanced ? "Balanced" : "Needs review"),
      ],
      [
        text("Net change in cash (SOCF)", "bold"),
        money(cashFlows.netChangeCents),
        note(`${cashFlows.from} to ${cashFlows.to}`),
      ],
      [
        text("Cash at end (SOCF)", "bold"),
        money(cashFlows.endingCashCents),
        note(cashFlows.reconciled ? "Reconciles to Cash" : "Needs review"),
      ],
      [
        text("Cash reconciliation difference", "bold"),
        money(cashFlows.differenceCents),
        note("Ending cash − Cash account balance"),
      ],
      [section("Data scope"), null, null],
      [text("Entry tabs", "bold"), text("Include drafts"), note("Status shows Draft, Posted, or Reversed")],
      [
        text("Statements", "bold"),
        text("Posted entries only"),
        note("Uses the current Reports page basis and dates"),
      ],
      [
        note(
          "The financial statements use posted entries only. Transactions, General Journal, and Adjustments include drafts and show their status.",
        ),
        null,
        null,
      ],
    ],
  };
}

function accountsSheet({ workspace, accounts }) {
  const ledgerName = workspace?.name || "Active ledger";
  const rows = accounts
    .slice()
    .sort((left, right) =>
      String(left.code).localeCompare(String(right.code), undefined, { numeric: true }),
    )
    .map((account) => [
      text(account.code),
      text(account.name),
      text(categoryLabel(account.category)),
      text(account.description || ""),
      text(cashFlowLabel(account.cashFlowClass)),
      text(account.active ? "Active" : "Inactive"),
    ]);

  return {
    name: "Chart of Accounts",
    freezeRow: 3,
    columns: [10, 34, 16, 55, 18, 12],
    rows: [
      [title(`Chart of Accounts — ${ledgerName}`)],
      [note(`All ${accounts.length} accounts for the active ledger, including inactive accounts.`)],
      header("Code", "Account", "Category", "Description", "Cash-flow class", "Status"),
      ...(rows.length ? rows : [[note("No accounts found."), null, null, null, null, null]]),
    ],
  };
}

function transactionsSheet({ workspace, entries, entryNoById }) {
  const ledgerName = workspace?.name || "Active ledger";
  const currency = workspace?.currency || "USD";
  const rows = sortEntries(entries.filter((entry) => entry.sourceType !== "ADJUSTMENT")).map(
    (entry) => {
      const totals = entryTotals(entry);
      return [
        text(entry.entryNo),
        text(entry.date),
        text(sourceLabel(entry.sourceType)),
        text(entry.reference || ""),
        text(entry.memo),
        text(entryStatus(entry).label),
        money(totals.debit),
        money(totals.credit),
        count((entry.lines || []).length),
        text(entry.reversalOf ? entryNoById.get(entry.reversalOf) || entry.reversalOf : ""),
        text(entry.reversedBy ? entryNoById.get(entry.reversedBy) || entry.reversedBy : ""),
      ];
    },
  );

  return {
    name: "Business Transactions",
    freezeRow: 3,
    columns: [12, 12, 18, 16, 48, 12, 14, 14, 8, 14, 14],
    rows: [
      [title(`Business Transactions — ${ledgerName}`)],
      [
        note(
          `Sales, purchases, receipts, payments, and manual journal entries. Excludes adjustments. Includes drafts; status is shown. Amounts in ${currency}.`,
        ),
      ],
      header(
        "Entry no.",
        "Date",
        "Type",
        "Reference",
        "Memo",
        "Status",
        `Total debit (${currency})`,
        `Total credit (${currency})`,
        "Lines",
        "Reversal of",
        "Reversed by",
      ),
      ...(rows.length
        ? rows
        : [
            [
              note("No business transactions found."),
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
            ],
          ]),
      [
        note(
          "Amounts are the total debits and credits per entry. Drafts may be unbalanced and have no ledger effect.",
        ),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    ],
  };
}

function journalSheet({ workspace, entries, accountById }) {
  const ledgerName = workspace?.name || "Active ledger";
  const currency = workspace?.currency || "USD";
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = sortEntries(entries).flatMap((entry) =>
    sortedLines(entry).map((line) => {
      const account = accountFor(line.accountId, accountById);
      totalDebit += line.debitCents || 0;
      totalCredit += line.creditCents || 0;
      return [
        text(entry.entryNo),
        text(entry.date),
        text(sourceLabel(entry.sourceType)),
        text(entry.reference || ""),
        text(entry.memo),
        text(entryStatus(entry).label),
        count(line.lineNo),
        text(account.code),
        text(account.name),
        text(line.description || ""),
        money(line.debitCents),
        money(line.creditCents),
      ];
    }),
  );

  return {
    name: "General Journal",
    freezeRow: 3,
    columns: [12, 12, 18, 16, 45, 12, 8, 10, 32, 35, 14, 14],
    rows: [
      [title(`General Journal — ${ledgerName}`)],
      [
        note(
          `Every entry and journal line, including drafts and adjustments. Status is shown on each line. Amounts in ${currency}.`,
        ),
      ],
      header(
        "Entry no.",
        "Date",
        "Type",
        "Reference",
        "Memo",
        "Status",
        "Line",
        "Account code",
        "Account",
        "Description",
        `Debit (${currency})`,
        `Credit (${currency})`,
      ),
      ...(rows.length
        ? rows
        : [
            [
              note("No journal entries found."),
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
            ],
          ]),
      [
        text("Totals (all entries)", "totalLabel"),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        money(totalDebit, "total"),
        money(totalCredit, "total"),
      ],
      [
        note(
          "Totals include drafts. Only posted entries affect the trial balance and financial statements.",
        ),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    ],
  };
}

function adjustmentsSheet({ workspace, entries, accountById }) {
  const ledgerName = workspace?.name || "Active ledger";
  const currency = workspace?.currency || "USD";
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = sortEntries(entries.filter((entry) => entry.sourceType === "ADJUSTMENT")).flatMap(
    (entry) =>
      sortedLines(entry).map((line) => {
        const account = accountFor(line.accountId, accountById);
        totalDebit += line.debitCents || 0;
        totalCredit += line.creditCents || 0;
        return [
          text(entry.entryNo),
          text(entry.date),
          text(adjustmentTypeLabel(entry.adjustmentType)),
          text(entry.reference || ""),
          text(entry.memo),
          text(entryStatus(entry).label),
          text(entry.adjustmentReason || ""),
          count(line.lineNo),
          text(account.code),
          text(account.name),
          text(line.description || ""),
          money(line.debitCents),
          money(line.creditCents),
        ];
      }),
  );

  return {
    name: "Adjustments",
    freezeRow: 3,
    columns: [12, 12, 20, 16, 40, 12, 35, 8, 10, 32, 35, 14, 14],
    rows: [
      [title(`Adjustments — ${ledgerName}`)],
      [
        note(
          `Manual adjustment entries and their journal lines, including drafts. Every adjustment keeps its type and reason. Amounts in ${currency}.`,
        ),
      ],
      header(
        "Entry no.",
        "Date",
        "Adjustment type",
        "Reference",
        "Memo",
        "Status",
        "Reason",
        "Line",
        "Account code",
        "Account",
        "Description",
        `Debit (${currency})`,
        `Credit (${currency})`,
      ),
      ...(rows.length
        ? rows
        : [
            [
              note("No adjustments found."),
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
              null,
            ],
          ]),
      [
        text("Totals (all adjustments)", "totalLabel"),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        money(totalDebit, "total"),
        money(totalCredit, "total"),
      ],
      [
        note(
          "Adjustments are manual entries only; the app does not generate accrual, depreciation, or period-close calculations.",
        ),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    ],
  };
}

function trialBalanceSheet({ workspace, reports }) {
  const ledgerName = workspace?.name || "Active ledger";
  const currency = workspace?.currency || "USD";
  const report = reports.trialBalance;
  const rows = report.rows.map((row) => [
    text(row.account.code),
    text(row.account.name),
    money(row.debitCents),
    money(row.creditCents),
    money(row.balanceCents),
  ]);

  return {
    name: "Trial Balance",
    freezeRow: 3,
    columns: [10, 36, 16, 16, 22],
    rows: [
      [title(`Trial Balance — ${ledgerName}`)],
      [
        note(
          `${basisLabel(report.basis)} basis · as of ${report.asOf}. Posted entries only. Amounts in ${currency}.`,
        ),
      ],
      header(
        "Code",
        "Account",
        `Debit (${currency})`,
        `Credit (${currency})`,
        `Balance (${currency})`,
      ),
      ...(rows.length
        ? rows
        : [[note("No posted activity through this date."), null, null, null, null]]),
      [
        text("Totals", "totalLabel"),
        null,
        money(report.totalDebitCents, "total"),
        money(report.totalCreditCents, "total"),
        money(report.differenceCents, "total"),
      ],
      [
        note(
          report.balanced
            ? "Debits equal credits. Balance is debit minus credit."
            : "Debits do not equal credits. Review the ledger before relying on this schedule.",
        ),
        null,
        null,
        null,
        null,
      ],
    ],
  };
}

function accountAmountRows(rows, currency) {
  if (!rows.length) return [[note("No activity in this section."), null, null]];
  return rows.map((row) => [
    text(row.account.code),
    text(row.account.name),
    money(row.amountCents),
  ]);
}

function incomeStatementSheet({ workspace, reports }) {
  const ledgerName = workspace?.name || "Active ledger";
  const currency = workspace?.currency || "USD";
  const report = reports.incomeStatement;
  return {
    name: "SOCI",
    freezeRow: 3,
    columns: [12, 50, 18],
    rows: [
      [title(`Statement of Comprehensive Income — ${ledgerName}`)],
      [
        note(
          `${basisLabel(report.basis)} basis · ${report.from} to ${report.to}. Posted entries only. Amounts in ${currency}.`,
        ),
      ],
      header("Code", "Account", `Amount (${currency})`),
      [section("Revenue"), null, null],
      ...accountAmountRows(report.revenueRows, currency),
      [
        text("Total revenue", "totalLabel"),
        null,
        money(report.totalRevenueCents, "total"),
      ],
      [section("Expenses"), null, null],
      ...accountAmountRows(report.expenseRows, currency),
      [
        text("Total expenses", "totalLabel"),
        null,
        money(report.totalExpensesCents, "total"),
      ],
      [null, null, null],
      [text("Net income", "totalLabel"), null, money(report.netIncomeCents, "total")],
      [
        note(
          "Revenue − Expenses = Net income. The ledger has no other comprehensive income items, so comprehensive income equals net income.",
        ),
        null,
        null,
      ],
    ],
  };
}

function ownerEquitySheet({ workspace, reports }) {
  const ledgerName = workspace?.name || "Active ledger";
  const currency = workspace?.currency || "USD";
  const report = reports.ownerEquity;
  const investmentRows = report.investmentRows.map((row) => [
    text(`  ${row.account.code} ${row.account.name}`),
    money(row.amountCents),
  ]);
  const withdrawalRows = report.withdrawalRows.map((row) => [
    text(`  ${row.account.code} ${row.account.name}`),
    money(-row.amountCents),
  ]);

  return {
    name: "SOE",
    freezeRow: 3,
    columns: [58, 18],
    rows: [
      [title(`Statement of Owner's Equity — ${ledgerName}`)],
      [
        note(
          `${basisLabel(report.basis)} basis · ${report.from} to ${report.to}. Posted entries only. Amounts in ${currency}.`,
        ),
      ],
      header("Item", `Amount (${currency})`),
      [text("Owner's capital, beginning of period", "bold"), money(report.beginningCapitalCents)],
      [text("Add: additional investments", "bold"), money(report.additionalInvestmentsCents)],
      ...investmentRows,
      [text("Add: net income (loss)", "bold"), money(report.netIncomeCents)],
      [text("Less: withdrawals", "bold"), money(-report.withdrawalsCents)],
      ...withdrawalRows,
      [null, null],
      [text("Owner's capital, end of period", "totalLabel"), money(report.endingCapitalCents, "total")],
      [text("Reported equity at end (balance sheet)", "bold"), money(report.reportedEquityCents)],
      [text("Difference", "bold"), money(report.differenceCents)],
      [
        note(
          report.balanced
            ? "Ties to the Statement of Financial Position's total equity."
            : "Does not tie to the Statement of Financial Position; review the ledger.",
        ),
        null,
      ],
      [
        note(
          "Beginning capital includes all posted earnings before the period; this app does not close the books.",
        ),
        null,
      ],
    ],
  };
}

function financialPositionSheet({ workspace, reports }) {
  const ledgerName = workspace?.name || "Active ledger";
  const currency = workspace?.currency || "USD";
  const report = reports.balanceSheet;
  const equityRows = [
    ...report.equityRows.map((row) => [
      text(row.account.code),
      text(row.account.name),
      money(row.amountCents),
    ]),
    [text("—"), text("Accumulated earnings (computed)"), money(report.accumulatedEarningsCents)],
  ];

  return {
    name: "SOFP",
    freezeRow: 3,
    columns: [12, 50, 18],
    rows: [
      [title(`Statement of Financial Position — ${ledgerName}`)],
      [
        note(
          `${basisLabel(report.basis)} basis · as of ${report.asOf}. Posted entries only. Amounts in ${currency}.`,
        ),
      ],
      header("Code", "Account", `Amount (${currency})`),
      [section("Assets"), null, null],
      ...accountAmountRows(report.assetRows, currency),
      [text("Total assets", "totalLabel"), null, money(report.totalAssetsCents, "total")],
      [section("Liabilities"), null, null],
      ...accountAmountRows(report.liabilityRows, currency),
      [
        text("Total liabilities", "totalLabel"),
        null,
        money(report.totalLiabilitiesCents, "total"),
      ],
      [section("Equity"), null, null],
      ...equityRows,
      [text("Total equity", "totalLabel"), null, money(report.totalEquityCents, "total")],
      [null, null, null],
      [
        text("Total liabilities + equity", "totalLabel"),
        null,
        money(report.totalLiabilitiesAndEquityCents, "total"),
      ],
      [text("Difference", "bold"), null, money(report.differenceCents)],
      [
        note(
          report.balanced
            ? "Assets = Liabilities + Owner's equity."
            : "Assets do not equal liabilities plus equity; review the ledger.",
        ),
        null,
        null,
      ],
    ],
  };
}

function cashFlowSectionRows(label, rows, totalCents, currency) {
  return [
    [section(label), null, null],
    ...(rows.length
      ? rows.map((row) => [text(row.account.code), text(row.account.name), money(row.amountCents)])
      : [[note("No activity in this section."), null, null]]),
    [text(`Net cash from ${label.toLowerCase()}`, "totalLabel"), null, money(totalCents, "total")],
  ];
}

function cashFlowsSheet({ workspace, reports }) {
  const ledgerName = workspace?.name || "Active ledger";
  const currency = workspace?.currency || "USD";
  const report = reports.cashFlows;
  return {
    name: "SOCF",
    freezeRow: 3,
    columns: [12, 50, 18],
    rows: [
      [title(`Statement of Cash Flows — ${ledgerName}`)],
      [
        note(
          `${basisLabel(report.basis)} basis · ${report.from} to ${report.to}. Posted entries only. Amounts in ${currency}.`,
        ),
      ],
      header("Code", "Account", `Amount (${currency})`),
      ...cashFlowSectionRows("Operating activities", report.operatingRows, report.operatingCents, currency),
      ...cashFlowSectionRows("Investing activities", report.investingRows, report.investingCents, currency),
      ...cashFlowSectionRows("Financing activities", report.financingRows, report.financingCents, currency),
      [null, null, null],
      [
        text("Net increase (decrease) in cash", "totalLabel"),
        null,
        money(report.netChangeCents, "total"),
      ],
      [section("Cash reconciliation"), null, null],
      [text("Cash at beginning of period", "bold"), null, money(report.beginningCashCents)],
      [text("Net increase (decrease) in cash", "bold"), null, money(report.netChangeCents)],
      [
        text("Cash at end of period", "totalLabel"),
        null,
        money(report.endingCashCents, "total"),
      ],
      [text("Cash account balance at end", "bold"), null, money(report.cashBalanceCents)],
      [text("Difference", "bold"), null, money(report.differenceCents)],
      [
        note(
          report.reconciled
            ? "Ending cash reconciles to the Cash account balance. Transfers between cash accounts are excluded."
            : "Ending cash does not reconcile to the Cash account balance; review the ledger.",
        ),
        null,
        null,
      ],
    ],
  };
}

/**
 * Build the complete active-ledger workbook. This function is pure so the same
 * data and code can be used by the live app, the in-browser demo, and tests.
 */
export function buildLedgerWorkbook({
  workspace,
  accounts = [],
  entries = [],
  filters = {},
  reports,
  generatedAt = new Date(),
}) {
  for (const key of REPORT_KEYS) {
    if (!reports?.[key]) throw new Error(`The ${key} report is required for the export.`);
  }

  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const entryNoById = new Map(entries.map((entry) => [entry.id, entry.entryNo]));
  const sheets = [
    summarySheet({ workspace, accounts, entries, filters, reports, generatedAt }),
    accountsSheet({ workspace, accounts }),
    transactionsSheet({ workspace, entries, entryNoById }),
    journalSheet({ workspace, entries, accountById }),
    adjustmentsSheet({ workspace, entries, accountById }),
    trialBalanceSheet({ workspace, reports }),
    incomeStatementSheet({ workspace, reports }),
    ownerEquitySheet({ workspace, reports }),
    financialPositionSheet({ workspace, reports }),
    cashFlowsSheet({ workspace, reports }),
  ];

  return {
    filename: ledgerExportFilename(workspace, filters),
    bytes: buildXlsx(sheets, { generatedAt }),
  };
}
