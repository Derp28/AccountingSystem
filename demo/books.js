/**
 * Sample books for the public demo. `scripts/build-demo.mjs` replays this file
 * through the real services and a real SQLite database, so the published demo
 * obeys the same posting, numbering, and reversal rules as the shipped app.
 *
 * PLACEHOLDER CONTENT: AAA Computer Services still has to supply its own sample
 * transactions. Until then these entries keep every posting path visible -
 * journal, bill, invoice, receipt, payment, adjustment, reversal, and draft -
 * on the starter Chart of Accounts in server/lib/seed-accounts.js.
 *
 * Amounts are decimal strings in the ledger currency. They are parsed by the
 * server's own validation, so the demo cannot drift from the posting rules.
 */
export const demoBooks = {
  profile: {
    displayName: "AAA Computer Services",
    username: "aaa_cs",
    password: "demo-only-account-password",
  },
  main: { name: "General Ledger 2026", currency: "PHP" },
  second: { name: "Branch books", currency: "PHP" },
  entries: [
    {
      sourceType: "GENERAL_JOURNAL",
      date: "2026-10-02",
      memo: "Owner investment - cash",
      reference: "ORD-001",
      status: "POSTED",
      lines: [
        { code: "100", debit: "500000.00", description: "Cash contribution" },
        { code: "300", credit: "500000.00", description: "Owner's capital" },
      ],
    },
    {
      sourceType: "PURCHASE_BILL",
      date: "2026-10-03",
      memo: "Office equipment - two workstations",
      reference: "BILL-1001",
      status: "POSTED",
      lines: [
        { code: "103", debit: "180000.00", description: "Workstations and monitors" },
        { code: "200", credit: "180000.00", description: "Payable to the supplier" },
      ],
    },
    {
      sourceType: "SALES_INVOICE",
      date: "2026-10-06",
      memo: "Network setup - Dela Cruz Trading",
      reference: "INV-2001",
      status: "POSTED",
      lines: [
        { code: "101", debit: "85000.00", description: "Invoice total" },
        { code: "400", credit: "85000.00", description: "Network setup and cabling" },
      ],
    },
    {
      sourceType: "CASH_RECEIPT",
      date: "2026-10-09",
      memo: "Payment - Dela Cruz Trading",
      reference: "RCPT-3001",
      status: "POSTED",
      lines: [
        { code: "100", debit: "85000.00", description: "Bank deposit" },
        { code: "101", credit: "85000.00", description: "Applied to INV-2001" },
      ],
    },
    {
      sourceType: "CASH_PAYMENT",
      date: "2026-10-15",
      memo: "October salaries",
      reference: "PAY-4001",
      status: "POSTED",
      lines: [
        { code: "500", debit: "60000.00", description: "Salaries for October" },
        { code: "100", credit: "60000.00", description: "Payroll transfer" },
      ],
    },
    {
      sourceType: "PURCHASE_BILL",
      date: "2026-10-20",
      memo: "Printer paper and toner",
      reference: "BILL-1002",
      status: "POSTED",
      lines: [
        { code: "502", debit: "7500.00", description: "Supplies for the office" },
        { code: "200", credit: "7500.00", description: "Payable to the supplier" },
      ],
    },
    {
      sourceType: "ADJUSTMENT",
      date: "2026-10-27",
      memo: "Accrue October salaries",
      reference: "ADJ-2001",
      status: "POSTED",
      adjustmentType: "ACCRUED_EXPENSE",
      adjustmentReason: "Payroll for the last week of October is still unpaid at month end.",
      lines: [
        { code: "500", debit: "12000.00", description: "Unpaid October salaries" },
        { code: "203", credit: "12000.00", description: "Salaries payable" },
      ],
    },
    {
      sourceType: "ADJUSTMENT",
      date: "2026-10-27",
      memo: "Monthly depreciation - office equipment",
      reference: "ADJ-2002",
      status: "POSTED",
      adjustmentType: "DEPRECIATION",
      adjustmentReason: "Record one month of depreciation on office equipment.",
      lines: [
        { code: "503", debit: "3000.00", description: "October depreciation" },
        { code: "104", credit: "3000.00", description: "Accumulated depreciation" },
      ],
    },
    {
      sourceType: "SALES_INVOICE",
      date: "2026-10-26",
      memo: "Maintenance retainer - November",
      reference: "INV-2002",
      status: "DRAFT",
      lines: [
        { code: "101", debit: "40000.00", description: "November retainer" },
        { code: "400", credit: "40000.00", description: "Monthly maintenance" },
      ],
    },
  ],
  reversals: [
    {
      reference: "BILL-1002",
      reason: "The supplier billed the same delivery twice.",
    },
  ],
};
