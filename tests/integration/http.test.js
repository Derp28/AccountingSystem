import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../../server/app.js";
import { createTestDatabase } from "../helpers/test-db.js";

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

async function put(url, body) {
  return fetch(url, { ...json(body), method: "PUT" });
}

test("health and bootstrap expose the seeded hundreds-series chart of accounts", async () => {
  await withServer(async ({ base }) => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.schemaVersion, 4);

    const bootstrap = await (await fetch(`${base}/api/bootstrap`)).json();
    assert.equal(bootstrap.profile, null);
    assert.equal(bootstrap.accounts.length, 10);
    assert.deepEqual(
      bootstrap.accounts.map((account) => account.code),
      ["100", "101", "102", "103", "200", "201", "300", "400", "500", "501"],
    );
    assert.equal(bootstrap.dashboard.equationDifferenceCents, 0);
  });
});

test("profile, workspace and account CRUD round-trip through the API", async () => {
  await withServer(async ({ base }) => {
    const profile = await put(`${base}/api/profile`, { name: "API Studio" });
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).profile.name, "API Studio");

    const workspace = await put(`${base}/api/workspace`, { name: "API Books", currency: "eur" });
    assert.equal(workspace.status, 200);
    assert.equal((await workspace.json()).workspace.currency, "EUR");

    const outOfRange = await fetch(`${base}/api/accounts`, json({
      code: "520",
      name: "Misclassified",
      category: "ASSET",
    }));
    assert.equal(outOfRange.status, 422);
    const outOfRangeBody = await outOfRange.json();
    assert.equal(outOfRangeBody.error.details[0].field, "code");
    assert.match(outOfRangeBody.error.details[0].message, /Asset codes must be between 100 and 199/);

    const created = await fetch(`${base}/api/accounts`, json({
      code: "520",
      name: "Software",
      category: "EXPENSE",
      description: "Subscriptions",
    }));
    assert.equal(created.status, 201);
    const account = (await created.json()).account;
    assert.equal(account.code, "520");

    const duplicate = await fetch(`${base}/api/accounts`, json({
      code: "520",
      name: "Duplicate",
      category: "EXPENSE",
    }));
    assert.equal(duplicate.status, 409);

    const updated = await put(`${base}/api/accounts/${account.id}`, {
      code: "520",
      name: "Software and tools",
      category: "EXPENSE",
      description: "Subscriptions",
      active: true,
    });
    assert.equal((await updated.json()).account.name, "Software and tools");

    const deactivated = await fetch(`${base}/api/accounts/${account.id}/active`, json({ active: false }));
    assert.equal((await deactivated.json()).account.active, false);
  });
});

test("entry lifecycle: draft, post, reverse, duplicate protection", async () => {
  await withServer(async ({ base }) => {
    await put(`${base}/api/profile`, { name: "API Studio" });
    await put(`${base}/api/workspace`, { name: "API Books", currency: "USD" });

    const created = await fetch(`${base}/api/entries`, json({
      sourceType: "SALES_INVOICE",
      date: "2026-10-15",
      memo: "HTTP invoice",
      lines: [
        { accountId: "acct-110", debitCents: 125000, creditCents: 0 },
        { accountId: "acct-400", debitCents: 0, creditCents: 125000 },
      ],
    }));
    assert.equal(created.status, 201);
    const entry = (await created.json()).entry;
    assert.equal(entry.status, "DRAFT");

    const posted = await fetch(`${base}/api/entries/${entry.id}/post`, json({}));
    assert.equal(posted.status, 200);
    assert.equal((await posted.json()).entry.status, "POSTED");

    const repost = await fetch(`${base}/api/entries/${entry.id}/post`, json({}));
    assert.equal(repost.status, 409);

    const reversed = await fetch(`${base}/api/entries/${entry.id}/reverse`, json({ reason: "Refund" }));
    assert.equal(reversed.status, 200);
    const reversal = (await reversed.json()).entry;
    assert.equal(reversal.reversalOf, entry.id);

    const reverseAgain = await fetch(`${base}/api/entries/${entry.id}/reverse`, json({ reason: "Again" }));
    assert.equal(reverseAgain.status, 409);

    const bootstrap = await (await fetch(`${base}/api/bootstrap`)).json();
    assert.equal(bootstrap.entries.length, 2);
    assert.equal(bootstrap.trialBalance.differenceCents, 0);
    assert.equal(bootstrap.dashboard.equationDifferenceCents, 0);
  });
});

test("API converts two-decimal line amounts exactly and rejects excess precision", async () => {
  await withServer(async ({ base }) => {
    await put(`${base}/api/profile`, { name: "API Studio" });
    await put(`${base}/api/workspace`, { name: "API Books", currency: "USD" });

    const created = await fetch(`${base}/api/entries`, json({
      sourceType: "GENERAL_JOURNAL",
      date: "2026-10-20",
      memo: "Decimal precision",
      lines: [
        { accountId: "acct-100", debit: "10.25" },
        { accountId: "acct-400", credit: "10.25" },
      ],
    }));
    assert.equal(created.status, 201);
    const entry = (await created.json()).entry;
    assert.equal(entry.lines[0].debitCents, 1025);
    assert.equal(entry.lines[1].creditCents, 1025);

    const posted = await fetch(`${base}/api/entries/${entry.id}/post`, json({}));
    assert.equal(posted.status, 200);
    const bootstrap = await (await fetch(`${base}/api/bootstrap`)).json();
    assert.equal(bootstrap.accounts.find((account) => account.code === "100").balanceCents, 1025);

    const invalid = await fetch(`${base}/api/entries`, json({
      sourceType: "GENERAL_JOURNAL",
      date: "2026-10-20",
      memo: "Too precise",
      lines: [
        { accountId: "acct-100", debit: "10.255" },
        { accountId: "acct-400", credit: "10.255" },
      ],
    }));
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
    await put(`${base}/api/profile`, { name: "API Studio" });
    const nasty = "Robert'); DROP TABLE accounts;-- <script>alert(1)</script>";
    const created = await fetch(`${base}/api/accounts`, json({
      code: "530",
      name: nasty,
      category: "EXPENSE",
    }));
    assert.equal(created.status, 201);
    const account = (await created.json()).account;
    assert.equal(account.name, nasty);

    const bootstrap = await (await fetch(`${base}/api/bootstrap`)).json();
    assert.equal(bootstrap.accounts.length, 11);
    assert.ok(bootstrap.accounts.some((candidate) => candidate.name === nasty));
  });
});
