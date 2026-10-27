import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "../helpers/test-db.js";
import {
  TEST_PASSWORD,
  TEST_USERNAME,
  authFor,
  claimTestAccount,
  currentLedgerId,
  draftPayload,
  setupProfileWorkspace,
} from "../helpers/fixtures.js";
import {
  claimLocalAccount,
  createLedger,
  getAuthStatus,
  getLocalUser,
  login,
  resetPassword,
  resolveSession,
  switchLedger,
} from "../../server/services/auth.js";
import { createAccount, getAccount, listAccounts } from "../../server/services/accounts.js";
import { createDraft, listEntries } from "../../server/services/entries.js";
import { getTrialBalance } from "../../server/services/reports.js";

function hasStatus(status, code) {
  return (error) => error.status === status && (!code || error.code === code);
}

test("first-run claim creates the local account, a ledger, and a session", async () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const statusBefore = getAuthStatus(db, null);
    assert.equal(statusBefore.claimed, false);
    assert.equal(statusBefore.setupRequired, true);

    const result = await claimTestAccount(db);
    assert.equal(result.user.username, TEST_USERNAME);
    assert.equal(result.ledger.name, "Test Books");
    assert.ok(result.token);
    assert.ok(result.csrfToken);

    const user = getLocalUser(db);
    assert.equal(user.claimed, 1);
    assert.equal(listAccounts(db, result.ledger.id).length, 17);

    const resolved = resolveSession(db, result.token);
    assert.equal(resolved.user.username, TEST_USERNAME);
    assert.equal(resolved.ledger.id, result.ledger.id);

    await assert.rejects(
      () =>
        claimLocalAccount(db, {
          displayName: "Again",
          username: "again",
          password: "another long password",
          ledgerName: "Again Books",
          currency: "USD",
        }),
      hasStatus(409),
    );
  } finally {
    cleanup();
  }
});

test("login verifies the password, backs off after repeated failures, and reset revokes sessions", async () => {
  const { db, cleanup } = createTestDatabase();
  try {
    setupProfileWorkspace(db);

    const session = await login(db, { username: TEST_USERNAME, password: TEST_PASSWORD });
    assert.ok(resolveSession(db, session.token));

    // Four wrong attempts return a generic 401; the fifth locks the account.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await assert.rejects(
        () => login(db, { username: TEST_USERNAME, password: "not the right password" }),
        hasStatus(401),
      );
    }
    await assert.rejects(
      () => login(db, { username: TEST_USERNAME, password: "not the right password" }),
      hasStatus(429),
    );
    await assert.rejects(
      () => login(db, { username: TEST_USERNAME, password: TEST_PASSWORD }),
      hasStatus(429),
    );

    const user = getLocalUser(db);
    assert.ok(user.locked_until);

    await resetPassword(db, TEST_USERNAME, "a brand new long password");
    assert.equal(resolveSession(db, session.token), null, "reset revokes existing sessions");
    await assert.rejects(
      () => login(db, { username: TEST_USERNAME, password: TEST_PASSWORD }),
      hasStatus(401),
    );
    const afterReset = await login(db, { username: TEST_USERNAME, password: "a brand new long password" });
    assert.ok(afterReset.token);
  } finally {
    cleanup();
  }
});

test("ledgers are isolated for accounts, entries, numbering, and reports", () => {
  const { db, cleanup } = createTestDatabase();
  try {
    const ledgerA = setupProfileWorkspace(db, { workspaceName: "First Books" });
    const auth = authFor(db, ledgerA);
    const ledgerB = createLedger(db, auth, { name: "Second Books", currency: "USD" });

    assert.equal(listAccounts(db, ledgerB.id).length, 17, "new ledger gets its own seeded chart");

    // Same human-readable code is allowed in each ledger.
    const codeA = createAccount(db, ledgerA, {
      code: "520",
      name: "First software",
      category: "EXPENSE",
    });
    const codeB = createAccount(db, ledgerB.id, {
      code: "520",
      name: "Second software",
      category: "EXPENSE",
    });
    assert.equal(codeA.code, "520");
    assert.equal(codeB.code, "520");
    assert.notEqual(codeA.id, codeB.id);
    assert.equal(getAccount(db, ledgerB.id, codeA.id), null, "accounts do not leak across ledgers");

    createDraft(db, ledgerA, draftPayload());
    assert.equal(listEntries(db, ledgerA).length, 1);
    assert.equal(listEntries(db, ledgerB.id).length, 0);
    assert.equal(getTrialBalance(db, ledgerB.id).rows.length, 0);

    const switched = switchLedger(db, auth, ledgerB.id);
    assert.equal(switched.id, ledgerB.id);
    assert.throws(() => switchLedger(db, auth, "ledger-does-not-exist"), hasStatus(404));

    // A ledger entry cannot reference an account from another ledger.
    assert.throws(
      () =>
        createDraft(db, ledgerB.id, {
          ...draftPayload(),
          lines: [
            { accountId: codeA.id, debitCents: 1000, creditCents: 0 },
            { accountId: "acct-400", debitCents: 0, creditCents: 1000 },
          ],
        }),
      (error) => error.status === 422 || /belongs to another ledger/.test(String(error.message)),
    );

    assert.equal(currentLedgerId(db), ledgerA);
  } finally {
    cleanup();
  }
});
