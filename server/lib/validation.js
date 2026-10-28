import { ValidationError } from "./errors.js";
import { readLineAmount } from "./money.js";

export const CATEGORIES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
export const ACCOUNT_CODE_RANGES = {
  ASSET: { min: 100, max: 199, label: "Asset" },
  LIABILITY: { min: 200, max: 299, label: "Liability" },
  EQUITY: { min: 300, max: 399, label: "Equity" },
  REVENUE: { min: 400, max: 499, label: "Revenue" },
  EXPENSE: { min: 500, max: 599, label: "Expense" },
};
export const SOURCE_TYPES = [
  "SALES_INVOICE",
  "PURCHASE_BILL",
  "CASH_RECEIPT",
  "CASH_PAYMENT",
  "GENERAL_JOURNAL",
  "ADJUSTMENT",
];
export const ADJUSTMENT_TYPES = [
  "ACCRUED_EXPENSE",
  "ACCRUED_REVENUE",
  "PREPAID_EXPENSE",
  "DEPRECIATION",
  "OTHER",
];

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function text(value) {
  return String(value ?? "").trim();
}

function push(errors, field, message) {
  errors.push({ field, message });
}

export function normalizeProfileInput(body) {
  const name = text(body?.name);
  const errors = [];
  if (!name) push(errors, "name", "Enter your name or business name.");
  if (name.length > 100) push(errors, "name", "Keep the name to 100 characters or fewer.");
  if (errors.length) throw new ValidationError(errors);
  return { name };
}

export function normalizeWorkspaceInput(body) {
  const name = text(body?.name);
  const currency = text(body?.currency).toUpperCase();
  const errors = [];
  if (!name) push(errors, "name", "Give your report or workspace a name.");
  if (name.length > 80) push(errors, "name", "Keep the workspace name to 80 characters or fewer.");
  if (!/^[A-Z]{3}$/.test(currency)) {
    push(errors, "currency", "Enter a three-letter currency code.");
  } else {
    try {
      const supported = Intl.supportedValuesOf?.("currency");
      if (supported && !supported.includes(currency)) {
        push(errors, "currency", "Choose a supported currency code.");
      }
      new Intl.NumberFormat("en-US", { style: "currency", currency });
    } catch {
      push(errors, "currency", "Choose a supported currency code.");
    }
  }
  if (errors.length) throw new ValidationError(errors);
  return { name, currency };
}

export function normalizeAccountInput(body) {
  const code = text(body?.code);
  const name = text(body?.name);
  const category = text(body?.category).toUpperCase();
  const description = text(body?.description);
  const active = body?.active === undefined ? true : Boolean(body.active);
  const errors = [];

  if (!code) push(errors, "code", "Account code is required.");
  else if (!/^\d{3}$/.test(code)) {
    push(errors, "code", "Use a three-digit numeric account code.");
  } else {
    const range = ACCOUNT_CODE_RANGES[category];
    if (range) {
      const value = Number(code);
      if (value < range.min || value > range.max) {
        push(
          errors,
          "code",
          `${range.label} codes must be between ${range.min} and ${range.max}.`,
        );
      }
    }
  }
  if (!name) push(errors, "name", "Account name is required.");
  else if (name.length > 80) push(errors, "name", "Account name must be 80 characters or fewer.");
  if (!CATEGORIES.includes(category)) push(errors, "category", "Choose an account category.");
  if (description.length > 200) push(errors, "description", "Description must be 200 characters or fewer.");

  if (errors.length) throw new ValidationError(errors);
  return { code, name, category, description, active };
}

export function normalizeEntryInput(body, { forPost = false, accounts = [] } = {}) {
  const errors = [];
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const sourceType = text(body?.sourceType);
  const date = text(body?.date);
  const memo = text(body?.memo);
  const reference = text(body?.reference) || null;
  const adjustmentType = text(body?.adjustmentType) || null;
  const adjustmentReason = text(body?.adjustmentReason) || null;
  const rawLines = Array.isArray(body?.lines) ? body.lines : [];

  if (!SOURCE_TYPES.includes(sourceType)) {
    push(errors, "sourceType", "Choose a valid transaction type.");
  }
  if (!isValidIsoDate(date)) {
    push(errors, "date", "Enter a valid entry date.");
  }
  if (!memo) push(errors, "memo", "Add a short description for this entry.");
  else if (memo.length > 500) {
    push(errors, "memo", "Description must be 500 characters or fewer.");
  }
  if (reference && reference.length > 80) {
    push(errors, "reference", "Reference must be 80 characters or fewer.");
  }
  if (sourceType === "ADJUSTMENT") {
    if (!ADJUSTMENT_TYPES.includes(adjustmentType)) {
      push(errors, "adjustmentType", "Choose an adjustment type.");
    }
    if (!adjustmentReason) {
      push(errors, "adjustmentReason", "Explain why this adjustment is needed.");
    } else if (adjustmentReason.length > 300) {
      push(errors, "adjustmentReason", "Adjustment reason must be 300 characters or fewer.");
    }
  }
  if (rawLines.length > 100) {
    push(errors, "lines", "An entry may contain at most 100 lines.");
  }

  const lines = rawLines.map((line, index) => {
    const field = `line-${index}`;
    const accountId = text(line?.accountId);
    const account = accountMap.get(accountId);
    let debitCents = 0;
    let creditCents = 0;

    if (!accountId) {
      push(errors, `${field}-account`, `Line ${index + 1}: choose an account.`);
    } else if (!account) {
      push(errors, `${field}-account`, `Line ${index + 1}: the account does not exist.`);
    } else if (!account.active) {
      push(errors, `${field}-account`, `Line ${index + 1}: ${account.code} ${account.name} is inactive.`);
    }

    try {
      debitCents = readLineAmount(line, "debitCents", "debit", `${field}-amount`);
      creditCents = readLineAmount(line, "creditCents", "credit", `${field}-amount`);
    } catch (error) {
      for (const detail of error.details || [{ message: error.message }]) {
        push(errors, detail.field || `${field}-amount`, detail.message);
      }
    }

    if (debitCents > 0 && creditCents > 0) {
      push(errors, `${field}-amount`, `Line ${index + 1}: use either a debit or a credit, not both.`);
    }
    if (forPost && debitCents === 0 && creditCents === 0) {
      push(errors, `${field}-amount`, `Line ${index + 1}: enter a debit or a credit.`);
    }

    const description = text(line?.description);
    if (description.length > 200) {
      push(errors, `${field}-description`, `Line ${index + 1}: description must be 200 characters or fewer.`);
    }

    return {
      lineNo: index + 1,
      accountId,
      description,
      debitCents,
      creditCents,
    };
  });

  if (forPost) {
    if (lines.length < 2) {
      push(errors, "lines", "Posting requires at least two lines.");
    }
    const totalDebit = lines.reduce((sum, line) => sum + line.debitCents, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.creditCents, 0);
    if (totalDebit === 0) {
      push(errors, "lines", "Posting requires a non-zero amount.");
    } else if (totalDebit !== totalCredit) {
      push(errors, "lines", "Total debits must equal total credits.");
    }
  }

  if (errors.length) throw new ValidationError(errors);

  return {
    sourceType,
    date,
    memo,
    reference,
    adjustmentType: sourceType === "ADJUSTMENT" ? adjustmentType : null,
    adjustmentReason: sourceType === "ADJUSTMENT" ? adjustmentReason : null,
    lines,
  };
}
