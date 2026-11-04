import crypto from "node:crypto";

/**
 * The starter Chart of Accounts for AAA Computer Services. Every new ledger is
 * seeded with exactly these accounts, and migration 006 applies the same chart
 * to the seeded ledger of an existing installation while it is still empty.
 *
 * Codes follow the hundreds series enforced by migration 003: assets 100-199,
 * liabilities 200-299, equity 300-399, revenue 400-499, expenses 500-599.
 * Account 104 is a contra asset: it is categorised as an asset but carries a
 * credit balance, so it reduces total assets instead of adding to them.
 *
 * `cashFlowClass` feeds the Statement of Cash Flows (migration 007). The
 * owner's rule puts equipment and supplies under investing; supplies can be
 * changed to operating per account in the Chart of Accounts.
 */
export const DEFAULT_ACCOUNTS = [
  {
    code: "100",
    name: "Cash",
    category: "ASSET",
    description: "Operating bank account and cash on hand.",
    cashFlowClass: "CASH",
  },
  {
    code: "101",
    name: "Accounts Receivable",
    category: "ASSET",
    description: "Amounts invoiced to customers and not yet collected.",
    cashFlowClass: "OPERATING",
  },
  {
    code: "102",
    name: "Office Supplies",
    category: "ASSET",
    description: "Supplies on hand and not yet used.",
    cashFlowClass: "INVESTING",
  },
  {
    code: "103",
    name: "Office Equipment",
    category: "ASSET",
    description: "Computers, peripherals, and other equipment used in the business.",
    cashFlowClass: "INVESTING",
  },
  {
    code: "104",
    name: "Accumulated Depreciation - Office Equipment",
    category: "ASSET",
    description:
      "Contra asset: depreciation recorded on office equipment. Carries a credit balance and reduces office equipment.",
    cashFlowClass: "NON_CASH",
  },
  {
    code: "200",
    name: "Accounts Payable",
    category: "LIABILITY",
    description: "Supplier bills received but not yet paid.",
    cashFlowClass: "OPERATING",
  },
  {
    code: "201",
    name: "Notes Payable",
    category: "LIABILITY",
    description: "Formal borrowings repayable on agreed terms.",
    cashFlowClass: "FINANCING",
  },
  {
    code: "202",
    name: "Unearned Computer Service Revenue",
    category: "LIABILITY",
    description: "Service fees collected before the work is performed.",
    cashFlowClass: "OPERATING",
  },
  {
    code: "203",
    name: "Salaries Payable",
    category: "LIABILITY",
    description: "Salaries earned by staff but not yet paid.",
    cashFlowClass: "OPERATING",
  },
  {
    code: "204",
    name: "Advertising Payable",
    category: "LIABILITY",
    description: "Advertising received but not yet paid.",
    cashFlowClass: "OPERATING",
  },
  {
    code: "300",
    name: "A, Capital",
    category: "EQUITY",
    description: "Owner's capital: the owner's investment in the business.",
    cashFlowClass: "FINANCING",
  },
  {
    code: "301",
    name: "A, Drawing",
    category: "EQUITY",
    description: "Owner's withdrawals: amounts the owner takes out of the business.",
    cashFlowClass: "FINANCING",
  },
  {
    code: "400",
    name: "Computer Services Revenue",
    category: "REVENUE",
    description: "Income from computer services, support, and repairs.",
    cashFlowClass: "OPERATING",
  },
  {
    code: "500",
    name: "Salaries Expense",
    category: "EXPENSE",
    description: "Wages and salaries paid to staff.",
    cashFlowClass: "OPERATING",
  },
  {
    code: "501",
    name: "Advertising Expense",
    category: "EXPENSE",
    description: "Cost of advertising and promotions.",
    cashFlowClass: "OPERATING",
  },
  {
    code: "502",
    name: "Office Supplies Expense",
    category: "EXPENSE",
    description: "Office supplies consumed during the period.",
    cashFlowClass: "OPERATING",
  },
  {
    code: "503",
    name: "Depreciation Expense - Office Equipment",
    category: "EXPENSE",
    description: "Depreciation charged on office equipment.",
    cashFlowClass: "OPERATING",
  },
];

/**
 * Seed a newly created ledger. Existing installations keep the row IDs from
 * migrations 002 and 004; new ledgers receive fresh, ledger-local IDs.
 */
export function insertSeedAccounts(db, ledgerId) {
  const now = new Date().toISOString();
  const statement = db.prepare(`
    INSERT INTO accounts (
      id, ledger_id, code, name, category, description, cash_flow_class,
      active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  for (const account of DEFAULT_ACCOUNTS) {
    statement.run(
      `acct-${crypto.randomUUID()}`,
      ledgerId,
      account.code,
      account.name,
      account.category,
      account.description,
      account.cashFlowClass,
      now,
      now,
    );
  }
}
