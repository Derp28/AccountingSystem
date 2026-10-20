import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  SOURCE_TYPES,
  buildTrialBalance,
  categoryTotals,
  entryTotalCredit,
  entryTotalDebit,
  getAccountByCode,
  postedEntries,
  trialBalanceTotals,
} from "../public/js/accounting.js";
import { MOCK_ACCOUNTS, MOCK_ENTRIES } from "../public/js/mock-data.js";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const passes = [];

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const requiredFiles = [
  "public/index.html",
  "public/css/tokens.css",
  "public/css/app.css",
  "public/js/app.js",
  "public/js/router.js",
  "public/js/state.js",
  "public/js/api.js",
  "public/js/mock-data.js",
  "public/js/accounting.js",
  "public/js/format.js",
  "public/js/dom.js",
  "public/js/icons.js",
  "public/js/components/nav.js",
  "public/js/components/modal.js",
  "public/js/components/toast.js",
  "public/js/components/ui.js",
  "public/js/components/entry-form.js",
  "public/js/components/entry-detail.js",
  "public/js/components/setup.js",
  "public/js/views/onboarding.js",
  "public/js/views/workspace-setup.js",
  "public/js/views/dashboard.js",
  "public/js/views/accounts.js",
  "public/js/views/transactions.js",
  "public/js/views/journal.js",
  "public/js/views/adjustments.js",
  "server/index.js",
  "server/app.js",
  "server/db/connection.js",
  "server/db/migrations.js",
  "server/lib/errors.js",
  "server/lib/money.js",
  "server/lib/validation.js",
  "server/middleware/security.js",
  "server/routes/index.js",
  "server/routes/setup.js",
  "server/routes/accounts.js",
  "server/routes/entries.js",
  "server/routes/dashboard.js",
  "server/services/bootstrap.js",
  "server/services/setup.js",
  "server/services/accounts.js",
  "server/services/entries.js",
  "server/services/reports.js",
  "migrations/001_core.sql",
  "migrations/002_seed_accounts.sql",
  "migrations/003_account_code_ranges.sql",
  "migrations/004_sequential_seed_codes.sql",
  "tests/unit/money.test.js",
  "tests/unit/validation.test.js",
  "tests/integration/accounting.test.js",
  "tests/integration/http.test.js",
  "tests/integration/restart.test.js",
  "tests/e2e/critical-path.spec.js",
  "playwright.config.js",
];

for (const file of requiredFiles) {
  try {
    statSync(path.join(projectDir, file));
    pass(`exists ${file}`);
  } catch {
    fail(`missing ${file}`);
  }
}

const jsFiles = [
  ...walk(path.join(projectDir, "public", "js")),
  ...walk(path.join(projectDir, "server")),
  ...walk(path.join(projectDir, "tests")),
  ...walk(path.join(projectDir, "scripts")).filter((file) => file.endsWith(".mjs")),
];
for (const file of jsFiles) {
  const relative = path.relative(projectDir, file);
  const source = readFileSync(file, "utf8");
  const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    input: source,
    encoding: "utf8",
  });
  if (result.status === 0) pass(`syntax ${relative}`);
  else fail(`syntax ${relative}\n${result.stderr}`);

  if (
    relative.startsWith("public") &&
    /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/.test(source)
  ) {
    fail(`browser storage reference in ${relative}`);
  }

  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  for (const specifier of imports) {
    if (!specifier.startsWith(".")) continue;
    const resolved = path.resolve(path.dirname(file), specifier);
    try {
      statSync(resolved);
    } catch {
      fail(`unresolved import ${specifier} in ${relative}`);
    }
  }
}
pass(`checked ${jsFiles.length} JavaScript modules`);

// ---------------------------------------------------------------------------
// Stage 1 mock data invariants: hundreds-series COA codes and balanced entries.
// ---------------------------------------------------------------------------
const accountIds = new Set(MOCK_ACCOUNTS.map((account) => account.id));
const codes = MOCK_ACCOUNTS.map((account) => account.code);

if (codes.every((code) => /^\d{3}$/.test(code))) {
  pass(`account codes use the hundreds series (${codes.join(", ")})`);
} else {
  fail(`account codes are not all three-digit hundreds-series codes: ${codes.join(", ")}`);
}

if (new Set(codes.map((code) => code.toLowerCase())).size === codes.length) {
  pass("account codes are unique");
} else {
  fail("account codes contain duplicates");
}

const missingDefaultAccounts = Object.values(SOURCE_TYPES)
  .flatMap((source) => source.defaultLines.map((line) => line.accountCode))
  .filter((code) => !getAccountByCode(MOCK_ACCOUNTS, code));

if (missingDefaultAccounts.length === 0) {
  pass("every source-type default line resolves to an account");
} else {
  fail(`unresolved source-type default codes: ${missingDefaultAccounts.join(", ")}`);
}

