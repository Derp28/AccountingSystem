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
import { DEFAULT_ACCOUNTS } from "../server/lib/seed-accounts.js";

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
  "public/js/views/auth.js",
  "public/js/views/reports.js",
  "server/index.js",
  "server/app.js",
  "server/db/connection.js",
  "server/db/migrations.js",
  "server/lib/errors.js",
  "server/lib/money.js",
  "server/lib/validation.js",
  "server/lib/seed-accounts.js",
  "server/middleware/security.js",
  "server/middleware/auth.js",
  "server/routes/index.js",
  "server/routes/auth.js",
  "server/routes/ledgers.js",
  "server/routes/reports.js",
  "server/routes/setup.js",
  "server/routes/accounts.js",
  "server/routes/entries.js",
  "server/routes/dashboard.js",
  "server/services/bootstrap.js",
  "server/services/setup.js",
  "server/services/accounts.js",
  "server/services/entries.js",
  "server/services/reports.js",
  "server/services/auth.js",
  "migrations/001_core.sql",
  "migrations/002_seed_accounts.sql",
  "migrations/003_account_code_ranges.sql",
  "migrations/004_sequential_seed_codes.sql",
  "migrations/005_local_auth_multi_ledger.sql",
  "migrations/006_starter_chart.sql",
  "scripts/reset-password.mjs",
  "scripts/build-demo.mjs",
  "demo/books.js",
  "demo/api.js",
  "demo/main.js",
  "demo/demo.css",
  "demo/seed.js",
  "Dockerfile",
  "docker-compose.yml",
  ".env.example",
  "README.md",
  ".github/workflows/release.yml",
  ".github/workflows/pages.yml",
  "tests/unit/money.test.js",
  "tests/unit/validation.test.js",
  "tests/integration/accounting.test.js",
  "tests/integration/http.test.js",
  "tests/integration/restart.test.js",
  "tests/integration/auth-ledgers.test.js",
  "tests/integration/reports.test.js",
  "tests/e2e/helpers.js",
  "tests/e2e/auth.spec.js",
  "tests/e2e/critical-path.spec.js",
  "tests/e2e/reports.spec.js",
  "tests/e2e/screenshots.spec.js",
  "tests/e2e/xss.spec.js",
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
  ...walk(path.join(projectDir, "demo")).filter((file) => file.endsWith(".js")),
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
const authSql = readProject("migrations/005_local_auth_multi_ledger.sql");
const starterChartSql = readProject("migrations/006_starter_chart.sql");

// ---------------------------------------------------------------------------
// Starter Chart of Accounts: the same chart seeds new ledgers and upgrades the
// seeded ledger that migration 006 replaces while it still has no entries.
// ---------------------------------------------------------------------------
const starterRanges = {
  ASSET: [100, 199],
  LIABILITY: [200, 299],
  EQUITY: [300, 399],
  REVENUE: [400, 499],
  EXPENSE: [500, 599],
};

if (DEFAULT_ACCOUNTS.length === 17) {
  pass("starter chart carries 17 accounts");
} else {
  fail(`starter chart carries ${DEFAULT_ACCOUNTS.length} accounts, expected 17`);
}

const starterOutOfRange = DEFAULT_ACCOUNTS.filter((account) => {
  const range = starterRanges[account.category];
  const value = Number(account.code);
  return !range || !/^\d{3}$/.test(account.code) || value < range[0] || value > range[1];
});
if (starterOutOfRange.length === 0) {
  pass("every starter account sits inside its category code range");
} else {
  fail(`starter accounts outside their category range: ${starterOutOfRange.map((a) => a.code).join(", ")}`);
}

const starterCodes = DEFAULT_ACCOUNTS.map((account) => account.code);
if (new Set(starterCodes).size === starterCodes.length) {
  pass("starter account codes are unique");
} else {
  fail("starter account codes contain duplicates");
}

const contraAccount = DEFAULT_ACCOUNTS.find((account) => account.code === "104");
if (contraAccount && contraAccount.category === "ASSET" && /contra asset/i.test(contraAccount.description)) {
  pass("accumulated depreciation is documented as a contra asset");
} else {
  fail("account 104 must be an ASSET whose description calls it a contra asset");
}

