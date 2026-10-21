import { ValidationError } from "../lib/errors.js";
import { isValidIsoDate, todayIso } from "../lib/validation.js";
import { accountRows, listAccounts } from "./accounts.js";
import { listEntries } from "./entries.js";

export const REPORT_BASES = ["adjusted", "unadjusted"];

function normalizeBasis(value) {
  const basis = String(value || "adjusted").toLowerCase();
  if (!REPORT_BASES.includes(basis)) {
    throw new ValidationError([
      { field: "basis", message: "Choose adjusted or unadjusted reporting." },
    ]);
  }
  return basis;
}

function normalizeAsOf(value) {
  const asOf = value ? String(value) : todayIso();
  if (!isValidIsoDate(asOf)) {
    throw new ValidationError([{ field: "asOf", message: "Enter a valid as-of date." }]);
  }
  return asOf;
}

function firstDayOfMonth() {
  const today = todayIso();
  return `${today.slice(0, 7)}-01`;
}

function normalizePeriod(fromValue, toValue) {
  const from = fromValue ? String(fromValue) : firstDayOfMonth();
  const to = toValue ? String(toValue) : todayIso();
  const errors = [];
  if (!isValidIsoDate(from)) {
    errors.push({ field: "from", message: "Enter a valid start date." });
  }
  if (!isValidIsoDate(to)) {
    errors.push({ field: "to", message: "Enter a valid end date." });
  }
  if (!errors.length && from > to) {
    errors.push({ field: "from", message: "The start date must not be after the end date." });
  }
  if (errors.length) throw new ValidationError(errors);
  return { from, to };
}

/**
 * Posted account activity for one ledger. Unadjusted reporting excludes every
 * adjustment entry and the reversal linked to an adjustment.
 */
function activityRows(db, ledgerId, { from = null, to = null, basis = "adjusted" } = {}) {
  const clauses = ["e.ledger_id = ?", "e.status = 'POSTED'"];
  const params = [ledgerId];

  if (from) {
    clauses.push("e.entry_date >= ?");
    params.push(from);
  }
  if (to) {
    clauses.push("e.entry_date <= ?");
    params.push(to);
  }
  if (basis === "unadjusted") {
    clauses.push("e.source_type <> 'ADJUSTMENT'");
    clauses.push(`
      e.id NOT IN (
        SELECT rl.reversal_entry_id
        FROM reversal_links rl
        JOIN journal_entries original ON original.id = rl.original_entry_id
        WHERE original.ledger_id = ? AND original.source_type = 'ADJUSTMENT'
      )
    `);
    params.push(ledgerId);
  }

  const whereClause = clauses.join(" AND ");
  const sql = `
      SELECT l.account_id,
             SUM(l.debit_cents) AS debit_cents,
             SUM(l.credit_cents) AS credit_cents
      FROM journal_lines l
      JOIN journal_entries e ON e.id = l.entry_id
      WHERE ${whereClause}
      GROUP BY l.account_id
    `;
  const rows = db.prepare(sql).all(...params);

  return new Map(rows.map((row) => [row.account_id, row]));
}

function activityFor(activity, accountId) {
  const row = activity.get(accountId);
  return {
    debitCents: Number(row?.debit_cents || 0),
    creditCents: Number(row?.credit_cents || 0),
  };
}

function publicAccount(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    active: Boolean(row.active),
  };
}

export function getTrialBalance(db, ledgerId, { asOf: asOfValue, basis: basisValue } = {}) {
  const asOf = normalizeAsOf(asOfValue);
  const basis = normalizeBasis(basisValue);
  const activity = activityRows(db, ledgerId, { to: asOf, basis });

  const rows = accountRows(db, ledgerId)
    .map((account) => {
      const totals = activityFor(activity, account.id);
      const raw = totals.debitCents - totals.creditCents;
      return {
        account: publicAccount(account),
        debitCents: raw > 0 ? raw : 0,
        creditCents: raw < 0 ? -raw : 0,
        balanceCents: raw,
      };
    })
    .filter((row) => row.debitCents !== 0 || row.creditCents !== 0)
    .sort((left, right) =>
      left.account.code.localeCompare(right.account.code, undefined, { numeric: true }),
    );

  const totalDebitCents = rows.reduce((sum, row) => sum + row.debitCents, 0);
  const totalCreditCents = rows.reduce((sum, row) => sum + row.creditCents, 0);
  return {
    basis,
    asOf,
    rows,
    totalDebitCents,
    totalCreditCents,
    differenceCents: totalDebitCents - totalCreditCents,
    balanced: totalDebitCents === totalCreditCents,
  };
}

