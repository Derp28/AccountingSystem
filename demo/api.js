import {
  normalizeAccountInput,
  normalizeEntryInput,
  normalizeProfileInput,
  normalizeWorkspaceInput,
  todayIso,
} from "../server/lib/validation.js";

/**
 * GitHub Pages demo engine.
 *
 * This file answers the same /api/* requests the real server answers, but keeps
 * every record in memory. The validation rules are imported from the server's
 * own `server/lib/validation.js`, so amounts, dates, account-code ranges, and
 * posting rules cannot drift from the shipped app. Everything else mirrors
 * `server/services/*.js` function for function; see the comments on each block.
 *
 * Nothing is persisted: a reload restores the captured sample books.
 */

const PREFIXES = {
  SALES_INVOICE: "SI",
  PURCHASE_BILL: "PB",
  CASH_RECEIPT: "CR",
  CASH_PAYMENT: "CP",
  GENERAL_JOURNAL: "JE",
  ADJUSTMENT: "ADJ",
};

export class DemoHttpError extends Error {
  constructor(status, message, details = [], code = "ERROR") {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

const validation = (error) =>
  error instanceof DemoHttpError
    ? error
    : new DemoHttpError(422, "The request could not be saved.", error?.details || []);

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createDemoState(seed) {
  return {
    profile: clone(seed.profile),
    ledgers: clone(seed.ledgers),
    activeLedgerId: seed.activeLedgerId,
    accounts: clone(seed.accounts),
    entries: clone(seed.entries),
    nextEntryNumber: seed.nextEntryNumber,
    defaultAccounts: clone(seed.defaultAccounts),
    authenticated: true,
  };
}

function ledger(state, ledgerId = state.activeLedgerId) {
  return state.ledgers.find((item) => item.id === ledgerId) || null;
}

function accountRows(state, ledgerId) {
  return state.accounts
    .filter((account) => account.ledgerId === ledgerId)
    .sort((left, right) => left.code.localeCompare(right.code));
}

function entryRows(state, ledgerId) {
  return state.entries
    .filter((entry) => entry.ledgerId === ledgerId)
    .sort((left, right) =>
      left.date === right.date
        ? right.entryNo.localeCompare(left.entryNo)
        : right.date.localeCompare(left.date),
    );
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

// ---------------------------------------------------------------------------
// services/accounts.js
// ---------------------------------------------------------------------------

/** Posted debit/credit totals per account, mirroring reports.js activityRows(). */
function activityRows(state, ledgerId, { from = null, to = null, basis = "adjusted" } = {}) {
  const activity = new Map();
  for (const entry of state.entries) {
    if (entry.ledgerId !== ledgerId || entry.status !== "POSTED") continue;
    if (from && entry.date < from) continue;
    if (to && entry.date > to) continue;
    if (basis === "unadjusted") {
      if (entry.sourceType === "ADJUSTMENT") continue;
      const original = entry.reversalOf
        ? state.entries.find((item) => item.id === entry.reversalOf)
        : null;
      if (original?.sourceType === "ADJUSTMENT") continue;
    }
    for (const line of entry.lines) {
      const totals = activity.get(line.accountId) || { debitCents: 0, creditCents: 0 };
      totals.debitCents += line.debitCents;
      totals.creditCents += line.creditCents;
      activity.set(line.accountId, totals);
    }
  }
  return activity;
}

function activityFor(activity, accountId) {
  return activity.get(accountId) || { debitCents: 0, creditCents: 0 };
}

function listAccounts(state, ledgerId) {
  const activity = activityRows(state, ledgerId);
  return accountRows(state, ledgerId).map((row) => {
    const totals = activityFor(activity, row.id);
    const raw = totals.debitCents - totals.creditCents;
    const debitNormal = row.category === "ASSET" || row.category === "EXPENSE";
    return {
      ...row,
      active: Boolean(row.active),
      debitCents: totals.debitCents,
      creditCents: totals.creditCents,
      rawBalanceCents: raw,
      balanceCents: debitNormal ? raw : -raw,
    };
  });
}

function assertCodeAvailable(state, ledgerId, code, excludeId = null) {
  const clash = state.accounts.find(
    (account) =>
      account.ledgerId === ledgerId &&
      account.code.toLowerCase() === code.toLowerCase() &&
      account.id !== excludeId,
  );
  if (clash) {
    throw new DemoHttpError(409, "That account code is already in use.", [
      { field: "code", message: "That account code is already in use." },
    ], "CONFLICT");
  }
}

function getAccount(state, ledgerId, id) {
  return state.accounts.find((account) => account.id === id && account.ledgerId === ledgerId) || null;
}

function createAccount(state, ledgerId, body) {
  const input = normalizeAccountInput(body);
  assertCodeAvailable(state, ledgerId, input.code);
  const now = new Date().toISOString();
  const account = {
    id: newId("acct"),
    ledgerId,
    code: input.code,
    name: input.name,
    category: input.category,
    description: input.description,
    active: input.active,
    createdAt: now,
    updatedAt: now,
  };
  state.accounts.push(account);
  return account;
}

function updateAccount(state, ledgerId, id, body) {
  const input = normalizeAccountInput(body);
  const existing = getAccount(state, ledgerId, id);
  if (!existing) throw new DemoHttpError(404, "The account was not found.", [], "NOT_FOUND");
  assertCodeAvailable(state, ledgerId, input.code, id);
  Object.assign(existing, {
    code: input.code,
    name: input.name,
    category: input.category,
    description: input.description,
    active: input.active,
    updatedAt: new Date().toISOString(),
  });
  return existing;
}

function setAccountActive(state, ledgerId, id, active) {
  const existing = getAccount(state, ledgerId, id);
  if (!existing) throw new DemoHttpError(404, "The account was not found.", [], "NOT_FOUND");
  existing.active = Boolean(active);
  existing.updatedAt = new Date().toISOString();
  return existing;
}

// ---------------------------------------------------------------------------
// services/entries.js
// ---------------------------------------------------------------------------

function allocateEntryNo(state, sourceType) {
  const value = state.nextEntryNumber;
  state.nextEntryNumber = value + 1;
  return `${PREFIXES[sourceType] || "JE"}-${String(value).padStart(6, "0")}`;
}

function entryById(state, ledgerId, id) {
  return state.entries.find((entry) => entry.id === id && entry.ledgerId === ledgerId) || null;
}

function payloadFromEntry(entry) {
  return {
    sourceType: entry.sourceType,
    date: entry.date,
    memo: entry.memo,
    reference: entry.reference,
    adjustmentType: entry.adjustmentType,
    adjustmentReason: entry.adjustmentReason,
    lines: entry.lines.map((line) => ({
      accountId: line.accountId,
      description: line.description,
      debitCents: line.debitCents,
      creditCents: line.creditCents,
    })),
  };
}

function activeAccounts(state, ledgerId) {
  return accountRows(state, ledgerId).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    active: Boolean(row.active),
  }));
}