const chartSqlRows = [
  ...starterChartSql.matchAll(/\('(\d{3})', '((?:[^']|'')*)', '([A-Z]+)', '((?:[^']|'')*)'\)/g),
].map((match) => ({
  code: match[1],
  name: match[2].replaceAll("''", "'"),
  category: match[3],
  description: match[4].replaceAll("''", "'"),
}));

const chartDrift = DEFAULT_ACCOUNTS.filter((account) => {
  const row = chartSqlRows.find((item) => item.code === account.code);
  return (
    !row ||
    row.name !== account.name ||
    row.category !== account.category ||
    row.description !== account.description
  );
});
if (chartSqlRows.length === DEFAULT_ACCOUNTS.length && chartDrift.length === 0) {
  pass("migration 006 and the starter chart agree on every account");
} else {
  fail(
    `migration 006 drifted from the starter chart: ${
      chartDrift.map((account) => account.code).join(", ") || "row count differs"
    }`,
  );
}

if (
  /DELETE FROM accounts[\s\S]*ledger_id = 'ledger-default'/.test(starterChartSql) &&
  /NOT EXISTS \(\s*SELECT 1 FROM journal_entries WHERE ledger_id = 'ledger-default'\s*\)/.test(
    starterChartSql,
  )
) {
  pass("migration 006 replaces the seeded chart only while that ledger has no entries");
} else {
  fail("migration 006 must guard the replacement on the seeded ledger having no entries");
}
const connectionSource = readProject("server/db/connection.js");
const securitySource = readProject("server/middleware/security.js");
const authMiddleware = readProject("server/middleware/auth.js");
const authService = readProject("server/services/auth.js");
const reportsService = readProject("server/services/reports.js");
const reportsRoute = readProject("server/routes/reports.js");
const indexSource = readProject("server/index.js");
const dockerfile = readProject("Dockerfile");
const compose = readProject("docker-compose.yml");
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

if (/^\.env$/m.test(ignore) && /!\.env\.example/m.test(ignore) && /\*\.sqlite/m.test(ignore)) {
  pass(".gitignore excludes environment files and stray SQLite files while keeping .env.example");
} else {
  fail(".gitignore does not exclude environment files or stray SQLite files");
}

// ---------------------------------------------------------------------------
// Auth, multi-ledger, reports, and distribution checks.
// ---------------------------------------------------------------------------
const authTriggerCount = (authSql.match(/CREATE TRIGGER/gi) || []).length;
if (
  /CREATE TABLE users/.test(authSql) &&
  /CREATE TABLE ledgers/.test(authSql) &&
  /CREATE TABLE sessions/.test(authSql) &&
  /idx_accounts_ledger_code_unique/.test(authSql) &&
  /ADD COLUMN ledger_id/.test(authSql) &&
  /trg_single_local_user/.test(authSql) &&
  /trg_lines_account_same_ledger_insert/.test(authSql) &&
  /trg_reversal_links_same_ledger/.test(authSql) &&
  authTriggerCount >= 6
) {
  pass("migration 005 adds local users, sessions, ledgers, ledger scoping, and isolation triggers");
} else {
  fail("migration 005 is missing auth, ledger scoping, or isolation triggers");
}

if (
  /scrypt/.test(authService) &&
  /timingSafeEqual/.test(authService) &&
  /SESSION_IDLE_MS/.test(authService) &&
  /SESSION_ABSOLUTE_MS/.test(authService) &&
  /MAX_FAILED_ATTEMPTS/.test(authService) &&
  /DELETE FROM sessions WHERE user_id/.test(authService)
) {
  pass("auth service uses scrypt, constant-time comparison, session limits, lockout, and session revocation");
} else {
  fail("auth service is missing a hashing, session, or lockout safeguard");
}

if (
  /HttpOnly/.test(authMiddleware) &&
  /SameSite=Strict/.test(authMiddleware) &&
  /requireCsrf/.test(authMiddleware) &&
  /AUTH_REQUIRED/.test(authMiddleware)
) {
  pass("session cookie and CSRF middleware protect authenticated mutations");
} else {
  fail("session cookie or CSRF middleware is incomplete");
}

if (
  /getIncomeStatement/.test(reportsService) &&
  /getBalanceSheet/.test(reportsService) &&
  /source_type <> 'ADJUSTMENT'/.test(reportsService) &&
  /accumulatedEarningsCents/.test(reportsService) &&
  /trial-balance/.test(reportsRoute) &&
  /income-statement/.test(reportsRoute) &&
  /balance-sheet/.test(reportsRoute)
) {
  pass("reports service and routes implement adjusted/unadjusted trial balance, income statement, and balance sheet");
} else {
  fail("reports service or routes are incomplete");
}