export function getIncomeStatement(db, ledgerId, { from: fromValue, to: toValue, basis: basisValue } = {}) {
  const basis = normalizeBasis(basisValue);
  const { from, to } = normalizePeriod(fromValue, toValue);
  const activity = activityRows(db, ledgerId, { from, to, basis });
  const accounts = accountRows(db, ledgerId);
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const revenueRows = [];
  const expenseRows = [];
  for (const [accountId, totals] of activity) {
    const account = accountById.get(accountId);
    if (!account) continue;
    const debit = Number(totals.debit_cents || 0);
    const credit = Number(totals.credit_cents || 0);
    if (account.category === "REVENUE") {
      const amountCents = credit - debit;
      if (amountCents !== 0) revenueRows.push({ account: publicAccount(account), amountCents });
    } else if (account.category === "EXPENSE") {
      const amountCents = debit - credit;
      if (amountCents !== 0) expenseRows.push({ account: publicAccount(account), amountCents });
    }
  }

  const byCode = (left, right) =>
    left.account.code.localeCompare(right.account.code, undefined, { numeric: true });
  revenueRows.sort(byCode);
  expenseRows.sort(byCode);

  const totalRevenueCents = revenueRows.reduce((sum, row) => sum + row.amountCents, 0);
  const totalExpensesCents = expenseRows.reduce((sum, row) => sum + row.amountCents, 0);

  return {
    basis,
    from,
    to,
    revenueRows,
    expenseRows,
    totalRevenueCents,
    totalExpensesCents,
    netIncomeCents: totalRevenueCents - totalExpensesCents,
  };
}

export function getBalanceSheet(db, ledgerId, { asOf: asOfValue, basis: basisValue } = {}) {
  const asOf = normalizeAsOf(asOfValue);
  const basis = normalizeBasis(basisValue);
  const activity = activityRows(db, ledgerId, { to: asOf, basis });
  const accounts = accountRows(db, ledgerId);

  const assetRows = [];
  const liabilityRows = [];
  const equityRows = [];
  let revenueCents = 0;
  let expenseCents = 0;

  for (const account of accounts) {
    const totals = activityFor(activity, account.id);
    if (account.category === "ASSET") {
      const amountCents = totals.debitCents - totals.creditCents;
      if (amountCents !== 0) assetRows.push({ account: publicAccount(account), amountCents });
    } else if (account.category === "LIABILITY") {
      const amountCents = totals.creditCents - totals.debitCents;
      if (amountCents !== 0) liabilityRows.push({ account: publicAccount(account), amountCents });
    } else if (account.category === "EQUITY") {
      const amountCents = totals.creditCents - totals.debitCents;
      if (amountCents !== 0) equityRows.push({ account: publicAccount(account), amountCents });
    } else if (account.category === "REVENUE") {
      revenueCents += totals.creditCents - totals.debitCents;
    } else if (account.category === "EXPENSE") {
      expenseCents += totals.debitCents - totals.creditCents;
    }
  }

  const byCode = (left, right) =>
    left.account.code.localeCompare(right.account.code, undefined, { numeric: true });
  assetRows.sort(byCode);
  liabilityRows.sort(byCode);
  equityRows.sort(byCode);

  const accumulatedEarningsCents = revenueCents - expenseCents;
  const totalAssetsCents = assetRows.reduce((sum, row) => sum + row.amountCents, 0);
  const totalLiabilitiesCents = liabilityRows.reduce((sum, row) => sum + row.amountCents, 0);
  const equityAccountCents = equityRows.reduce((sum, row) => sum + row.amountCents, 0);
  const totalEquityCents = equityAccountCents + accumulatedEarningsCents;
  const totalLiabilitiesAndEquityCents = totalLiabilitiesCents + totalEquityCents;

  return {
    basis,
    asOf,
    assetRows,
    liabilityRows,
    equityRows,
    accumulatedEarningsCents,
    totalAssetsCents,
    totalLiabilitiesCents,
    totalEquityCents,
    totalLiabilitiesAndEquityCents,
    differenceCents: totalAssetsCents - totalLiabilitiesAndEquityCents,
    balanced: totalAssetsCents === totalLiabilitiesAndEquityCents,
  };
}

export function getDashboard(db, ledgerId) {
  const accounts = listAccounts(db, ledgerId);
  const byCategory = Object.fromEntries(
    ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map((category) => [category, 0]),
  );
  for (const account of accounts) {
    byCategory[account.category] += account.balanceCents;
  }

  const revenueCents = byCategory.REVENUE;
  const expensesCents = byCategory.EXPENSE;
  const netIncomeCents = revenueCents - expensesCents;
  const equationDifferenceCents =
    byCategory.ASSET - (byCategory.LIABILITY + byCategory.EQUITY + netIncomeCents);

  const entries = listEntries(db, ledgerId);
  const posted = entries.filter((entry) => entry.status === "POSTED");
  const drafts = entries.filter((entry) => entry.status === "DRAFT");
  const trialBalance = getTrialBalance(db, ledgerId, {
    asOf: todayIso(),
    basis: "adjusted",
  });

  return {
    assetsCents: byCategory.ASSET,
    liabilitiesCents: byCategory.LIABILITY,
    equityCents: byCategory.EQUITY,
    revenueCents,
    expensesCents,
    netIncomeCents,
    equationDifferenceCents,
    trialBalance: {
      totalDebitCents: trialBalance.totalDebitCents,
      totalCreditCents: trialBalance.totalCreditCents,
      differenceCents: trialBalance.differenceCents,
      balanced: trialBalance.balanced,
    },
    counts: { postedEntries: posted.length, draftEntries: drafts.length },
    recentEntries: posted.slice(0, 5),
    asOf: todayIso(),
    basis: "adjusted",
  };
}