function makeLines(input) {
  return input.lines.map((line, index) => ({
    id: newId("line"),
    lineNo: index + 1,
    accountId: line.accountId,
    description: line.description || "",
    debitCents: line.debitCents,
    creditCents: line.creditCents,
  }));
}

function createDraft(state, ledgerId, body, clientRequestId) {
  const accounts = activeAccounts(state, ledgerId);
  const input = normalizeEntryInput(body, { forPost: false, accounts });
  const request = clientRequestId ? String(clientRequestId).slice(0, 100) : null;

  if (request) {
    const existing = state.entries.find(
      (entry) => entry.ledgerId === ledgerId && entry.clientRequestId === request,
    );
    if (existing) return { entry: existing, idempotent: true };
  }

  const now = new Date().toISOString();
  const entry = {
    id: newId("entry"),
    ledgerId,
    entryNo: allocateEntryNo(state, input.sourceType),
    sourceType: input.sourceType,
    status: "DRAFT",
    date: input.date,
    memo: input.memo,
    reference: input.reference,
    adjustmentType: input.adjustmentType,
    adjustmentReason: input.adjustmentReason,
    clientRequestId: request,
    reversalOf: null,
    reversalReason: null,
    reversedBy: null,
    lines: makeLines(input),
    version: 1,
    createdAt: now,
    updatedAt: now,
    postedAt: null,
  };
  state.entries.push(entry);
  return { entry, idempotent: false };
}

