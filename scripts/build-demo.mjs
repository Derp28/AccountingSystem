import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, closeDatabase } from "../server/db/connection.js";
import { runMigrations } from "../server/db/migrations.js";
import {
  claimLocalAccount,
  createLedger,
  getFirstLedger,
  getLocalUser,
  listLedgers,
} from "../server/services/auth.js";
import { listAccounts } from "../server/services/accounts.js";
import { createDraft, listEntries, postEntry, reverseEntry } from "../server/services/entries.js";
import { getProfile } from "../server/services/setup.js";
import { DEFAULT_ACCOUNTS } from "../server/lib/seed-accounts.js";

/**
 * Build the static demo published to GitHub Pages.
 *
 * Step 1 replays a realistic set of books through the real services and a real
 * SQLite database, so the demo's sample data obeys the same posting, numbering,
 * and reversal rules as the app. Step 2 copies the untouched UI to `docs/` and
 * swaps the API for the in-browser engine in `demo/`.
 *
 * GitHub Pages cannot run Express or SQLite, so `docs/` is read-only output.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const publicDir = path.join(projectRoot, "public");
const demoDir = path.join(projectRoot, "demo");
const docsDir = path.join(projectRoot, "docs");

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else fs.copyFileSync(source, target);
  }
}

// ---------------------------------------------------------------------------
// Step 1: sample books, built with the production services.
// ---------------------------------------------------------------------------
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ledgerline-demo-"));
const dbPath = path.join(tempDir, "demo.sqlite");
const db = openDatabase(dbPath);

let seed;
try {
  runMigrations(db);
  await claimLocalAccount(db, {
    displayName: "Avery Chen",
    username: "demo",
    password: "demo-only-account-password",
    ledgerName: "Studio books 2026",
    currency: "USD",
  });

  const user = getLocalUser(db);
  const main = getFirstLedger(db, user.id);
  const accounts = listAccounts(db, main.id);
  const accountId = (code) => {
    const account = accounts.find((item) => item.code === code);
    if (!account) throw new Error(`Seed account ${code} is missing.`);
    return account.id;
  };

  const draft = (input) => createDraft(db, main.id, input).entry;
  const posted = (input) => {
    const entry = draft(input);
    postEntry(db, main.id, entry.id);
    return entry;
  };

  posted({
    sourceType: "SALES_INVOICE",
    date: "2026-10-18",
    memo: "Brand identity package — Harbor & Co.",
    reference: "INV-1042",
    lines: [
      { accountId: accountId("101"), description: "Invoice total", debitCents: 480000, creditCents: 0 },
      { accountId: accountId("400"), description: "Brand identity package", debitCents: 0, creditCents: 480000 },
    ],
  });

  const misissued = posted({
    sourceType: "SALES_INVOICE",
    date: "2026-10-12",
    memo: "Website refresh — Meridian Coffee",
    reference: "INV-1038",
    lines: [
      { accountId: accountId("101"), description: "Invoice total", debitCents: 250000, creditCents: 0 },
      { accountId: accountId("400"), description: "Website refresh", debitCents: 0, creditCents: 250000 },
    ],
  });

  posted({
    sourceType: "CASH_RECEIPT",
    date: "2026-10-21",
    memo: "Payment received — Harbor & Co.",
    reference: "RCPT-2210",
    lines: [
      { accountId: accountId("100"), description: "Deposit", debitCents: 200000, creditCents: 0 },
      { accountId: accountId("101"), description: "Applied to INV-1042", debitCents: 0, creditCents: 200000 },
    ],
  });

  posted({
    sourceType: "PURCHASE_BILL",
    date: "2026-10-05",
    memo: "Adobe subscription — October",
    reference: "BILL-4471",
    lines: [
      { accountId: accountId("500"), description: "Creative Cloud", debitCents: 5500, creditCents: 0 },
      { accountId: accountId("200"), description: "Payable to Adobe", debitCents: 0, creditCents: 5500 },
    ],
  });

  posted({
    sourceType: "CASH_PAYMENT",
    date: "2026-10-15",
    memo: "Studio rent — October",
    reference: "PAY-8891",
    lines: [
      { accountId: accountId("501"), description: "October rent", debitCents: 95000, creditCents: 0 },
      { accountId: accountId("100"), description: "Bank transfer", debitCents: 0, creditCents: 95000 },
    ],
  });

  posted({
    sourceType: "ADJUSTMENT",
    date: "2026-10-19",
    memo: "Accrue October studio rent",
    adjustmentType: "ACCRUED_EXPENSE",
    adjustmentReason: "October rent was not invoiced before month end.",
    lines: [
      { accountId: accountId("501"), description: "October rent", debitCents: 95000, creditCents: 0 },
      { accountId: accountId("201"), description: "Accrued rent", debitCents: 0, creditCents: 95000 },
    ],
  });

  posted({
    sourceType: "GENERAL_JOURNAL",
    date: "2026-10-22",
    memo: "Owner contribution — camera kit",
    reference: "JE-2026-04",
    lines: [
      { accountId: accountId("103"), description: "Camera and lenses", debitCents: 180000, creditCents: 0 },
      { accountId: accountId("300"), description: "Owner contribution", debitCents: 0, creditCents: 180000 },
    ],
  });

  draft({
    sourceType: "SALES_INVOICE",
    date: "2026-10-23",
    memo: "Retainer — Northline Studio",
    reference: "INV-1046",
    lines: [
      { accountId: accountId("101"), description: "November retainer", debitCents: 150000, creditCents: 0 },
      { accountId: accountId("400"), description: "Monthly retainer", debitCents: 0, creditCents: 150000 },
    ],
  });

  reverseEntry(db, main.id, misissued.id, {
    reason: "Invoice was issued to the wrong client; reissued under INV-1042.",
  });

  const side = createLedger(
    db,
    { user: { id: user.id }, ledger: main },
    { name: "Side projects", currency: "USD" },
  );

  seed = {
    profile: getProfile(db, user.id),
    ledgers: listLedgers(db, user.id),
    activeLedgerId: main.id,
    accounts: [...listAccounts(db, main.id), ...listAccounts(db, side.id)],
    entries: [...listEntries(db, main.id), ...listEntries(db, side.id)],
    nextEntryNumber: Number(
      db.prepare("SELECT next_value FROM number_sequences WHERE name = 'entry'").get().next_value,
    ),
    defaultAccounts: DEFAULT_ACCOUNTS,
  };
} finally {
  closeDatabase(db);
  fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}

fs.writeFileSync(
  path.join(demoDir, "seed.js"),
  `// Generated by scripts/build-demo.mjs from a real SQLite database. Do not edit.\nexport const seed = ${JSON.stringify(seed, null, 2)};\n`,
);
console.log(
  `Demo books: ${seed.entries.length} entries across ${seed.ledgers.length} ledgers, ` +
    `${seed.accounts.length} accounts.`,
);

// ---------------------------------------------------------------------------
// Step 2: static site in docs/.
// ---------------------------------------------------------------------------
fs.rmSync(docsDir, { recursive: true, force: true });
copyDir(publicDir, docsDir);

for (const file of ["errors.js", "money.js", "validation.js"]) {
  fs.mkdirSync(path.join(docsDir, "server", "lib"), { recursive: true });
  fs.copyFileSync(
    path.join(projectRoot, "server", "lib", file),
    path.join(docsDir, "server", "lib", file),
  );
}

// Only the demo assets are copied; seed.js is written above, before the copy.
copyDir(demoDir, path.join(docsDir, "demo"));

// The demo keeps the real UI, but any sentence that claims SQLite persistence or
// a machine-local password would be a lie in a browser tab. Rewrite just those
// sentences and fail loudly if the source wording ever changes.
const DEMO_TEXT = [
  [
    "js/router.js",
    "<p><strong>Saved locally and locked.</strong> Changes are written to <code>data/accounting.sqlite</code> on this machine. The session locks after 30 idle minutes.</p>",
    "<p><strong>Interactive demo.</strong> Changes stay in this browser tab and disappear on reload. The shipped app writes to <code>data/accounting.sqlite</code> on your machine and locks the session after 30 idle minutes.</p>",
  ],
  [
    "js/components/nav.js",
    "Local mode. Data is stored in SQLite, posted entries are immutable, and the session locks after 30 idle minutes.",
    "Demo mode. Data lives in this browser tab, posted entries are immutable, and a reload restores the sample books.",
  ],
  [
    "js/components/entry-form.js",
    "<strong>Saved locally.</strong> Saving writes a draft to the SQLite database on this machine. Posting is a separate step from the entry view and is validated on the server.",
    "<strong>Demo draft.</strong> Saving keeps the draft in this browser tab; the shipped app writes it to SQLite. Posting is a separate, fully validated step.",
  ],
  [
    "js/components/setup.js",
    "<strong>Saved locally.</strong> Changes are written to the SQLite database and kept after restart.",
    "<strong>Demo settings.</strong> Changes apply to this browser tab only; the shipped app keeps them after restart.",
  ],
  ["js/components/setup.js", '"Stored in the local database."', '"Stored in this demo tab."'],
  [
    "js/views/accounts.js",
    "Accounts are stored in the local database.",
    "Accounts are stored in this demo tab.",
  ],
  [
    "js/views/adjustments.js",
    "drafts and postings are stored in the local database.",
    "drafts and postings are stored in this demo tab.",
  ],
  [
    "js/components/entry-detail.js",
    '"Draft entries are saved locally and remain editable until posting."',
    '"Draft entries are kept in this demo tab and remain editable until posting."',
  ],
  [
    "js/app.js",
    "Nothing is deleted. Drafts, posted entries, and reversals stay exactly as they are stored on this machine.",
    "Nothing is deleted. Drafts, posted entries, and reversals stay exactly as they are in this demo tab.",
  ],
  [
    "js/views/auth.js",
    '<p class="welcome-sub">Use the local account created on this machine.</p>',
    '<p class="welcome-sub">Demo mode: the username is <strong>demo</strong> and any password works.</p>',
  ],
  [
    "js/views/auth.js",
    "<strong>Forgot the password?</strong> Run",
    "<strong>Demo mode.</strong> The shipped app hashes the password with scrypt and resets it offline; nothing is checked here. Run",
  ],
  [
    "js/views/auth.js",
    "</code> on this machine.",
    "</code> on the machine that runs the app.",
  ],
  ["js/app.js", 'eyebrow: "Local database",', 'eyebrow: "Demo data",'],
  [
    "js/app.js",
    "This re-reads the local account, ledgers, accounts, and entries from the SQLite file.",
    "This re-reads the sample account, ledgers, accounts, and entries held in this browser tab.",
  ],
  [
    "js/app.js",
    '"The interface now mirrors the local database."',
    '"The interface now mirrors the demo data."',
  ],
  ["js/views/dashboard.js", " in your local database.`", " in this demo tab.`"],
  [
    "js/views/dashboard.js",
    "Revenue minus expenses, calculated on the server from posted journal lines.",
    "Revenue minus expenses, calculated in your browser from posted journal lines.",
  ],
  [
    "js/views/dashboard.js",
    "Start a draft in the local database.",
    "Start a draft in the demo ledger.",
  ],
  ["js/views/journal.js", "Journal entries are read from the local database.", "Journal entries are read from the demo ledger."],
  [
    "js/views/transactions.js",
    "Creating and editing writes a draft to the local database. Posting validates and permanently records the journal entry.",
    "Creating and editing writes a demo draft. Posting validates the entry and records it for this session.",
  ],
  ["js/views/reports.js", "and are calculated on the server.", "and are calculated in your browser."],
  ["js/components/entry-detail.js", "Reload the page to re-read the local database.", "Reload the page to re-read the demo ledger."],
  [
    "js/components/entry-detail.js",
    "This permanently removes the draft from the local database.",
    "This removes the draft from this demo tab.",
  ],
  [
    "js/components/entry-detail.js",
    "The draft was removed from the local database.",
    "The draft was removed from this demo tab.",
  ],
  [
    "js/components/entry-detail.js",
    "The server revalidates balance, accounts, date, and memo.",
    "Posting revalidates balance, accounts, date, and memo.",
  ],
  ["js/components/entry-form.js", "was updated in the local database.", "was updated in this demo tab."],
  ["js/components/entry-form.js", "was written to the local database.", "was written to this demo tab."],
  ["js/views/accounts.js", "Changes are saved to the local database.", "Changes are saved to this demo tab."],
  ["js/views/accounts.js", "was updated in the local database.", "was updated in this demo tab."],
];

for (const [relative, from, to] of DEMO_TEXT) {
  const file = path.join(docsDir, relative);
  const source = fs.readFileSync(file, "utf8");
  const matches = source.split(from).length - 1;
  if (matches !== 1) {
    throw new Error(
      `Demo wording rewrite failed in ${relative} (${matches} matches): ${from.slice(0, 70)}`,
    );
  }
  fs.writeFileSync(file, source.replace(from, to));
}

fs.writeFileSync(path.join(docsDir, ".nojekyll"), "");

const indexPath = path.join(docsDir, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
if (!/href="\/css\/tokens\.css"/.test(html) || !/<script type="module" src="\/js\/app\.js"><\/script>/.test(html)) {
  throw new Error("public/index.html changed shape; update scripts/build-demo.mjs to match.");
}

html = html
  .replace('content="Ledgerline is a local-first accounting workspace backed by a local SQLite database."',
    'content="Interactive demo of Ledgerline, a local-first accounting workspace. Runs entirely in your browser."')
  .replace("<title>Ledgerline — Local accounting</title>", "<title>Ledgerline — Interactive demo</title>")
  .replace(
    '<link rel="stylesheet" href="/css/tokens.css" />',
    '<link rel="stylesheet" href="css/tokens.css" />\n    <link rel="stylesheet" href="demo/demo.css" />',
  )
  .replace('<link rel="stylesheet" href="/css/app.css" />', '<link rel="stylesheet" href="css/app.css" />')
  .replace('<script type="module" src="/js/app.js"></script>', '<script type="module" src="demo/main.js"></script>');

if (/="\/(css|js)\//.test(html)) {
  throw new Error("Demo index.html still contains root-relative asset paths.");
}

fs.writeFileSync(indexPath, html);

const files = fs.readdirSync(docsDir, { recursive: true }).length;
console.log(`Static demo written to docs/ (${files} files). Open docs/index.html or deploy docs/.`);
