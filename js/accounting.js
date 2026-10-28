import { isValidIsoDate, todayIso } from "./format.js";

export const CATEGORIES = [
  {
    id: "ASSET",
    label: "Assets",
    singular: "Asset",
    normal: "debit",
    description: "Resources the business owns or controls.",
  },
  {
    id: "LIABILITY",
    label: "Liabilities",
    singular: "Liability",
    normal: "credit",
    description: "Obligations the business owes to others.",
  },
  {
    id: "EQUITY",
    label: "Equity",
    singular: "Equity",
    normal: "credit",
    description: "The owner's residual interest in the business.",
  },
  {
    id: "REVENUE",
    label: "Revenue",
    singular: "Revenue",
    normal: "credit",
    description: "Income earned from business activity.",
  },
  {
    id: "EXPENSE",
    label: "Expenses",
    singular: "Expense",
    normal: "debit",
    description: "Costs incurred to operate the business.",
  },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((category) => [category.id, category]));

export const ACCOUNT_CODE_RANGES = {
  ASSET: { min: 100, max: 199, label: "Asset" },
  LIABILITY: { min: 200, max: 299, label: "Liability" },
  EQUITY: { min: 300, max: 399, label: "Equity" },
  REVENUE: { min: 400, max: 499, label: "Revenue" },
  EXPENSE: { min: 500, max: 599, label: "Expense" },
};

export const SOURCE_TYPES = {
  SALES_INVOICE: {
    id: "SALES_INVOICE",
    label: "Sales invoice",
    shortLabel: "Sale",
    prefix: "SI",
    tone: "sales",
    description: "Revenue earned on credit.",
    defaultLines: [
      { accountCode: "101", side: "debit" },
      { accountCode: "400", side: "credit" },
    ],
  },
  PURCHASE_BILL: {
    id: "PURCHASE_BILL",
    label: "Purchase bill",
    shortLabel: "Purchase",
    prefix: "PB",
    tone: "purchase",
    description: "A cost or asset acquired on credit.",
    defaultLines: [
      { accountCode: "502", side: "debit" },
      { accountCode: "200", side: "credit" },
    ],
  },
  CASH_RECEIPT: {
    id: "CASH_RECEIPT",
    label: "Cash receipt",
    shortLabel: "Receipt",
    prefix: "CR",
    tone: "receipt",
    description: "Money received from a customer.",
    defaultLines: [
      { accountCode: "100", side: "debit" },
      { accountCode: "101", side: "credit" },
    ],
  },
  CASH_PAYMENT: {
    id: "CASH_PAYMENT",
    label: "Cash payment",
    shortLabel: "Payment",
    prefix: "CP",
    tone: "payment",
    description: "Money paid to a supplier or for an expense.",
    defaultLines: [
      { accountCode: "200", side: "debit" },
      { accountCode: "100", side: "credit" },
    ],
  },
  GENERAL_JOURNAL: {
    id: "GENERAL_JOURNAL",
    label: "General journal",
    shortLabel: "Journal",
    prefix: "JE",
    tone: "journal",
    description: "A manual double-entry journal entry.",
    defaultLines: [],
  },
  ADJUSTMENT: {
    id: "ADJUSTMENT",
    label: "Adjustment",
    shortLabel: "Adjustment",
    prefix: "ADJ",
    tone: "adjustment",
    description: "A manual period-end or authorized adjusting entry.",
    defaultLines: [],
  },
};

export const TRANSACTION_SOURCE_TYPES = [
  "SALES_INVOICE",
  "PURCHASE_BILL",
  "CASH_RECEIPT",
  "CASH_PAYMENT",
  "GENERAL_JOURNAL",
];

export const ALL_SOURCE_TYPES = [...TRANSACTION_SOURCE_TYPES, "ADJUSTMENT"];

export const ADJUSTMENT_TYPES = [
  {
    id: "ACCRUED_EXPENSE",
    label: "Accrued expense",
    description: "An expense incurred but not yet billed or paid.",
  },
  {
    id: "ACCRUED_REVENUE",
    label: "Accrued revenue",
    description: "Revenue earned but not yet invoiced or received.",
  },
  {
    id: "PREPAID_EXPENSE",
    label: "Prepaid expense",
    description: "An allocation of a cost paid in advance.",
  },
  {
    id: "DEPRECIATION",
    label: "Depreciation",
    description: "A manual allocation of an asset's cost.",
  },
  {
    id: "OTHER",
    label: "Other adjustment",
    description: "Another authorized manual adjusting entry.",
  },
];

export const ADJUSTMENT_TYPE_MAP = Object.fromEntries(
  ADJUSTMENT_TYPES.map((type) => [type.id, type]),
);

export function getSourceMeta(sourceType) {
  return SOURCE_TYPES[sourceType] || SOURCE_TYPES.GENERAL_JOURNAL;
}

export function getCategory(categoryId) {
  return CATEGORY_MAP[categoryId] || CATEGORY_MAP.ASSET;
}

export function getAccount(accounts, accountId) {
  return accounts.find((account) => account.id === accountId);
}

export function getAccountByCode(accounts, code) {
  return accounts.find((account) => account.code === code);
}

