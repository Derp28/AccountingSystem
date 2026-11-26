/**
 * Sample books for the public demo. `scripts/build-demo.mjs` replays this file
 * through the real services and a real SQLite database, so the published demo
 * obeys the same posting, numbering, and reversal rules as the shipped app.
 *
 * The transactions are the owner's December 2023 sample set for AAA Computer
 * Services, recorded on the starter Chart of Accounts in
 * server/lib/seed-accounts.js. The 11 December hiring agreement has no entry:
 * agreeing to a salary does not move money or create a liability until payroll
 * is recorded.
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
  main: { name: "General Ledger 2023", currency: "PHP" },
  second: { name: "Branch books", currency: "PHP" },
  entries: [
    {
      sourceType: "GENERAL_JOURNAL",
      date: "2023-12-01",
      memo: "Owner investment",
      reference: "ORD-001",
      status: "POSTED",
      lines: [
        { code: "100", debit: "100000.00", description: "Cash contribution" },
        { code: "300", credit: "100000.00", description: "Owner's capital" },
      ],
    },
    {
      sourceType: "CASH_PAYMENT",
      date: "2023-12-02",
      memo: "Office equipment purchase",
      reference: "VOU-001",
      status: "POSTED",
      lines: [
        { code: "103", debit: "15000.00", description: "Office equipment" },
        { code: "100", credit: "15000.00", description: "Cash payment" },
      ],
    },
    {
      sourceType: "CASH_RECEIPT",
      date: "2023-12-05",
      memo: "Advance payment for computer services",
      reference: "OR-001",
      status: "POSTED",
      lines: [
        { code: "100", debit: "2000.00", description: "Advance received" },
        { code: "202", credit: "2000.00", description: "Unearned computer service revenue" },
      ],
    },
    {
      sourceType: "SALES_INVOICE",
      date: "2023-12-06",
      memo: "Computer services billed - BBB Client",
      reference: "INV-001",
      status: "POSTED",
      lines: [
        { code: "101", debit: "3500.00", description: "Invoice total" },
        { code: "400", credit: "3500.00", description: "Computer services" },
      ],
    },
    {
      sourceType: "CASH_RECEIPT",
      date: "2023-12-07",
      memo: "Collection from BBB Client",
      reference: "OR-002",
      status: "POSTED",
      lines: [
        { code: "100", debit: "1000.00", description: "Cash received" },
        { code: "101", credit: "1000.00", description: "Applied to INV-001" },
      ],
    },
    {
      sourceType: "CASH_RECEIPT",
      date: "2023-12-07",
      memo: "Computer services for cash - client",
      reference: "OR-004",
      status: "POSTED",
      lines: [
        { code: "100", debit: "5500.00", description: "Cash received" },
        { code: "400", credit: "5500.00", description: "Computer services" },
      ],
    },
    {
      sourceType: "CASH_PAYMENT",
      date: "2023-12-08",
      memo: "Office supplies purchase",
      reference: "VOU-002",
      status: "POSTED",
      lines: [
        { code: "102", debit: "1500.00", description: "Office supplies on hand" },
        { code: "100", credit: "1500.00", description: "Cash payment" },
      ],
    },
    {
      sourceType: "CASH_RECEIPT",
      date: "2023-12-10",
      memo: "Computer services for cash",
      reference: "OR-003",
      status: "POSTED",
      lines: [
        { code: "100", debit: "1800.00", description: "Cash received" },
        { code: "400", credit: "1800.00", description: "Computer services" },
      ],
    },
    {
      sourceType: "PURCHASE_BILL",
      date: "2023-12-12",
      memo: "Advertising bill",
      reference: "BILL-001",
      status: "POSTED",
      lines: [
        { code: "501", debit: "5500.00", description: "Advertising services" },
        { code: "204", credit: "5500.00", description: "Advertising payable" },
      ],
    },
    {
      sourceType: "GENERAL_JOURNAL",
      date: "2023-12-15",
      memo: "Owner withdrawal",
      reference: "DWG-001",
      status: "POSTED",
      lines: [
        { code: "301", debit: "3000.00", description: "Owner's withdrawal" },
        { code: "100", credit: "3000.00", description: "Cash withdrawal" },
      ],
    },
    {
      sourceType: "ADJUSTMENT",
      adjustmentType: "PREPAID_EXPENSE",
      adjustmentReason: "Office supplies used during December",
      date: "2023-12-31",
      memo: "Adjusting entry - office supplies used",
      reference: "ADJ-001",
      status: "POSTED",
      lines: [
        { code: "502", debit: "500.00", description: "Supplies used" },
        { code: "102", credit: "500.00", description: "Supplies on hand" },
      ],
    },
    {
      sourceType: "ADJUSTMENT",
      adjustmentType: "DEPRECIATION",
      adjustmentReason: "December depreciation on office equipment",
      date: "2023-12-31",
      memo: "Adjusting entry - depreciation",
      reference: "ADJ-002",
      status: "POSTED",
      lines: [
        { code: "503", debit: "2850.00", description: "Depreciation for December" },
        { code: "104", credit: "2850.00", description: "Accumulated depreciation" },
      ],
    },
    {
      sourceType: "ADJUSTMENT",
      adjustmentType: "OTHER",
      adjustmentReason: "Advance earned by 31 December",
      date: "2023-12-31",
      memo: "Adjusting entry - unearned revenue earned",
      reference: "ADJ-003",
      status: "POSTED",
      lines: [
        { code: "202", debit: "1000.00", description: "Advance earned" },
        { code: "400", credit: "1000.00", description: "Computer services" },
      ],
    },
    {
      sourceType: "ADJUSTMENT",
      adjustmentType: "ACCRUED_REVENUE",
      adjustmentReason: "Services rendered but not yet billed",
      date: "2023-12-31",
      memo: "Adjusting entry - accrued service revenue",
      reference: "ADJ-004",
      status: "POSTED",
      lines: [
        { code: "101", debit: "7500.00", description: "Accrued revenue" },
        { code: "400", credit: "7500.00", description: "Computer services" },
      ],
    },
    {
      sourceType: "ADJUSTMENT",
      adjustmentType: "OTHER",
      adjustmentReason: "To record salaries paid to employees.",
      date: "2023-12-31",
      memo: "Adjusting entry - salaries paid",
      reference: "ADJ-005",
      status: "POSTED",
      lines: [
        { code: "500", debit: "10000.00", description: "December salaries" },
        { code: "100", credit: "10000.00", description: "Cash payment" },
      ],
    },
    {
      sourceType: "ADJUSTMENT",
      adjustmentType: "OTHER",
      adjustmentReason: "To record cash received from computer services rendered.",
      date: "2023-12-31",
      memo: "Adjusting entry - cash services",
      reference: "ADJ-006",
      status: "POSTED",
      lines: [
        { code: "100", debit: "25000.00", description: "Cash received" },
        { code: "400", credit: "25000.00", description: "Computer services" },
      ],
    },
  ],
  reversals: [],
};