function updateDraft(state, ledgerId, id, body) {
  const version = Number(body?.version);
  if (!Number.isInteger(version) || version < 1) {
    throw new DemoHttpError(422, "Reload the draft before saving changes.", [
      { field: "version", message: "Reload the draft before saving changes." },
    ]);
  }
  const existing = entryById(state, ledgerId, id);
  if (!existing) throw new DemoHttpError(404, "The draft was not found.", [], "NOT_FOUND");
  if (existing.status !== "DRAFT") {
    throw new DemoHttpError(409, "Posted entries cannot be edited.", [
      { field: "status", message: "Posted entries cannot be edited." },
    ], "CONFLICT");
  }

  const accounts = activeAccounts(state, ledgerId);
  const input = normalizeEntryInput(body, { forPost: false, accounts });
  if (existing.sourceType !== input.sourceType) {
    throw new DemoHttpError(422, "The transaction type cannot be changed after a draft is created.", [
      {
        field: "sourceType",
        message: "The transaction type cannot be changed after a draft is created.",
      },
    ]);
  }
  if (existing.version !== version) {
    throw new DemoHttpError(409, "This draft changed in another request. Reload it and try again.", [
      { field: "version", message: "This draft changed in another request. Reload it and try again." },
    ], "CONFLICT");
  }

  Object.assign(existing, {
    date: input.date,
    memo: input.memo,
    reference: input.reference,
    adjustmentType: input.adjustmentType,
    adjustmentReason: input.adjustmentReason,
    lines: makeLines(input),
    version: existing.version + 1,
    updatedAt: new Date().toISOString(),
  });
  return existing;
}

function deleteDraft(state, ledgerId, id) {
  const existing = entryById(state, ledgerId, id);
  if (!existing) throw new DemoHttpError(404, "The draft was not found.", [], "NOT_FOUND");
  if (existing.status !== "DRAFT") {
    throw new DemoHttpError(409, "Posted entries cannot be deleted.", [
      { field: "status", message: "Posted entries cannot be deleted." },
    ], "CONFLICT");
  }
  state.entries = state.entries.filter((entry) => entry.id !== id);
  return { id };
}

function postEntry(state, ledgerId, id) {
  const row = entryById(state, ledgerId, id);
  if (!row) throw new DemoHttpError(404, "The entry was not found.", [], "NOT_FOUND");
  if (row.status === "POSTED") {
    throw new DemoHttpError(409, "This entry is already posted.", [
      { field: "status", message: "This entry is already posted." },
    ], "CONFLICT");
  }

  normalizeEntryInput(payloadFromEntry(row), {
    forPost: true,
    accounts: activeAccounts(state, ledgerId),
  });

  const now = new Date().toISOString();
  row.status = "POSTED";
  row.postedAt = now;
  row.updatedAt = now;
  row.version += 1;
  return row;
}

