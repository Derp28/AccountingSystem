import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../../server/app.js";
import { createTestDatabase } from "../helpers/test-db.js";
import { TEST_PASSWORD, TEST_USERNAME } from "../helpers/fixtures.js";

async function withServer(run) {
  const context = createTestDatabase();
  const server = createApp({ db: context.db }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await run({ base, db: context.db });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    context.cleanup();
  }
}

function json(body) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function cookieFrom(response) {
  const values = response.headers.getSetCookie?.() || [response.headers.get("set-cookie") || ""];
  return String(values[0] || "").split(";")[0];
}

function authed(auth, headers = {}) {
  return { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf, ...headers };
}

function getJson(url, auth) {
  return fetch(url, { headers: authed(auth) });
}

function postJson(url, body, auth) {
  return fetch(url, {
    method: "POST",
    headers: authed(auth, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
}

function putJson(url, body, auth) {
  return fetch(url, {
    method: "PUT",
    headers: authed(auth, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
}

async function claim(base, overrides = {}) {
  const response = await fetch(
    `${base}/api/auth/claim`,
    json({
      displayName: "API Studio",
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      ledgerName: "API Books",
      currency: "USD",
      ...overrides,
    }),
  );
  assert.equal(response.status, 201);
  const payload = await response.json();
  return { cookie: cookieFrom(response), csrf: payload.auth.csrfToken };
}

test("health and bootstrap expose the seeded hundreds-series chart of accounts", async () => {
  await withServer(async ({ base }) => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.schemaVersion, 6);

    const locked = await (await fetch(`${base}/api/bootstrap`)).json();
    assert.equal(locked.auth.claimed, false);
    assert.equal(locked.accounts, undefined);

    const auth = await claim(base);
    const bootstrap = await (await getJson(`${base}/api/bootstrap`, auth)).json();
    assert.equal(bootstrap.profile.name, "API Studio");
    assert.equal(bootstrap.accounts.length, 17);
    assert.deepEqual(
      bootstrap.accounts.map((account) => account.code),
      ["100", "101", "102", "103", "104", "200", "201", "202", "203", "204", "300", "301", "400", "500", "501", "502", "503"],
    );
    assert.equal(bootstrap.dashboard.equationDifferenceCents, 0);
    assert.equal(bootstrap.auth.authenticated, true);
    assert.equal(bootstrap.auth.activeLedger.name, "API Books");
  });
});

test("unauthenticated reads and cross-site writes are rejected", async () => {
  await withServer(async ({ base }) => {
    const unauthorized = await fetch(`${base}/api/accounts`);
    assert.equal(unauthorized.status, 401);

    const auth = await claim(base);

    const noCsrf = await fetch(`${base}/api/accounts`, {
      ...json({ code: "530", name: "No token", category: "EXPENSE" }),
      headers: { Cookie: auth.cookie, "Content-Type": "application/json" },
    });
    assert.equal(noCsrf.status, 403);

    const badOrigin = await fetch(`${base}/api/accounts`, {
      ...json({ code: "530", name: "Bad origin", category: "EXPENSE" }),
      headers: authed(auth, { "Content-Type": "application/json", Origin: "http://evil.example" }),
    });
    assert.equal(badOrigin.status, 403);

    const locked = await fetch(
      `${base}/api/auth/login`,
      json({ username: TEST_USERNAME, password: "wrong password entirely" }),
    );
    assert.equal(locked.status, 401);
  });
});

test("profile, workspace and account CRUD round-trip through the API", async () => {
  await withServer(async ({ base }) => {
    const auth = await claim(base);

    const profile = await putJson(`${base}/api/profile`, { name: "API Studio" }, auth);
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).profile.name, "API Studio");

    const workspace = await putJson(`${base}/api/workspace`, { name: "API Books", currency: "eur" }, auth);
    assert.equal(workspace.status, 200);
    assert.equal((await workspace.json()).workspace.currency, "EUR");

    const outOfRange = await postJson(
      `${base}/api/accounts`,
      { code: "520", name: "Misclassified", category: "ASSET" },
      auth,
    );
    assert.equal(outOfRange.status, 422);
    const outOfRangeBody = await outOfRange.json();
    assert.equal(outOfRangeBody.error.details[0].field, "code");
    assert.match(outOfRangeBody.error.details[0].message, /Asset codes must be between 100 and 199/);

    const created = await postJson(
      `${base}/api/accounts`,
      { code: "520", name: "Software", category: "EXPENSE", description: "Subscriptions" },
      auth,
    );
    assert.equal(created.status, 201);
    const account = (await created.json()).account;
    assert.equal(account.code, "520");

    const duplicate = await postJson(
      `${base}/api/accounts`,
      { code: "520", name: "Duplicate", category: "EXPENSE" },
      auth,
    );
    assert.equal(duplicate.status, 409);

    const updated = await putJson(
      `${base}/api/accounts/${account.id}`,
      {
        code: "520",
        name: "Software and tools",
        category: "EXPENSE",
        description: "Subscriptions",
        active: true,
      },
      auth,
    );
    assert.equal((await updated.json()).account.name, "Software and tools");

    const deactivated = await postJson(`${base}/api/accounts/${account.id}/active`, { active: false }, auth);
    assert.equal((await deactivated.json()).account.active, false);
  });
});

test("entry lifecycle: draft, post, reverse, duplicate protection", async () => {
  await withServer(async ({ base }) => {
    const auth = await claim(base);

    const created = await postJson(
      `${base}/api/entries`,
      {
        sourceType: "SALES_INVOICE",
        date: "2026-10-15",
        memo: "HTTP invoice",
        lines: [
          { accountId: "acct-101", debitCents: 125000, creditCents: 0 },
          { accountId: "acct-400", debitCents: 0, creditCents: 125000 },
        ],
      },
      auth,
    );
    assert.equal(created.status, 201);
    const entry = (await created.json()).entry;
    assert.equal(entry.status, "DRAFT");

    const posted = await postJson(`${base}/api/entries/${entry.id}/post`, {}, auth);
    assert.equal(posted.status, 200);
    assert.equal((await posted.json()).entry.status, "POSTED");

    const repost = await postJson(`${base}/api/entries/${entry.id}/post`, {}, auth);
    assert.equal(repost.status, 409);

    const reversed = await postJson(`${base}/api/entries/${entry.id}/reverse`, { reason: "Refund" }, auth);
    assert.equal(reversed.status, 200);
    const reversal = (await reversed.json()).entry;
    assert.equal(reversal.reversalOf, entry.id);

    const reverseAgain = await postJson(`${base}/api/entries/${entry.id}/reverse`, { reason: "Again" }, auth);
    assert.equal(reverseAgain.status, 409);

    const bootstrap = await (await getJson(`${base}/api/bootstrap`, auth)).json();
    assert.equal(bootstrap.entries.length, 2);
    assert.equal(bootstrap.trialBalance.differenceCents, 0);
    assert.equal(bootstrap.dashboard.equationDifferenceCents, 0);
  });
});

test("API converts two-decimal line amounts exactly and rejects excess precision", async () => {
  await withServer(async ({ base }) => {
    const auth = await claim(base);

    const created = await postJson(
      `${base}/api/entries`,
      {
        sourceType: "GENERAL_JOURNAL",
        date: "2026-10-20",
        memo: "Decimal precision",
        lines: [
          { accountId: "acct-100", debit: "10.25" },
          { accountId: "acct-400", credit: "10.25" },
        ],
      },
      auth,
    );
    assert.equal(created.status, 201);
    const entry = (await created.json()).entry;
    assert.equal(entry.lines[0].debitCents, 1025);
    assert.equal(entry.lines[1].creditCents, 1025);

    const posted = await postJson(`${base}/api/entries/${entry.id}/post`, {}, auth);
    assert.equal(posted.status, 200);
    const bootstrap = await (await getJson(`${base}/api/bootstrap`, auth)).json();
    assert.equal(bootstrap.accounts.find((account) => account.code === "100").balanceCents, 1025);

    const invalid = await postJson(
      `${base}/api/entries`,
      {
        sourceType: "GENERAL_JOURNAL",
        date: "2026-10-20",
        memo: "Too precise",
        lines: [
          { accountId: "acct-100", debit: "10.255" },
          { accountId: "acct-400", credit: "10.255" },
        ],
      },
      auth,
    );
    assert.equal(invalid.status, 422);
  });
});

test("security: bad origin, wrong content type, bad JSON and oversized payloads are rejected", async () => {
  await withServer(async ({ base }) => {
    const badOrigin = await fetch(`${base}/api/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "http://evil.example" },
      body: JSON.stringify({ name: "Nope" }),
    });
    assert.equal(badOrigin.status, 403);

    const wrongType = await fetch(`${base}/api/profile`, {
      method: "PUT",
      body: JSON.stringify({ name: "Nope" }),
    });
    assert.equal(wrongType.status, 415);

    const badJson = await fetch(`${base}/api/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(badJson.status, 400);

    const oversized = await fetch(`${base}/api/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(200000) }),
    });
    assert.equal(oversized.status, 413);
  });
});

test("SQL metacharacters and markup are stored as inert data", async () => {
  await withServer(async ({ base }) => {
    const auth = await claim(base);
    const nasty = "Robert'); DROP TABLE accounts;-- <script>alert(1)</script>";
    const created = await postJson(
      `${base}/api/accounts`,
      { code: "530", name: nasty, category: "EXPENSE" },
      auth,
    );
    assert.equal(created.status, 201);
    const account = (await created.json()).account;
    assert.equal(account.name, nasty);

    const bootstrap = await (await getJson(`${base}/api/bootstrap`, auth)).json();
    assert.equal(bootstrap.accounts.length, 18);
    assert.ok(bootstrap.accounts.some((candidate) => candidate.name === nasty));
  });
});
