import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState, handleDemoRequest } from "../../demo/api.js";
import { seed } from "../../demo/seed.js";
import { buildLedgerWorkbook, ledgerExportFilename } from "../../public/js/ledger-export.js";
import { buildXlsx, centsToDecimal } from "../../public/js/xlsx.js";
import {
  cellValue,
  readZipEntries,
  readZipText,
  workbookSheetNames,
  worksheetXml,
} from "../helpers/xlsx.js";

const EXPECTED_SHEETS = [
  "Summary",
  "Chart of Accounts",
  "Business Transactions",
  "General Journal",
  "Adjustments",
  "Trial Balance",
  "SOCI",
  "SOE",
  "SOFP",
  "SOCF",
];

function demoRequest(state, method, path, body = null) {
  return handleDemoRequest(state, method, path, { body, headers: {} }).payload;
}

function reportFilters(bootstrap) {
  const dates = bootstrap.entries
    .filter((entry) => entry.status === "POSTED")
    .map((entry) => entry.date)
    .sort();
  return {
    basis: "adjusted",
    from: dates[0],
    to: dates.at(-1),
    asOf: dates.at(-1),
  };
}

function demoReports(state, filters) {
  const query = new URLSearchParams(filters).toString();
  const report = (name) =>
    demoRequest(state, "GET", `/api/reports/${name}?${query}`);
  return {
    trialBalance: report("trial-balance"),
    incomeStatement: report("income-statement"),
    ownerEquity: report("owner-equity"),
    balanceSheet: report("balance-sheet"),
    cashFlows: report("cash-flows"),
  };
}

test("the xlsx writer stores text safely and writes exact numeric money cells", () => {
  const bytes = buildXlsx(
    [
      {
        name: "Summary",
        rows: [
          [
            { text: "Item", style: "header" },
            { text: "Value", style: "header" },
          ],
          [
            { text: '=HYPERLINK("http://example.com","click")' },
            { cents: 123456, style: "money" },
          ],
          [{ text: "<&>" }, { cents: -123456, style: "money" }],
          [{ text: "five cents" }, { cents: 5, style: "money" }],
          [{ text: "count" }, { number: 42 }],
        ],
      },
    ],
    { generatedAt: new Date("2026-01-02T03:04:06.000Z") },
  );

  const entries = readZipEntries(bytes);
  assert.ok(entries.has("[Content_Types].xml"));
  assert.ok(entries.has("xl/workbook.xml"));
  assert.ok(entries.has("xl/styles.xml"));
  assert.deepEqual(workbookSheetNames(entries), ["Summary"]);

  const sheet = worksheetXml(entries, "Summary");
  assert.equal(cellValue(sheet, "A2"), '=HYPERLINK("http://example.com","click")');
  assert.equal(cellValue(sheet, "B2"), "1234.56");
  assert.equal(cellValue(sheet, "A3"), "<&>");
  assert.equal(cellValue(sheet, "B3"), "-1234.56");
  assert.equal(cellValue(sheet, "B4"), "0.05");
  assert.equal(cellValue(sheet, "B5"), "42");
  assert.match(sheet, /<c r="A2" t="inlineStr"/);
  assert.match(sheet, /&lt;&amp;&gt;/);
  assert.ok(!sheet.includes("<f"));
  assert.match(readZipText(entries, "xl/styles.xml"), /numFmtId="164"/);
});

