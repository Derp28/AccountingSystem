import { claimLocalAccount, getFirstLedger, getLocalUser } from "../../server/services/auth.js";
import { saveWorkspace } from "../../server/services/setup.js";

export const TEST_USERNAME = "tester";
export const TEST_PASSWORD = "correct horse battery staple";
// Fixed scrypt hash of TEST_PASSWORD with the production parameters. Tests use
// it to set up auth synchronously; the login path still verifies it normally.
export const TEST_PASSWORD_HASH =
  "scrypt$16384$8$1$R2v4nI5PdpVM5ROM-asFBw$0g68mBfPOQNr-s0XpnMcRvdUKuwW-NLq2Q9DZIYuFc6eXxCLAey9blwKJmnMVEwpLOu5OzCuYYdOh1_HjxYYoQ";

export const DEFAULT_LEDGER_ID = "ledger-default";

export function currentLedgerId(db) {
  const user = getLocalUser(db);
  return getFirstLedger(db, user.id)?.id || DEFAULT_LEDGER_ID;
}

/**
 * Claim the legacy local account that migration 005 creates, and rename the
 * default ledger. Kept synchronous by using the fixed test hash above.
 */
export function setupProfileWorkspace(
  db,
  { profileName = "Test Studio", workspaceName = "Test Books", currency = "USD" } = {},
) {
  const user = getLocalUser(db);
  if (!user) throw new Error("The local user placeholder is missing.");
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE users
    SET username = ?, display_name = ?, password_hash = ?, claimed = 1,
        failed_attempts = 0, locked_until = NULL, updated_at = ?
    WHERE id = ?
  `).run(TEST_USERNAME, profileName, TEST_PASSWORD_HASH, now, user.id);

  let ledger = getFirstLedger(db, user.id);
  if (!ledger) throw new Error("The default ledger is missing.");
  if (ledger.name !== workspaceName || ledger.currency !== currency) {
    ledger = saveWorkspace(db, ledger.id, { name: workspaceName, currency });
  }
  return ledger.id;
}

/** Exercise the real async claim path for the first-run flow. */
export async function claimTestAccount(db, overrides = {}) {
  return claimLocalAccount(db, {
    displayName: "Test Studio",
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    ledgerName: "Test Books",
    currency: "USD",
    ...overrides,
  });
}

export function accountByCode(db, code, ledgerId = currentLedgerId(db)) {
  return db.prepare("SELECT * FROM accounts WHERE code = ? AND ledger_id = ?").get(code, ledgerId);
}

/**
 * Minimal auth context for service-level tests that only need the user ID,
 * a ledger, and a session marker.
 */
export function authFor(db, ledgerId = currentLedgerId(db)) {
  const user = getLocalUser(db);
  const ledger = db.prepare("SELECT * FROM ledgers WHERE id = ?").get(ledgerId);
  return {
    user: { id: user.id, username: user.username, displayName: user.display_name },
    ledger: { id: ledger.id, name: ledger.name, currency: ledger.currency },
    session: { tokenHash: "test-session", csrfToken: "test-csrf", activeLedgerId: ledger.id },
  };
}

export function draftPayload(overrides = {}) {
  return {
    sourceType: "SALES_INVOICE",
    date: "2026-10-15",
    memo: "Consulting invoice",
    reference: "INV-1001",
    lines: [
      { accountId: "acct-110", description: "Invoice total", debitCents: 250000, creditCents: 0 },
      { accountId: "acct-400", description: "Consulting", debitCents: 0, creditCents: 250000 },
    ],
    ...overrides,
  };
}
