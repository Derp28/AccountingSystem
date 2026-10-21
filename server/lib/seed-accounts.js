import crypto from "node:crypto";

export const DEFAULT_ACCOUNTS = [
  {
    code: "100",
    name: "Cash",
    category: "ASSET",
    description: "Operating bank account and cash on hand.",
  },
  {
    code: "101",
    name: "Accounts Receivable",
    category: "ASSET",
    description: "Amounts invoiced to customers and not yet collected.",
  },
  {
    code: "102",
    name: "Prepaid Expenses",
    category: "ASSET",
    description: "Costs paid in advance that will be used over time.",
  },
  {
    code: "103",
    name: "Equipment",
    category: "ASSET",
    description: "Cameras, lighting, computers, and other studio equipment.",
  },
  {
    code: "200",
    name: "Accounts Payable",
    category: "LIABILITY",
    description: "Supplier bills received but not yet paid.",
  },
  {
    code: "201",
    name: "Accrued Liabilities",
    category: "LIABILITY",
    description: "Expenses incurred but not yet invoiced or paid.",
  },
  {
    code: "300",
    name: "Owner's Equity",
    category: "EQUITY",
    description: "The owner's investment in the business.",
  },
  {
    code: "400",
    name: "Service Revenue",
    category: "REVENUE",
    description: "Income from design, photography, and consulting work.",
  },
  {
    code: "500",
    name: "Operating Expenses",
    category: "EXPENSE",
    description: "Software, supplies, insurance, and other operating costs.",
  },
  {
    code: "501",
    name: "Rent Expense",
    category: "EXPENSE",
    description: "Monthly studio and workspace rent.",
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
      id, ledger_id, code, name, category, description, active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);
  for (const account of DEFAULT_ACCOUNTS) {
    statement.run(
      `acct-${crypto.randomUUID()}`,
      ledgerId,
      account.code,
      account.name,
      account.category,
      account.description,
      now,
      now,
    );
  }
}