export function postedEntries(entries) {
  return entries.filter((entry) => entry.status === "POSTED");
}

export function draftEntries(entries) {
  return entries.filter((entry) => entry.status === "DRAFT");
}

export function sortEntries(entries, direction = "desc") {
  const factor = direction === "asc" ? 1 : -1;
  return [...entries].sort((left, right) => {
    if (left.date !== right.date) return left.date < right.date ? factor : -factor;
    return left.entryNo < right.entryNo ? factor : left.entryNo > right.entryNo ? -factor : 0;
  });
}

export function entryTotalDebit(entry) {
  return (entry.lines || []).reduce((total, line) => total + (line.debitCents || 0), 0);
}

export function entryTotalCredit(entry) {
  return (entry.lines || []).reduce((total, line) => total + (line.creditCents || 0), 0);
}

export function isBalanced(entry) {
  const debit = entryTotalDebit(entry);
  const credit = entryTotalCredit(entry);
  return debit > 0 && debit === credit;
}

export function entryStatus(entry) {
  if (entry.status === "DRAFT") return { label: "Draft", className: "badge-draft" };
  if (entry.reversedBy) return { label: "Reversed", className: "badge-reversed" };
  return { label: "Posted", className: "badge-posted" };
}

export function validateEntry(entry, accounts, { forPost = false } = {}) {
  const errors = [];
  const lines = Array.isArray(entry.lines) ? entry.lines : [];

  if (!entry.date || !isValidIsoDate(entry.date)) {
    errors.push({ field: "date", message: "Enter a valid entry date." });
  }

  if (!String(entry.memo || "").trim()) {
    errors.push({ field: "memo", message: "Add a short description for this entry." });
  } else if (String(entry.memo).trim().length > 500) {
    errors.push({ field: "memo", message: "Description must be 500 characters or fewer." });
  }

  if (!SOURCE_TYPES[entry.sourceType]) {
    errors.push({ field: "sourceType", message: "Choose a valid transaction type." });
  }

  if (entry.sourceType === "ADJUSTMENT") {
    if (!ADJUSTMENT_TYPE_MAP[entry.adjustmentType]) {
      errors.push({ field: "adjustmentType", message: "Choose an adjustment type." });
    }
    if (!String(entry.adjustmentReason || "").trim()) {
      errors.push({ field: "adjustmentReason", message: "Explain why this adjustment is needed." });
    }
  }

  if (forPost) {
    if (lines.length < 2) {
      errors.push({ field: "lines", message: "Posting requires at least two lines." });
    }

    lines.forEach((line, index) => {
      const account = getAccount(accounts, line.accountId);
      const debit = Number(line.debitCents || 0);
      const credit = Number(line.creditCents || 0);
      const fieldPrefix = `line-${index}`;

      if (!account) {
        errors.push({ field: `${fieldPrefix}-account`, message: `Line ${index + 1}: choose an account.` });
      } else if (!account.active) {
        errors.push({
          field: `${fieldPrefix}-account`,
          message: `Line ${index + 1}: ${account.code} ${account.name} is inactive.`,
        });
      }

      if (!Number.isInteger(debit) || !Number.isInteger(credit) || debit < 0 || credit < 0) {
        errors.push({
          field: `${fieldPrefix}-amount`,
          message: `Line ${index + 1}: amounts must be positive values with at most two decimals.`,
        });
      } else if (debit > 0 && credit > 0) {
        errors.push({
          field: `${fieldPrefix}-amount`,
          message: `Line ${index + 1}: use either a debit or a credit, not both.`,
        });
      } else if (debit === 0 && credit === 0) {
        errors.push({
          field: `${fieldPrefix}-amount`,
          message: `Line ${index + 1}: enter a debit or a credit.`,
        });
      }
    });

    const debit = entryTotalDebit(entry);
    const credit = entryTotalCredit(entry);

    if (debit <= 0) {
      errors.push({ field: "lines", message: "Posting requires a non-zero amount." });
    } else if (debit !== credit) {
      errors.push({ field: "lines", message: "Total debits must equal total credits." });
    }
  } else {
    lines.forEach((line, index) => {
      const debit = Number(line.debitCents || 0);
      const credit = Number(line.creditCents || 0);
      if (debit > 0 && credit > 0) {
        errors.push({
          field: `line-${index}-amount`,
          message: `Line ${index + 1}: use either a debit or a credit, not both.`,
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    totalDebit: entryTotalDebit(entry),
    totalCredit: entryTotalCredit(entry),
    balanced: isBalanced(entry),
  };
}

export function nextAccountCode(accounts, category, { excludeId = null } = {}) {
  const range = ACCOUNT_CODE_RANGES[category];
  if (!range) return "";

  const used = accounts
    .filter((account) => account.id !== excludeId && account.category === category)
    .map((account) => Number(account.code))
    .filter(
      (code) => Number.isInteger(code) && code >= range.min && code <= range.max,
    );
  const highest = used.length ? Math.max(...used) : range.min - 1;
  const next = highest + 1;
  return next <= range.max ? String(next) : "";
}

export function validateAccountInput(input, accounts, { excludeId = null } = {}) {
  const errors = {};
  const code = String(input.code || "").trim();
  const name = String(input.name || "").trim();
  const description = String(input.description || "").trim();

  if (!code) errors.code = "Account code is required.";
  else if (!/^\d{3}$/.test(code)) {
    errors.code = "Use a three-digit numeric account code.";
  } else {
    const range = ACCOUNT_CODE_RANGES[input.category];
    if (range) {
      const value = Number(code);
      if (value < range.min || value > range.max) {
        errors.code = `${range.label} codes must be between ${range.min} and ${range.max}.`;
      }
    }
    if (
      !errors.code &&
      accounts.some(
        (account) =>
          account.id !== excludeId && account.code.toLowerCase() === code.toLowerCase(),
      )
    ) {
      errors.code = "That account code is already in use.";
    }
  }

  if (!name) errors.name = "Account name is required.";
  else if (name.length > 80) errors.name = "Account name must be 80 characters or fewer.";

  if (!CATEGORY_MAP[input.category]) errors.category = "Choose an account category.";
  if (description.length > 200) errors.description = "Description must be 200 characters or fewer.";

  return { valid: Object.keys(errors).length === 0, errors };
}

export function accountRawBalance(accountId, entries) {
  return postedEntries(entries).reduce((total, entry) => {
    return (
      total +
      (entry.lines || []).reduce((lineTotal, line) => {
        if (line.accountId !== accountId) return lineTotal;
        return lineTotal + (line.debitCents || 0) - (line.creditCents || 0);
      }, 0)
    );
  }, 0);
}

export function accountDisplayBalance(account, entries) {
  const raw = accountRawBalance(account.id, entries);
  return getCategory(account.category).normal === "debit" ? raw : -raw;
}

export function buildTrialBalance(accounts, entries, { includeZero = false } = {}) {
  const activity = new Map();
  for (const entry of postedEntries(entries)) {
    for (const line of entry.lines || []) {
      const current = activity.get(line.accountId) || { debit: 0, credit: 0 };
      current.debit += line.debitCents || 0;
      current.credit += line.creditCents || 0;
      activity.set(line.accountId, current);
    }
  }

  return accounts
    .map((account) => {
      const totals = activity.get(account.id) || { debit: 0, credit: 0 };
      const balance = totals.debit - totals.credit;
      const displayBalance = getCategory(account.category).normal === "debit" ? balance : -balance;
      return {
        account,
        debit: totals.debit,
        credit: totals.credit,
        balance,
        displayBalance,
      };
    })
    .filter((row) => includeZero || row.debit > 0 || row.credit > 0)
    .sort((left, right) =>
      left.account.code.localeCompare(right.account.code, undefined, { numeric: true }),
    );
}

export function trialBalanceTotals(rows) {
  return rows.reduce(
    (totals, row) => {
      totals.debit += row.debit;
      totals.credit += row.credit;
      return totals;
    },
    { debit: 0, credit: 0 },
  );
}

export function categoryTotals(accounts, entries) {
  const totals = Object.fromEntries(CATEGORIES.map((category) => [category.id, 0]));
  const accountMap = new Map(accounts.map((account) => [account.id, account]));

  for (const entry of postedEntries(entries)) {
    for (const line of entry.lines || []) {
      const account = accountMap.get(line.accountId);
      if (!account) continue;
      const raw = (line.debitCents || 0) - (line.creditCents || 0);
      const normal = getCategory(account.category).normal;
      totals[account.category] += normal === "debit" ? raw : -raw;
    }
  }

  const netIncome = totals.REVENUE - totals.EXPENSE;
  const equationDifference = totals.ASSET - (totals.LIABILITY + totals.EQUITY + netIncome);

  return {
    assets: totals.ASSET,
    liabilities: totals.LIABILITY,
    equity: totals.EQUITY,
    revenue: totals.REVENUE,
    expenses: totals.EXPENSE,
    netIncome,
    equationDifference,
  };
}

export function nextEntryNumber(entries, sourceType) {
  const prefix = getSourceMeta(sourceType).prefix;
  const highest = entries.reduce((max, entry) => {
    const match = String(entry.entryNo || "").match(/-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(6, "0")}`;
}

export function buildReversalEntry(original, reason) {
  const now = new Date().toISOString();
  return {
    id: `entry-${crypto.randomUUID()}`,
    entryNo: "",
    sourceType: "GENERAL_JOURNAL",
    status: "POSTED",
    date: todayIso(),
    memo: `Reversal of ${original.entryNo}: ${original.memo}`,
    reference: `REV-${original.entryNo}`,
    adjustmentType: null,
    adjustmentReason: null,
    reversalOf: original.id,
    reversalReason: reason,
    reversedBy: null,
    lines: (original.lines || []).map((line, index) => ({
      id: `line-${crypto.randomUUID()}`,
      lineNo: index + 1,
      accountId: line.accountId,
      description: line.description || `Reversal of ${original.entryNo}`,
      debitCents: line.creditCents || 0,
      creditCents: line.debitCents || 0,
    })),
    createdAt: now,
    postedAt: now,
  };
}
