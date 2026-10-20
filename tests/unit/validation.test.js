import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidIsoDate,
  normalizeAccountInput,
  normalizeEntryInput,
  normalizeProfileInput,
  normalizeWorkspaceInput,
} from "../../server/lib/validation.js";

const accounts = [
  { id: "acct-100", code: "100", name: "Cash", active: true },
  { id: "acct-400", code: "400", name: "Service Revenue", active: true },
  { id: "acct-999", code: "999", name: "Closed account", active: false },
];

test("profile and workspace input enforce required names and a valid currency", () => {
  assert.deepEqual(normalizeProfileInput({ name: "  Studio  " }), { name: "Studio" });
  assert.throws(() => normalizeProfileInput({ name: "   " }), /Enter your name/);
  assert.throws(() => normalizeProfileInput({ name: "x".repeat(101) }), /100 characters/);

  assert.deepEqual(normalizeWorkspaceInput({ name: "  Books  ", currency: " usd " }), {
    name: "Books",
    currency: "USD",
  });
  assert.throws(() => normalizeWorkspaceInput({ name: "", currency: "USD" }), /workspace a name/);
  assert.throws(
    () => normalizeWorkspaceInput({ name: "Books", currency: "US" }),
    /three-letter currency/,
  );
  assert.throws(
    () => normalizeWorkspaceInput({ name: "Books", currency: "ZZZ" }),
    /supported currency/,
  );
});

test("ISO dates are validated strictly", () => {
  assert.equal(isValidIsoDate("2026-10-20"), true);
  assert.equal(isValidIsoDate("2026-02-29"), false);
  assert.equal(isValidIsoDate("2026-13-01"), false);
  assert.equal(isValidIsoDate("not-a-date"), false);
});

test("account input normalizes and validates", () => {
  const account = normalizeAccountInput({
    code: " 520 ",
    name: "Software",
    category: "expense",
    description: "Subscriptions",
    active: true,
  });
  assert.deepEqual(account, {
    code: "520",
    name: "Software",
    category: "EXPENSE",
    description: "Subscriptions",
    active: true,
  });
  assert.throws(() => normalizeAccountInput({ code: "", name: "x", category: "ASSET" }), /required/);
  assert.throws(
    () => normalizeAccountInput({ code: "1", name: "x", category: "ASSET" }),
    /three-digit numeric/,
  );
  assert.throws(
    () => normalizeAccountInput({ code: "52", name: "x", category: "ASSET" }),
    /three-digit numeric/,
  );
  assert.throws(
    () => normalizeAccountInput({ code: "520", name: "x", category: "ASSET" }),
    /Asset codes must be between 100 and 199/,
  );
  assert.throws(
    () => normalizeAccountInput({ code: "600", name: "x", category: "EXPENSE" }),
    /Expense codes must be between 500 and 599/,
  );
  assert.equal(
    normalizeAccountInput({ code: "199", name: "Furniture", category: "ASSET" }).code,
    "199",
  );
  assert.throws(
    () => normalizeAccountInput({ code: "100", name: "x", category: "NOPE" }),
    /category/,
  );
});

test("posting validation rejects unbalanced lines", () => {
  assert.throws(
    () =>
      normalizeEntryInput(
        {
          sourceType: "GENERAL_JOURNAL",
          date: "2026-10-20",
          memo: "Unbalanced",
          lines: [
            { accountId: "acct-100", debitCents: 1000, creditCents: 0 },
            { accountId: "acct-400", debitCents: 0, creditCents: 900 },
          ],
        },
        { forPost: true, accounts },
      ),
    /equal/i,
  );
});

test("posting validation rejects inactive accounts and two-sided lines", () => {
  assert.throws(
    () =>
      normalizeEntryInput(
        {
          sourceType: "GENERAL_JOURNAL",
          date: "2026-10-20",
          memo: "Inactive",
          lines: [
            { accountId: "acct-999", debitCents: 1000, creditCents: 0 },
            { accountId: "acct-400", debitCents: 0, creditCents: 1000 },
          ],
        },
        { forPost: true, accounts },
      ),
    /inactive/,
  );

  assert.throws(
    () =>
      normalizeEntryInput(
        {
          sourceType: "GENERAL_JOURNAL",
          date: "2026-10-20",
          memo: "Two sides",
          lines: [
            { accountId: "acct-100", debitCents: 1000, creditCents: 1000 },
            { accountId: "acct-400", debitCents: 0, creditCents: 0 },
          ],
        },
        { forPost: true, accounts },
      ),
    /either a debit or a credit/,
  );
});

test("adjustments require a type and reason", () => {
  assert.throws(
    () =>
      normalizeEntryInput(
        {
          sourceType: "ADJUSTMENT",
          date: "2026-10-20",
          memo: "Missing detail",
          lines: [
            { accountId: "acct-100", debitCents: 1000, creditCents: 0 },
            { accountId: "acct-400", debitCents: 0, creditCents: 1000 },
          ],
        },
        { forPost: true, accounts },
      ),
    /adjustment type/i,
  );
});
