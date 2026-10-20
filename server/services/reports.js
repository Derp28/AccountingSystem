import { listEntries } from "./entries.js";
import { listAccounts } from "./accounts.js";

export function getTrialBalance(db) {
  const accounts = listAccounts(db);
  const rows = accounts
    .filter((account) => account.debitCents > 0 || account.creditCents > 0)
    .map((account) => ({
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        category: account.category,
        active: account.active,
      },
      debitCents: account.debitCents,
      creditCents: account.creditCents,
      balanceCents: account.rawBalanceCents,
      displayBalanceCents: account.balanceCents,
    }))
    .sort((left, right) =>
      left.account.code.localeCompare(right.account.code, undefined, { numeric: true }),
    );

  const totalDebitCents = rows.reduce((sum, row) => sum + row.debitCents, 0);
  const totalCreditCents = rows.reduce((sum, row) => sum + row.creditCents, 0);

  return {
    rows,
    totalDebitCents,
    totalCreditCents,
    differenceCents: totalDebitCents - totalCreditCents,
    balanced: totalDebitCents === totalCreditCents,
  };
}

export function getDashboard(db) {
  const accounts = listAccounts(db);
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

  const entries = listEntries(db);
  const posted = entries.filter((entry) => entry.status === "POSTED");
  const drafts = entries.filter((entry) => entry.status === "DRAFT");
  const trialBalance = getTrialBalance(db);

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
    asOf: new Date().toISOString(),
  };
}