const orphanLines = MOCK_ENTRIES.flatMap((entry) => entry.lines || []).filter(
  (line) => !accountIds.has(line.accountId),
);

if (orphanLines.length === 0) pass("every mock journal line references an account");
else fail(`${orphanLines.length} mock journal line(s) reference a missing account`);

const unbalanced = postedEntries(MOCK_ENTRIES).filter((entry) => {
  const debit = entryTotalDebit(entry);
  const credit = entryTotalCredit(entry);
  return debit <= 0 || debit !== credit;
});

if (unbalanced.length === 0) pass(`all ${postedEntries(MOCK_ENTRIES).length} posted entries balance`);
else fail(`unbalanced posted entries: ${unbalanced.map((entry) => entry.entryNo).join(", ")}`);

const trialRows = buildTrialBalance(MOCK_ACCOUNTS, MOCK_ENTRIES, { includeZero: true });
const trialTotals = trialBalanceTotals(trialRows);
if (trialTotals.debit === trialTotals.credit) {
  pass(`trial balance agrees at ${trialTotals.debit} cents`);
} else {
  fail(`trial balance is out by ${trialTotals.debit - trialTotals.credit} cents`);
}

const totals = categoryTotals(MOCK_ACCOUNTS, MOCK_ENTRIES);
if (totals.equationDifference === 0) {
  pass("accounting equation balances in the mock data");
} else {
  fail(`accounting equation is out by ${totals.equationDifference} cents`);
}