test("the ledger workbook has every section, includes drafts with status, and uses posted report figures", () => {
  const state = createDemoState(seed);
  const bootstrap = demoRequest(state, "GET", "/api/bootstrap");
  const filters = reportFilters(bootstrap);
  const reports = demoReports(state, filters);

  const cash = bootstrap.accounts.find((account) => account.code === "100");
  const revenue = bootstrap.accounts.find((account) => account.code === "400");
  assert.ok(cash && revenue);

  const draft = demoRequest(state, "POST", "/api/entries", {
    sourceType: "GENERAL_JOURNAL",
    date: filters.to,
    memo: 'Export draft =SUM(A1:A2) <not a formula>',
    lines: [
      { accountId: cash.id, description: "Cash", debitCents: 1234, creditCents: 0 },
      { accountId: revenue.id, description: "Revenue", debitCents: 0, creditCents: 1234 },
    ],
  });
  assert.equal(draft.entry.status, "DRAFT");

  const refreshed = demoRequest(state, "GET", "/api/bootstrap");
  const result = buildLedgerWorkbook({
    workspace: refreshed.workspace,
    accounts: refreshed.accounts,
    entries: refreshed.entries,
    filters,
    reports,
    generatedAt: new Date("2026-11-05T12:00:00.000Z"),
  });

  assert.match(result.filename, /^ledgerline-.+-2023-12-31\.xlsx$/);
  assert.ok(!result.filename.endsWith(".slsx"));

  const entries = readZipEntries(result.bytes);
  assert.deepEqual(workbookSheetNames(entries), EXPECTED_SHEETS);

  const summary = worksheetXml(entries, "Summary");
  assert.equal(cellValue(summary, "A1"), "Item");
  assert.match(summary, /Current active ledger only/);
  assert.match(summary, /Include drafts/);

  const accountsSheet = worksheetXml(entries, "Chart of Accounts");
  assert.match(accountsSheet, /Cash/);
  assert.match(accountsSheet, /Cash-flow class/);

  const transactions = worksheetXml(entries, "Business Transactions");
  assert.match(transactions, /Export draft =SUM\(A1:A2\) &lt;not a formula&gt;/);
  assert.match(transactions, />Draft</);

  const journal = worksheetXml(entries, "General Journal");
  assert.match(journal, /Export draft =SUM\(A1:A2\) &lt;not a formula&gt;/);
  assert.match(journal, />Draft</);
  assert.match(journal, /Totals \(all entries\)/);

  const adjustments = worksheetXml(entries, "Adjustments");
  assert.match(adjustments, /Adjusting entry/);
  assert.match(adjustments, /Adjustment type/);

  const trialBalance = worksheetXml(entries, "Trial Balance");
  assert.match(trialBalance, /Posted entries only/);
  assert.ok(
    trialBalance.includes(`<v>${centsToDecimal(reports.trialBalance.totalDebitCents)}</v>`),
  );
  assert.ok(
    trialBalance.includes(`<v>${centsToDecimal(reports.trialBalance.totalCreditCents)}</v>`),
  );

  const soci = worksheetXml(entries, "SOCI");
  assert.match(soci, /Statement of Comprehensive Income/);
  assert.ok(soci.includes(`<v>${centsToDecimal(reports.incomeStatement.netIncomeCents)}</v>`));

  const soe = worksheetXml(entries, "SOE");
  assert.match(cellValue(soe, "A1"), /^Statement of Owner's Equity/);
  assert.ok(soe.includes(`<v>${centsToDecimal(reports.ownerEquity.endingCapitalCents)}</v>`));

  const sofp = worksheetXml(entries, "SOFP");
  assert.match(sofp, /Statement of Financial Position/);
  assert.ok(sofp.includes(`<v>${centsToDecimal(reports.balanceSheet.totalAssetsCents)}</v>`));

  const socf = worksheetXml(entries, "SOCF");
  assert.match(socf, /Statement of Cash Flows/);
  assert.ok(socf.includes(`<v>${centsToDecimal(reports.cashFlows.endingCashCents)}</v>`));

  for (const name of EXPECTED_SHEETS) {
    const sheet = worksheetXml(entries, name);
    assert.ok(!sheet.includes("<f"), `${name} must not contain formula cells`);
  }
});

test("the export filename is a safe .xlsx name for the active ledger", () => {
  assert.equal(
    ledgerExportFilename({ name: "E2E Books / 2026" }, { to: "2026-06-30" }),
    "ledgerline-e2e-books-2026-2026-06-30.xlsx",
  );
  assert.match(
    ledgerExportFilename({ name: "Books" }, { to: "../../not-a-date" }),
    /^ledgerline-books-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );
});
