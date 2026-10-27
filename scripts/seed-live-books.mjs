import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, openDatabase } from "../server/db/connection.js";
import { runMigrations } from "../server/db/migrations.js";
import { getFirstLedger, getLocalUser } from "../server/services/auth.js";
import { listAccounts } from "../server/services/accounts.js";
import { createDraft, listEntries, postEntry } from "../server/services/entries.js";
import { getBalanceSheet, getIncomeStatement, getTrialBalance } from "../server/services/reports.js";
import { formatCents } from "../server/lib/money.js";
import { demoBooks } from "../demo/books.js";

/**
 * Post the sample books (demo/books.js) into the live database.
 *
 * This writes through the same services the HTTP API uses, so numbering,
 * balance validation, and the immutability triggers all apply. It refuses to
 * run when the first ledger already holds entries: posted entries cannot be
 * deleted, so a reset is a restore-from-backup decision, not a script flag.
 *
 * Stop the server before running it (`npm run books:sample`) so the file copy
 * in data/backups/ is consistent, then start it again.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

const configuredPath = process.env.ACCOUNTING_DB_PATH || path.join("data", "accounting.sqlite");
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.resolve(projectRoot, configuredPath);

if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Start the app once and create the local account first.`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
const backupDir = path.join(projectRoot, "data", "backups", `pre-sample-books-${stamp}`);
fs.mkdirSync(backupDir, { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) {
  const source = dbPath + suffix;
  if (!fs.existsSync(source)) continue;
  fs.copyFileSync(source, path.join(backupDir, path.basename(dbPath) + suffix));
}
console.log(`Backed up the database to ${path.relative(projectRoot, backupDir)}`);

const db = openDatabase(dbPath);
let failure = null;

try {
  runMigrations(db);

  const user = getLocalUser(db);
  if (!user) {
    console.error("No local account exists yet. Start the app, create the account, then rerun.");
    process.exitCode = 1;
  } else {
    const ledger = getFirstLedger(db, user.id);
    if (!ledger) {
      console.error("No ledger exists for the local account.");
      process.exitCode = 1;
    } else {
      const existing = listEntries(db, ledger.id);
      if (existing.length > 0) {
        console.error(
          `Ledger "${ledger.name}" already holds ${existing.length} entries. ` +
            "Posted entries are immutable, so this script will not delete them. " +
            "Restore a backup instead.",
        );
        process.exitCode = 1;
      } else {
        const accounts = listAccounts(db, ledger.id);
        const accountId = (code) => {
          const account = accounts.find((item) => item.code === code);
          if (!account) throw new Error(`Sample account ${code} is missing from "${ledger.name}".`);
          return account.id;
        };

        let posted = 0;
        for (const item of demoBooks.entries) {
          const draft = createDraft(db, ledger.id, {
            sourceType: item.sourceType,
            date: item.date,
            memo: item.memo,
            reference: item.reference ?? null,
            adjustmentType: item.adjustmentType ?? null,
            adjustmentReason: item.adjustmentReason ?? null,
            lines: item.lines.map((line) => ({
              accountId: accountId(line.code),
              description: line.description,
              debit: line.debit ?? "0",
              credit: line.credit ?? "0",
            })),
          }).entry;
          if (item.status === "DRAFT") continue;
          postEntry(db, ledger.id, draft.id);
          posted += 1;
        }

        const entries = listEntries(db, ledger.id);
        const trial = getTrialBalance(db, ledger.id);
        const income = getIncomeStatement(db, ledger.id, {
          from: "2023-01-01",
          to: "2023-12-31",
        });
        const balance = getBalanceSheet(db, ledger.id, { asOf: "2023-12-31" });

        console.log(`Ledger: ${ledger.name} (${ledger.currency})`);
        console.log(
          `Posted ${posted} of ${demoBooks.entries.length} sample entries; ledger now holds ${entries.length}.`,
        );
        console.log(
          `Trial balance: debit ${formatCents(trial.totalDebitCents)} credit ${formatCents(trial.totalCreditCents)} ` +
            `(difference ${formatCents(trial.differenceCents)})`,
        );
        console.log(
          `Income statement: revenue ${formatCents(income.totalRevenueCents)} ` +
            `expenses ${formatCents(income.totalExpensesCents)} net ${formatCents(income.netIncomeCents)}`,
        );
        console.log(
          `Balance sheet: assets ${formatCents(balance.totalAssetsCents)} ` +
            `liabilities ${formatCents(balance.totalLiabilitiesCents)} ` +
            `equity ${formatCents(balance.totalEquityCents)} ` +
            `(difference ${formatCents(balance.differenceCents)})`,
        );
      }
    }
  }
} catch (error) {
  failure = error;
} finally {
  closeDatabase(db);
}

if (failure) {
  console.error(failure.message);
  process.exitCode = 1;
}