if (
  /node:24/.test(dockerfile) &&
  /USER node/.test(dockerfile) &&
  /LEDGERLINE_CONTAINER/.test(dockerfile) &&
  /127\.0\.0\.1/.test(compose) &&
  /ledgerline-data/.test(compose)
) {
  pass("Docker packaging pins Node 24, drops to the node user, and publishes on host loopback only");
} else {
  fail("Docker packaging is missing a Node version, non-root user, or loopback port binding");
}

if (
  clientState.includes("api.bootstrap") &&
  readProject("public/js/router.js").includes("renderReports") &&
  readProject("public/js/router.js").includes("renderLogin") &&
  readProject("public/js/views/auth.js").includes("data-claim-form")
) {
  pass("client renders the local sign-in/claim screens and the reports view");
} else {
  fail("client auth screens or reports view are not wired into the router");
}

if (scripts["auth:reset-password"]) {
  pass("package scripts expose the offline password reset command");
} else {
  fail("package scripts are missing auth:reset-password");
}

// ---------------------------------------------------------------------------
// GitHub Pages demo: generated books, no browser storage, shared validation.
// ---------------------------------------------------------------------------
const demoSeed = (await import("../demo/seed.js")).seed;
const demoApi = readProject("demo/api.js");
const demoMain = readProject("demo/main.js");
const buildDemo = readProject("scripts/build-demo.mjs");
const pagesWorkflow = readProject(".github/workflows/pages.yml");

if (demoSeed.profile.name === "AAA Computer Services") {
  pass("demo profile is AAA Computer Services");
} else {
  fail(`demo profile is ${demoSeed.profile.name}, expected AAA Computer Services`);
}

if (demoSeed.entries.length >= 8 && demoSeed.ledgers.length >= 2 && demoSeed.accounts.length >= 10) {
  pass(
    `demo seed carries ${demoSeed.entries.length} entries, ${demoSeed.ledgers.length} ledgers, and ${demoSeed.accounts.length} accounts`,
  );
} else {
  fail("demo seed is too small to demonstrate the app; rerun npm run demo:build");
}

const unbalancedSeed = demoSeed.entries.filter(
  (entry) =>
    entry.status === "POSTED" &&
    (entryTotalDebit(entry) !== entryTotalCredit(entry) || entryTotalDebit(entry) === 0),
);
if (unbalancedSeed.length === 0) {
  pass("every posted demo entry is balanced");
} else {
  fail(`unbalanced posted demo entries: ${unbalancedSeed.map((entry) => entry.entryNo).join(", ")}`);
}

const demoPostSeed = demoSeed.entries.filter((entry) => entry.status === "DRAFT");
if (demoPostSeed.length > 0 && demoSeed.entries.some((entry) => entry.reversedBy)) {
  pass("demo seed demonstrates a draft entry and a reversal");
} else {
  fail("demo seed no longer demonstrates drafts and reversals");
}

if (demoApi.includes('"../server/lib/validation.js"') && buildDemo.includes('"validation.js"')) {
  pass("demo posting rules import the server's own validation module");
} else {
  fail("demo api must import ../server/lib/validation.js so posting rules cannot drift");
}

const demoStorageHits = [demoApi, demoMain].filter((source) =>
  /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/.test(source),
);
if (demoStorageHits.length === 0) {
  pass("demo keeps state in memory only (no browser storage APIs)");
} else {
  fail("demo references browser storage; the demo must reset on reload");
}

if (
  /scripts\/build-demo\.mjs/.test(pagesWorkflow) &&
  /HEAD:gh-pages/.test(pagesWorkflow) &&
  /path:\s*docs|cd docs/.test(pagesWorkflow)
) {
  pass("Pages workflow builds the demo and publishes docs/ to the gh-pages branch");
} else {
  fail("Pages workflow does not build scripts/build-demo.mjs or publish docs/ to gh-pages");
}

if (scripts["demo:build"]) {
  pass("package scripts expose demo:build");
} else {
  fail("package scripts are missing demo:build");
}

console.log("Ledgerline local accounting app static, schema, and data checks");
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