function reverseEntry(state, ledgerId, id, body = {}) {
  const reason = String(body?.reason ?? "").trim();
  if (!reason) {
    throw new DemoHttpError(422, "Add a reason for the reversal.", [
      { field: "reason", message: "Add a reason for the reversal." },
    ]);
  }
  if (reason.length > 300) {
    throw new DemoHttpError(422, "Reversal reason must be 300 characters or fewer.", [
      { field: "reason", message: "Reversal reason must be 300 characters or fewer." },
    ]);
  }

  const original = entryById(state, ledgerId, id);
  if (!original) throw new DemoHttpError(404, "The entry was not found.", [], "NOT_FOUND");
  if (original.status !== "POSTED") {
    throw new DemoHttpError(409, "Only posted entries can be reversed.", [
      { field: "status", message: "Only posted entries can be reversed." },
    ], "CONFLICT");
  }
  if (original.reversalOf) {
    throw new DemoHttpError(409, "A reversal entry cannot itself be reversed.", [
      { field: "status", message: "A reversal entry cannot itself be reversed." },
    ], "CONFLICT");
  }
  if (original.reversedBy) {
    throw new DemoHttpError(409, "This entry already has a reversal.", [
      { field: "status", message: "This entry already has a reversal." },
    ], "CONFLICT");
  }

  const request = body?.clientRequestId ? String(body.clientRequestId).slice(0, 100) : null;
  const now = new Date().toISOString();
  const reversal = {
    id: newId("entry"),
    ledgerId,
    entryNo: allocateEntryNo(state, "GENERAL_JOURNAL"),
    sourceType: "GENERAL_JOURNAL",
    status: "POSTED",
    date: todayIso(),
    memo: `Reversal of ${original.entryNo}: ${original.memo}`,
    reference: `REV-${original.entryNo}`,
    adjustmentType: null,
    adjustmentReason: null,
    clientRequestId: request,
    reversalOf: original.id,
    reversalReason: reason,
    reversedBy: null,
    lines: original.lines.map((line, index) => ({
      id: newId("line"),
      lineNo: index + 1,
      accountId: line.accountId,
      description: line.description || `Reversal of ${original.entryNo}`,
      debitCents: line.creditCents,
      creditCents: line.debitCents,
    })),
    version: 1,
    createdAt: now,
    updatedAt: now,
    postedAt: now,
  };
  original.reversedBy = reversal.id;
  original.updatedAt = now;
  state.entries.push(reversal);
  return { entry: reversal, idempotent: false };
}

// ---------------------------------------------------------------------------
// services/reports.js
// ---------------------------------------------------------------------------

const REPORT_BASES = ["adjusted", "unadjusted"];

function normalizeBasis(value) {
  const basis = String(value || "adjusted").toLowerCase();
  if (!REPORT_BASES.includes(basis)) {
    throw new DemoHttpError(422, "Choose adjusted or unadjusted reporting.", [
      { field: "basis", message: "Choose adjusted or unadjusted reporting." },
    ]);
  }
  return basis;
}

function normalizeAsOf(value) {
  const asOf = value ? String(value) : todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw new DemoHttpError(422, "Enter a valid as-of date.", [
      { field: "asOf", message: "Enter a valid as-of date." },
    ]);
  }
  return asOf;
}

function firstDayOfMonth() {
  return `${todayIso().slice(0, 7)}-01`;
}

function normalizePeriod(fromValue, toValue) {
  const from = fromValue ? String(fromValue) : firstDayOfMonth();
  const to = toValue ? String(toValue) : todayIso();
  const errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) errors.push({ field: "from", message: "Enter a valid start date." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) errors.push({ field: "to", message: "Enter a valid end date." });
  if (!errors.length && from > to) {
    errors.push({ field: "from", message: "The start date must not be after the end date." });
  }
  if (errors.length) throw new DemoHttpError(422, "Check the report dates.", errors);
  return { from, to };
}

const byCode = (left, right) => left.account.code.localeCompare(right.account.code);