const html = readFileSync(path.join(projectDir, "public", "index.html"), "utf8");
if (/<script[^>]+type="module"[^>]+src="\/js\/app\.js"/.test(html)) pass("index.html loads app module");
else fail("index.html does not load /js/app.js as a module");
if (/<a[^>]+href="#main-content"/.test(html)) pass("skip link present");
else fail("skip link missing");
if (/(src|href)="https?:\/\//.test(html)) fail("index.html references an external asset");
else pass("no external assets in index.html");
if (/\son[a-z]+\s*=/i.test(html)) fail("inline event handler in index.html");
else pass("no inline event handlers in index.html");

for (const cssFile of ["public/css/tokens.css", "public/css/app.css"]) {
  const css = readFileSync(path.join(projectDir, cssFile), "utf8");
  const opens = (css.match(/\{/g) || []).length;
  const closes = (css.match(/\}/g) || []).length;
  if (opens === closes) pass(`balanced braces ${cssFile} (${opens})`);
  else fail(`unbalanced braces ${cssFile}: ${opens} open, ${closes} close`);
}

// ---------------------------------------------------------------------------
// Stage 2 schema, service, API, and security checks.
// ---------------------------------------------------------------------------
const readProject = (file) => readFileSync(path.join(projectDir, file), "utf8");
const serverSources = walk(path.join(projectDir, "server")).map((file) => ({
  relative: path.relative(projectDir, file),
  source: readFileSync(file, "utf8"),
}));

const coreSql = readProject("migrations/001_core.sql");
const seedSql = readProject("migrations/002_seed_accounts.sql");
const accountRangeSql = readProject("migrations/003_account_code_ranges.sql");
const sequentialSeedSql = readProject("migrations/004_sequential_seed_codes.sql");
const connectionSource = readProject("server/db/connection.js");
const securitySource = readProject("server/middleware/security.js");
const indexSource = readProject("server/index.js");
const clientState = readProject("public/js/state.js");
const clientApi = readProject("public/js/api.js");
const packageJson = JSON.parse(readProject("package.json"));
const ignore = readProject(".gitignore");

const triggerCount = (coreSql.match(/CREATE TRIGGER/gi) || []).length;
if (triggerCount >= 8) pass(`schema defines ${triggerCount} immutability/posting triggers`);
else fail(`schema defines only ${triggerCount} triggers`);

if (/\bREAL\b/i.test(coreSql)) fail("schema contains a REAL column or value");
else pass("schema contains no REAL money type");

if (
  /debit_cents\s+INTEGER/.test(coreSql) &&
  /credit_cents\s+INTEGER/.test(coreSql) &&
  /typeof\(debit_cents\)\s*=\s*'integer'/.test(coreSql) &&
  /typeof\(credit_cents\)\s*=\s*'integer'/.test(coreSql)
) {
  pass("journal money columns are integer cents with type checks");
} else {
  fail("journal money columns are not guarded integer cents");
}

if (
  /CREATE UNIQUE INDEX idx_entries_client_request/.test(coreSql) &&
  /CREATE UNIQUE INDEX idx_entries_reversal_of/.test(coreSql)
) {
  pass("client request IDs and reversal targets are unique");
} else {
  fail("missing unique request/reversal indexes");
}

if (
  /posted entry is immutable/.test(coreSql) &&
  /posting requires balanced debits and credits/.test(coreSql) &&
  /invalid reversal target/.test(coreSql)
) {
  pass("database triggers enforce immutability, balance, and reversal integrity");
} else {
  fail("database trigger invariants are incomplete");
}

if (
  /accounts_code_range_insert/.test(accountRangeSql) &&
  /accounts_code_range_update/.test(accountRangeSql) &&
  /outside its category hundred series/.test(accountRangeSql)
) {
  pass("database triggers enforce category account-code ranges");
} else {
  fail("account-code range triggers are incomplete");
}

const seedCodes = ["100", "101", "102", "103", "200", "201", "300", "400", "500", "501"];
const finalSeedSql = `${seedSql}\n${sequentialSeedSql}`;
const missingSeedCodes = seedCodes.filter(
  (code) => !new RegExp(`'${code}'`).test(finalSeedSql),
);
if (missingSeedCodes.length === 0) {
  pass("seed migrations contain the per-category sequential codes");
} else {
  fail(`seed migrations are missing codes: ${missingSeedCodes.join(", ")}`);
}

if (
  /BEGIN IMMEDIATE/.test(connectionSource) &&
  /PRAGMA foreign_keys = ON/.test(connectionSource) &&
  /PRAGMA journal_mode = WAL/.test(connectionSource) &&
  /busy_timeout/.test(connectionSource) &&
  /chmodSync\(filePath, 0o600\)/.test(connectionSource)
) {
  pass("connection uses WAL, foreign keys, busy timeout, immediate transactions, and 0600 permissions");
} else {
  fail("connection pragmas or database permissions are incomplete");
}

if (
  /Content-Security-Policy/.test(securitySource) &&
  /script-src 'self'/.test(securitySource) &&
  /frame-ancestors 'none'/.test(securitySource) &&
  /parsed\.host !== host/.test(securitySource) &&
  /Cross-origin mutations are not allowed/.test(securitySource) &&
  /Send mutations as JSON/.test(securitySource)
) {
  pass("security middleware sets CSP/frame headers and checks origin/content type");
} else {
  fail("security middleware is missing a header or origin/content-type check");
}

if (
  /process\.env\.HOST \|\| "127\.0\.0\.1"/.test(indexSource) &&
  /Refusing to start/.test(indexSource) &&
  /ACCOUNTING_DB_PATH/.test(indexSource)
) {
  pass("server defaults to loopback and refuses non-loopback binding");
} else {
  fail("server binding or database path configuration is unsafe");
}

const unsafeSqlConstruction = serverSources.filter(({ source }) =>
  /db\.(?:exec|prepare)\(\s*`[^`]*\$\{/s.test(source),
);
if (unsafeSqlConstruction.length === 0) pass("no interpolated SQL in db.exec/db.prepare calls");
else fail(`interpolated SQL in ${unsafeSqlConstruction.map((item) => item.relative).join(", ")}`);

const dynamicCode = [...serverSources, { relative: "public/js", source: clientState + clientApi }].filter(
  ({ source }) => /\beval\s*\(|new\s+Function\s*\(/.test(source),
);
if (dynamicCode.length === 0) pass("no eval or new Function in server/client code");
else fail(`dynamic code in ${dynamicCode.map((item) => item.relative).join(", ")}`);

const routeSource = serverSources.map((item) => item.source).join("\n");
const routeRequirements = [
  "/bootstrap",
  "/accounts",
  "/entries",
  "/dashboard",
  "/:id/post",
  "/:id/reverse",
];
const missingRoutes = routeRequirements.filter((route) => !routeSource.includes(route));
if (missingRoutes.length === 0) pass("all planned API routes are registered");
else fail(`missing API routes: ${missingRoutes.join(", ")}`);

if (
  clientState.includes("api.bootstrap") &&
  !clientState.includes("cloneMockData") &&
  clientApi.includes("/api/")
) {
  pass("client state is API-backed and no longer clones mock data");
} else {
  fail("client state still uses mock data or does not call the API");
}

const scripts = packageJson.scripts || {};
if (["dev", "start", "check", "test", "test:e2e"].every((name) => scripts[name])) {
  pass("package scripts expose dev, start, check, unit/integration, and e2e commands");
} else {
  fail("package scripts are incomplete");
}

if (/^data\/$/m.test(ignore) && /node_modules\//.test(ignore)) {
  pass(".gitignore excludes the local database directory and node_modules");
} else {
  fail(".gitignore does not exclude data/ and node_modules/");
}

console.log("Ledgerline Stage 2 static, schema, and data checks");
console.log("-------------------------------------------------");
for (const message of passes) console.log(`PASS  ${message}`);
if (failures.length > 0) {
  console.log("");
  for (const message of failures) console.log(`FAIL  ${message}`);
  console.log(`\n${failures.length} check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${passes.length} checks passed.`);
}
