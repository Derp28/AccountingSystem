import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function startServer(port, dbPath) {
  return spawn(process.execPath, ["server/index.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      ACCOUNTING_DB_PATH: dbPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForServer(base) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {
      // The child is still booting.
    }
    await delay(50);
  }
  throw new Error("The child server did not become healthy in time.");
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(5000).then(() => child.kill("SIGKILL"))]);
  if (child.exitCode === null) await once(child, "exit");
}

function jsonRequest(base, pathname, method, body, headers = {}) {
  return fetch(`${base}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("a real server restart preserves profile, workspace, posted entries, and balances", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ledgerline-restart-"));
  const dbPath = path.join(directory, "restart.sqlite");
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let child = startServer(port, dbPath);

  try {
    await waitForServer(base);

    const profile = await jsonRequest(base, "/api/profile", "PUT", { name: "Restart Studio" });
    assert.equal(profile.status, 200);
    const workspace = await jsonRequest(base, "/api/workspace", "PUT", {
      name: "Restart Books",
      currency: "USD",
    });
    assert.equal(workspace.status, 200);

    const created = await jsonRequest(
      base,
      "/api/entries",
      "POST",
      {
        sourceType: "CASH_RECEIPT",
        date: "2026-10-20",
        memo: "Restart receipt",
        lines: [
          { accountId: "acct-100", debitCents: 4250, creditCents: 0 },
          { accountId: "acct-400", debitCents: 0, creditCents: 4250 },
        ],
      },
      { "Idempotency-Key": "restart-entry-1" },
    );
    assert.equal(created.status, 201);
    const entry = (await created.json()).entry;
    const posted = await jsonRequest(base, `/api/entries/${entry.id}/post`, "POST", {});
    assert.equal(posted.status, 200);

    const renamedProfile = await jsonRequest(base, "/api/profile", "PUT", {
      name: "Restart Studio Renamed",
    });
    assert.equal(renamedProfile.status, 200);
    const renamedWorkspace = await jsonRequest(base, "/api/workspace", "PUT", {
      name: "Restart Books 2026",
      currency: "USD",
    });
    assert.equal(renamedWorkspace.status, 200);

    const before = await (await fetch(`${base}/api/bootstrap`)).json();
    assert.equal(before.profile.name, "Restart Studio Renamed");
    assert.equal(before.entries[0].status, "POSTED");
    assert.equal(before.accounts.find((account) => account.code === "100").balanceCents, 4250);

    await stopServer(child);
    child = null;

    const mode = fs.statSync(dbPath).mode & 0o777;
    assert.equal(mode, 0o600, "database file should be owner-readable/writable only");

    child = startServer(port, dbPath);
    await waitForServer(base);
    const after = await (await fetch(`${base}/api/bootstrap`)).json();

    assert.equal(after.profile.name, "Restart Studio Renamed");
    assert.equal(after.workspace.name, "Restart Books 2026");
    assert.equal(after.workspace.currency, "USD");
    assert.equal(after.entries.length, 1);
    assert.equal(after.entries[0].entryNo, entry.entryNo);
    assert.equal(after.entries[0].status, "POSTED");
    assert.equal(after.accounts.find((account) => account.code === "100").balanceCents, 4250);
    assert.equal(after.trialBalance.differenceCents, 0);
    assert.equal(after.dashboard.equationDifferenceCents, 0);
  } finally {
    if (child) await stopServer(child);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