function getTrialBalance(state, ledgerId, { asOf: asOfValue, basis: basisValue } = {}) {
  const asOf = normalizeAsOf(asOfValue);
  const basis = normalizeBasis(basisValue);
  const activity = activityRows(state, ledgerId, { to: asOf, basis });

  const rows = accountRows(state, ledgerId)
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
    .sort(byCode);

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

function getIncomeStatement(state, ledgerId, { from: fromValue, to: toValue, basis: basisValue } = {}) {
  const basis = normalizeBasis(basisValue);
  const { from, to } = normalizePeriod(fromValue, toValue);
  const activity = activityRows(state, ledgerId, { from, to, basis });
  const accounts = accountRows(state, ledgerId);
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const revenueRows = [];
  const expenseRows = [];
  for (const [accountId, totals] of activity) {
    const account = accountById.get(accountId);
    if (!account) continue;
    if (account.category === "REVENUE") {
      const amountCents = totals.creditCents - totals.debitCents;
      if (amountCents !== 0) revenueRows.push({ account: publicAccount(account), amountCents });
    } else if (account.category === "EXPENSE") {
      const amountCents = totals.debitCents - totals.creditCents;
      if (amountCents !== 0) expenseRows.push({ account: publicAccount(account), amountCents });
    }
  }
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

function getBalanceSheet(state, ledgerId, { asOf: asOfValue, basis: basisValue } = {}) {
  const asOf = normalizeAsOf(asOfValue);
  const basis = normalizeBasis(basisValue);
  const activity = activityRows(state, ledgerId, { to: asOf, basis });
  const accounts = accountRows(state, ledgerId);

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

function getDashboard(state, ledgerId) {
  const accounts = listAccounts(state, ledgerId);
  const byCategory = Object.fromEntries(
    ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map((category) => [category, 0]),
  );
  for (const account of accounts) byCategory[account.category] += account.balanceCents;

  const netIncomeCents = byCategory.REVENUE - byCategory.EXPENSE;
  const entries = entryRows(state, ledgerId);
  const posted = entries.filter((entry) => entry.status === "POSTED");
  const drafts = entries.filter((entry) => entry.status === "DRAFT");
  const trialBalance = getTrialBalance(state, ledgerId, { asOf: todayIso(), basis: "adjusted" });

  return {
    assetsCents: byCategory.ASSET,
    liabilitiesCents: byCategory.LIABILITY,
    equityCents: byCategory.EQUITY,
    revenueCents: byCategory.REVENUE,
    expensesCents: byCategory.EXPENSE,
    netIncomeCents,
    equationDifferenceCents:
      byCategory.ASSET - (byCategory.LIABILITY + byCategory.EQUITY + netIncomeCents),
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

// ---------------------------------------------------------------------------
// services/auth.js and services/setup.js
// ---------------------------------------------------------------------------

function authStatus(state) {
  if (!state.authenticated) {
    return {
      claimed: true,
      authenticated: false,
      setupRequired: false,
      displayName: state.profile?.displayName || state.profile?.name,
    };
  }
  const active = ledger(state);
  return {
    claimed: true,
    authenticated: true,
    setupRequired: false,
    user: {
      id: state.profile.id,
      username: state.profile.username,
      displayName: state.profile.displayName || state.profile.name,
      createdAt: state.profile.createdAt,
      updatedAt: state.profile.updatedAt,
    },
    ledgers: state.ledgers,
    activeLedger: active,
    csrfToken: "demo-csrf-token",
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  };
}

function requireAuth(state) {
  if (!state.authenticated) {
    throw new DemoHttpError(401, "Sign in to continue.", [], "UNAUTHENTICATED");
  }
  return ledger(state);
}

function seedAccountsFor(state, ledgerId) {
  const now = new Date().toISOString();
  for (const account of state.defaultAccounts) {
    state.accounts.push({
      id: newId("acct"),
      ledgerId,
      code: account.code,
      name: account.name,
      category: account.category,
      description: account.description,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function createLedger(state, body) {
  const input = normalizeWorkspaceInput(body);
  const now = new Date().toISOString();
  const created = {
    id: newId("ledger"),
    name: input.name,
    currency: input.currency,
    createdAt: now,
    updatedAt: now,
  };
  state.ledgers.push(created);
  seedAccountsFor(state, created.id);
  return created;
}

function switchLedger(state, ledgerId) {
  const target = state.ledgers.find((item) => item.id === ledgerId);
  if (!target) throw new DemoHttpError(404, "The ledger was not found.", [], "NOT_FOUND");
  state.activeLedgerId = target.id;
  return target;
}

function saveProfile(state, body) {
  const input = normalizeProfileInput(body);
  state.profile.name = input.name;
  state.profile.displayName = input.name;
  state.profile.updatedAt = new Date().toISOString();
  return state.profile;
}

function saveWorkspace(state, body) {
  const input = normalizeWorkspaceInput(body);
  const active = requireAuth(state);
  active.name = input.name;
  active.currency = input.currency;
  active.updatedAt = new Date().toISOString();
  return active;
}

function login(state) {
  state.authenticated = true;
  const active = state.ledgers[0];
  if (active) state.activeLedgerId = active.id;
}

// ---------------------------------------------------------------------------
// HTTP surface
// ---------------------------------------------------------------------------

function bootstrap(state) {
  const auth = authStatus(state);
  if (!auth.authenticated) return { auth };
  const ledgerId = state.activeLedgerId;
  return {
    auth,
    profile: state.profile,
    workspace: ledger(state),
    accounts: listAccounts(state, ledgerId),
    entries: entryRows(state, ledgerId),
    dashboard: getDashboard(state, ledgerId),
    trialBalance: getTrialBalance(state, ledgerId, { basis: "adjusted" }),
  };
}

const routes = [
  ["GET", /^\/api\/health$/, () => ({ ok: true, service: "ledgerline", schemaVersion: 5, demo: true })],
  ["GET", /^\/api\/bootstrap$/, (state) => bootstrap(state)],
  ["GET", /^\/api\/auth\/me$/, (state) => ({ auth: authStatus(state) })],
  [
    "POST",
    /^\/api\/auth\/claim$/,
    (state) => {
      state.authenticated = true;
      return { auth: authStatus(state), ledger: ledger(state) };
    },
  ],
  [
    "POST",
    /^\/api\/auth\/login$/,
    (state) => {
      login(state);
      return { auth: authStatus(state), ledger: ledger(state) };
    },
  ],
  ["POST", /^\/api\/auth\/logout$/, (state) => {
    state.authenticated = false;
    return { ok: true };
  }],
  ["POST", /^\/api\/auth\/lock$/, (state) => {
    state.authenticated = false;
    return { ok: true };
  }],
  ["GET", /^\/api\/profile$/, (state) => {
    requireAuth(state);
    return { profile: state.profile };
  }],
  ["PUT", /^\/api\/profile$/, (state, _m, body) => {
    requireAuth(state);
    return { profile: saveProfile(state, body) };
  }],
  ["GET", /^\/api\/workspace$/, (state) => ({ workspace: requireAuth(state) })],
  ["PUT", /^\/api\/workspace$/, (state, _m, body) => ({ workspace: saveWorkspace(state, body) })],
  ["GET", /^\/api\/ledgers$/, (state) => {
    const active = requireAuth(state);
    return { ledgers: state.ledgers, activeLedger: active };
  }],
  ["POST", /^\/api\/ledgers$/, (state, _m, body) => {
    requireAuth(state);
    const created = createLedger(state, body);
    return { ledger: created, activeLedger: switchLedger(state, created.id) };
  }],
  ["POST", /^\/api\/ledgers\/([^/]+)\/switch$/, (state, [id]) => {
    requireAuth(state);
    return { ledger: switchLedger(state, decodeURIComponent(id)) };
  }],
  ["GET", /^\/api\/accounts$/, (state) => ({ accounts: listAccounts(state, requireAuth(state).id) })],
  ["POST", /^\/api\/accounts$/, (state, _m, body) => ({
    account: createAccount(state, requireAuth(state).id, body),
  })],
  ["PUT", /^\/api\/accounts\/([^/]+)$/, (state, [id], body) => ({
    account: updateAccount(state, requireAuth(state).id, decodeURIComponent(id), body),
  })],
  ["POST", /^\/api\/accounts\/([^/]+)\/active$/, (state, [id], body) => ({
    account: setAccountActive(state, requireAuth(state).id, decodeURIComponent(id), body?.active),
  })],
  ["GET", /^\/api\/entries$/, (state) => ({ entries: entryRows(state, requireAuth(state).id) })],
  [
    "POST",
    /^\/api\/entries$/,
    (state, _m, body, headers) => {
      const ledgerId = requireAuth(state).id;
      const request = headers["idempotency-key"] || body?.clientRequestId || null;
      return createDraft(state, ledgerId, body, request);
    },
  ],
  [
    "PUT",
    /^\/api\/entries\/([^/]+)$/,
    (state, [id], body) => ({
      entry: updateDraft(state, requireAuth(state).id, decodeURIComponent(id), body),
    }),
  ],
  [
    "DELETE",
    /^\/api\/entries\/([^/]+)$/,
    (state, [id]) => deleteDraft(state, requireAuth(state).id, decodeURIComponent(id)),
  ],
  [
    "POST",
    /^\/api\/entries\/([^/]+)\/post$/,
    (state, [id]) => ({ entry: postEntry(state, requireAuth(state).id, decodeURIComponent(id)) }),
  ],
  [
    "POST",
    /^\/api\/entries\/([^/]+)\/reverse$/,
    (state, [id], body, headers) => {
      const ledgerId = requireAuth(state).id;
      const request = headers["idempotency-key"] || body?.clientRequestId || null;
      return reverseEntry(state, ledgerId, decodeURIComponent(id), { ...body, clientRequestId: request });
    },
  ],
  ["GET", /^\/api\/dashboard$/, (state) => getDashboard(state, requireAuth(state).id)],
  [
    "GET",
    /^\/api\/reports\/trial-balance$/,
    (state, _m, _b, _h, query) =>
      getTrialBalance(state, requireAuth(state).id, {
        asOf: query.get("asOf"),
        basis: query.get("basis"),
      }),
  ],
  [
    "GET",
    /^\/api\/reports\/income-statement$/,
    (state, _m, _b, _h, query) =>
      getIncomeStatement(state, requireAuth(state).id, {
        from: query.get("from"),
        to: query.get("to"),
        basis: query.get("basis"),
      }),
  ],
  [
    "GET",
    /^\/api\/reports\/balance-sheet$/,
    (state, _m, _b, _h, query) =>
      getBalanceSheet(state, requireAuth(state).id, {
        asOf: query.get("asOf"),
        basis: query.get("basis"),
      }),
  ],
];

/**
 * Answer one API request against in-memory state. Returns the status code and
 * the JSON body, exactly like the Express routes do.
 */
export function handleDemoRequest(state, method, pathname, { body = null, headers = {} } = {}) {
  const url = new URL(pathname, "https://demo.local");
  for (const [verb, pattern, handler] of routes) {
    if (verb !== method) continue;
    const match = url.pathname.match(pattern);
    if (!match) continue;
    try {
      return { status: 200, payload: handler(state, match.slice(1), body, headers, url.searchParams) };
    } catch (error) {
      const failure = validation(error);
      return {
        status: failure.status,
        payload: {
          error: {
            code: failure.code,
            message: failure.message,
            details: failure.details || [],
          },
        },
      };
    }
  }
  return {
    status: 404,
    payload: { error: { code: "NOT_FOUND", message: "The endpoint was not found.", details: [] } },
  };
}
