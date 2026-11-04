# TEST_PLAN.md — Risk-based verification and evidence

## Scope

Stage 3 verifies the local Express + SQLite implementation of the approved Ledgerline UI plus local username/password access, multiple ledgers, and the adjusted/unadjusted financial statements: Statement of Comprehensive Income (SOCI), Statement of Owner's Equity (SOE), Statement of Financial Position (SOFP), Statement of Cash Flows (SOCF), and the supporting trial balance. It covers persistence, migrations, posting, immutability, reversal, duplicate/partial-write prevention, transaction-to-journal consistency, security controls, sessions and CSRF, ledger isolation, the statements and their reconciliation, print/PDF output, and the critical browser path. The public demo's simulated PDF preview is also verified. Stage 1 was a UI-only prototype and is recorded separately. Evidence for the approved Stage 2 core remains valid.

Period close, exports, automated adjustment schedules, tax/VAT/statutory logic, multi-currency conversion, and automated backup are out of scope and are not claimed.

## Environment

- Windows Node 24 in this folder (no WSL/NVM dependency)
- Project: `C:\Users\Chaz Vincent Aurin\Downloads\koreanbananachicken\I FUCKED UP FOLDER\accounting-app`
- App: `http://127.0.0.1:3000`, database `data/accounting.sqlite` (schema 7)
- E2E: `http://127.0.0.1:3100`, database `data/e2e.sqlite`
- Browser: Playwright Chromium; `npm run test:e2e` launches `scripts/test-e2e.mjs` and `scripts/e2e-server.mjs`
- SQLite: Node built-in `node:sqlite`
- Date of the latest local evidence run: 2026-11-04; deployed-site check: 2026-11-04

## Commands

```powershell
npm start                     # start the app on 127.0.0.1:3000
npm run check                 # static, schema, API, security, auth, reports, print, demo, distribution checks
npm test                      # unit + integration tests, including restart
npm run test:e2e              # Playwright auth, critical path, reports, print/PDF, mobile, XSS, screenshots
npm audit                     # dependency audit
npm run auth:reset-password -- <username>   # offline password reset (revokes sessions)
npm run demo:build            # rebuild the static GitHub Pages demo into docs/
```

## Risk matrix

| Risk | Priority | Verification |
|---|---|---|
| Onboarding bypass or lost profile | High | E2E onboarding; integration reopen/restart; singleton constraints |
| Unbalanced entry posted | High | API rejection; balance trigger; rollback test; E2E unbalanced UI block |
| Posted entry edited/deleted silently | High | API guards; database triggers; immutability tests; view/reverse-only UI |
| Duplicate or partial posting | High | Unique request IDs; `BEGIN IMMEDIATE`; duplicate and rollback tests |
| Reversal invalid or repeated | High | One-reversal link, posted-target check, no reversal-of-reversal, net-zero test |
| Money rounding or float drift | High | Integer cents, exact decimal parser, DB type checks, unit/HTTP tests |
| Drafts affect balances | High | Draft exclusion test; SQL aggregation uses `POSTED` only |
| Transaction/journal divergence | High | One entry per source transaction; shared bootstrap/journal views; E2E cross-check |
| Dashboard/trial balance drift | High | Derived SQL totals; equation check; E2E trial balance |
| SQL injection | High | Prepared statements; metacharacter test; static interpolation check |
| XSS | High | Escaped rendering; CSP; browser XSS test with script/img/svg payloads |
| Unauthorized remote mutation | High | Loopback binding; Host/Origin checks; JSON-only test |
| Unauthorized local access | High | scrypt password check; 401/403 HTTP tests; E2E claim/sign-in/lock |
| Stolen session or CSRF | High | Server-side sessions; HttpOnly/SameSite cookie; CSRF header test; idle/absolute expiry |
| Brute-force sign-in | Medium | Five-failure lockout test; generic credential errors |
| Cross-ledger data leak | High | Ledger-scoped queries/indexes; isolation triggers; integration isolation test |
| Wrong adjusted/unadjusted totals | High | Server integer-cent calculation; basis filter; integration invariant tests; E2E basis toggle |
| Unbalanced balance sheet | High | Server balance check; integration test over both bases |
| Owner's equity does not roll forward | High | SOE integration test checks beginning capital, investments, net income, withdrawals, ending capital, and balance-sheet tie; E2E asserts the ending capital |
| Cash-flow statement misclassifies or fails to reconcile | High | Per-account cash-flow class; integration tests for operating/investing/financing, non-cash exclusion, cash transfers, both bases, and ending cash vs Cash balance; E2E asserts section totals |
| PDF claim is misleading or print output leaks chrome | Medium | Live app uses the browser print dialog with print-only CSS; E2E generates a real `%PDF-` file and checks the letterhead/hidden chrome. Demo uses an explicitly simulated preview with a disabled save button and no file |
| Personal data shipped in a copy | High | `data/`/`.env` ignored and excluded from the image; fresh empty database per copy |
| Database file exposed | Medium | `0600` mode test; path not returned by API |
| Restart loses data | High | Child-process stop/start test against one database file |
| Migration replay corrupts data | High | Idempotency test on an already migrated database |
| Mobile navigation broken | Medium | 390 px drawer/Escape/focus test; overflow assertion |
| Responsive layout broken | Medium | Screenshots at 1440/768/390 px |
| Console errors | Medium | `pageerror` collection in E2E |
| Dependency vulnerability | Medium | `npm audit` recorded |

## Test inventory and results

### Static, schema, and regression checks

Command: `node scripts/check.mjs`

Result: **232 passed, 0 failed.** Covers required files, syntax/import resolution, absence of browser storage, Stage 1 accounting fixtures, migration invariants, integer-cent columns, trigger count and messages, account-code range triggers, per-category sequential seed codes, WAL/foreign-key/busy-timeout/`BEGIN IMMEDIATE`, database permissions, loopback refusal, CSP and security middleware, API route registration, prepared-SQL checks, no `eval`, client API usage, package scripts, and `.gitignore`. Stage 3 additions assert migration 005's auth/ledger schema and isolation triggers, the scrypt/session/lockout safeguards, the cookie and CSRF middleware, the three original report routes and adjusted-basis filter, migration 007's cash-flow classes, owner's equity and cash-flow routes/services, the SOCI/SOE/SOFP/SOCF/TB tabs and tooltips, print/PDF CSS, the demo's simulated preview and sample-period defaults, the Docker loopback/boundary settings, and that `data/`/`.env` stay ignored while `.env.example` is kept.

### Unit and integration tests

Command: `npm test`

Result: **41 tests, 41 passed, 0 failed** (10 unit + 31 integration).

Unit coverage:

- Exact two-decimal parsing, rejection of >2 places/negatives, integer-cent bounds, cents-first fallback.
- Strict ISO date validation.
- Profile/workspace required names, length limits, and currency normalization.
- Account normalization and required fields.
- Account codes are three-digit numbers inside the category hundred series, with field-specific range errors.
- Unbalanced, inactive-account, and two-sided-line posting validation.
- Adjustment type/reason requirements.

Integration coverage:

- Migration idempotency and schema version.
- Account-code range triggers reject out-of-range direct database writes and category changes.
- Profile/workspace persistence across reopening the database.
- Drafts excluded from balances.
- Unbalanced posting rejected atomically with the draft unchanged.
- Posted-entry and line immutability through API and database.
- Reversal link, reason, one-reversal rule, no reversal-of-reversal, net-zero totals.
- Duplicate draft creation and duplicate posting without duplicate rows.
- Optimistic-concurrency conflict on stale draft updates.
- Inactive account blocks new drafts and posting while preserving history; reversal of an affected posted entry remains possible.
- Adjustment type/reason enforcement and category totals/equation.
- Integer-cent DB checks reject non-integer values.
- Server-generated source-prefixed unique entry numbers.
- HTTP health/bootstrap and seeded per-category sequential accounts (100–103, 200–201, 300, 400, 500–501).
- Profile/workspace/account CRUD round-trip.
- Full draft → post → reverse HTTP lifecycle.
- Exact decimal API conversion and excess-precision rejection.
- Bad Origin, wrong content type, malformed JSON, and oversized payload rejection.
- SQL metacharacters and markup stored as inert data.
- **Actual server process restart**: stop the child server, restart against the same SQLite file, and verify the local account, ledger, posted entry, balances, trial balance, and equation; the stored session survives and a fresh sign-in also works.
- Stage 3 claim: creates the local account, ledger, and session; a second claim is rejected; the session resolves.
- Stage 3 login: verifies the password, rejects four wrong attempts with 401, locks on the fifth with 429, and a reset changes the password and revokes sessions.
- Stage 3 ledger isolation: a new ledger gets its own seeded chart; the same account code is allowed in two ledgers; entries and reports do not leak across ledgers; cross-ledger account references are rejected.
- Stage 3 reports: adjusted trial balance includes the adjustment, unadjusted excludes it and the linked reversal; income statement period totals and net income; balance sheet balances on both bases with computed accumulated earnings; invalid basis and reversed date ranges are rejected.
- Stage 3 owner's equity: beginning capital, additional investments, period net income, withdrawals, and ending capital roll forward; ending capital equals the balance sheet's total equity; a later period carries the prior ending capital forward; the unadjusted basis excludes the adjustment.
- Stage 3 cash flows: posted cash lines classify into operating, investing, and financing by the counter-account's class; non-cash entries are excluded; a transfer between two cash accounts is excluded; operating + investing + financing equals the change in Cash; beginning cash + net change = ending cash; both bases are covered.
- Stage 3 cash-flow class persistence: account create/update round-trips the class; unknown classes are rejected; CASH is limited to asset accounts; equity defaults to FINANCING and other new accounts default to OPERATING; database CHECK rejects invalid values.

### Browser end-to-end tests

Command: `npm run test:e2e`

Result: **9 tests, 9 passed, 0 failed.**

1. First run: the claim screen fits a 390 px viewport; short password, mismatched confirmation, and empty ledger name each produce inline errors; valid input creates the account and opens the dashboard.
2. Lock and sign-in: "Lock now" shows the sign-in screen (not first-run setup), a wrong password shows a generic error, and the correct password returns to the dashboard.
3. Ledgers: a second ledger is created, becomes active with its own seeded Chart of Accounts, and the sidebar switches back to the first ledger.
4. Critical path: seeded COA → add account (asserting prefilled next codes `104` and `502`, then rejecting an out-of-range code) → sale draft → post → journal → adjustment draft/post → reversal → reload → dashboard trial balance/equation.
5. Profile/ledger rename through settings → reload → renamed values persist.
6. Mobile navigation: 390 px drawer, Escape close, no page-level horizontal overflow.
7. Reports: five abbreviated tabs (SOCI, SOE, SOFP, SOCF, TB) with full names in `aria-label`/`data-tooltip` and a visible hover tooltip; adjusted/unadjusted trial balance; SOCI net income 3,500; SOE ending capital 13,200; SOFP total liabilities + equity 14,200; SOCF operating 2,500, investing (4,000), financing 9,700, net change and ending cash 8,200; print media hides the sidebar and shows the letterhead; `Print / Save as PDF` calls the browser print dialog; `page.pdf()` produces a real `%PDF-` buffer; Print all creates a four-statement sheet. Test data is posted through the API for June 2026.
8. Screenshot capture at 1440×900, 768×1024, and 390×844 for Dashboard, Chart of Accounts, Business Transactions, General Journal, Adjustments, and Reports.
9. XSS: user markup in account name/description renders as text; no script/img/svg execution; no page errors.

### Dependency audit

Command: `npm audit`

Result: **0 vulnerabilities** across runtime and dev dependencies.

Command: `npm ls --depth=0`

Result: `express@5.3.0`, `@playwright/test@1.64.1`.

### Screenshot evidence

Directory: `screenshots/`

- `dashboard-1440.png`, `accounts-1440.png`, `transactions-1440.png`, `journal-1440.png`, `adjustments-1440.png`, `reports-1440.png`
- `dashboard-768.png`, `accounts-768.png`, `transactions-768.png`, `journal-768.png`, `adjustments-768.png`, `reports-768.png`
- `dashboard-390.png`, `accounts-390.png`, `transactions-390.png`, `journal-390.png`, `adjustments-390.png`, `reports-390.png`
- `mobile-navigation-390.png`
- `setup-1440.png`, `setup-390.png` (superseded by the Stage 3 claim screen)
- The 2026-11-04 screenshots were regenerated after the page-header and Chart of Accounts cleanups; each page header starts with the page title, and the accounts table shows Code, Account, Status, and Actions.

## Requirement-to-evidence map

| Requirement group | Evidence |
|---|---|
| ONB-001..006 (superseded) | Historical Stage 2 onboarding; replaced by AUTH/LED groups in Stage 3 |
| AUTH-001..008 | Claim/login/lock E2E; HTTP 401/403 tests; lockout and reset integration; static scrypt/session/cookie checks |
| LED-001..004 | Ledger switcher E2E; isolation and new-ledger integration; `data/`/`.env` ignore checks |
| REP-001..005 | Report integration invariants; reports E2E (basis toggle, trial balance, SOCI, SOFP); static route/basis checks |
| REP-006 | SOE service/route integration (roll-forward, balance-sheet tie, later period, unadjusted); reports E2E ending capital 13,200; static service/route/client checks |
| REP-007 | SOCF service/route integration (section classification, reconciliation, non-cash exclusion, cash transfers, both bases); reports E2E operating 2,500 / investing (4,000) / financing 9,700 / ending cash 8,200; static checks |
| REP-008 | Migration 007 CHECK and starter chart classifications; validation/account persistence integration and unit tests; account-form browser check; static checks |
| REP-009 | Reports E2E tab labels, `aria-label`/`data-tooltip`, hover tooltip, full statement headings; static tab/tooltip checks |
| REP-010 | Reports E2E stubs `window.print`, checks print-media letterhead/hidden chrome, generates a `%PDF-` file, and verifies Print all renders four statements; static print-CSS checks |
| REP-011 | Demo build + browser walkthrough of the simulated preview (disabled Save as PDF, no-file note, Preview all); static demo flag/preview checks |
| UI-001..015 | E2E auth, critical path, mobile drawer, reports, settings rename, screenshots, static checks, CSS/accessibility review |
| ACC-001..017 | Unit validation, integration lifecycle/immutability/reversal/balances/equation, E2E critical path, schema triggers |
| ACC-018 | Period close, exports, tax, multi-currency, and automated adjustments deferred; the four financial statements plus trial balance are implemented as REP-001..011 |
| ACC-019 | Cash-flow activity rules encoded in the starter chart and per-account `cash_flow_class`; SOCF integration covers operating/investing/financing and excludes non-cash movements |
| DB-001..008, DB-010..012 | Migration/schema checks, integrity tests, real restart, ledger isolation triggers, prepared-SQL check |
| DB-009 | Manual stopped-server backup documented in `PLANS.md`; automated backup deferred |
| DB-013 | Migration 005 preserves legacy data by assigning it to `ledger-default`; migrations 006/007 preserve posted history and add the starter chart/cash-flow classes; string checks plus backups of the live file |
| SEC-001..008 | Loopback checks, Origin/content-type/body-limit tests, CSRF/session tests, XSS test, SQL injection test, error hygiene review, `0600` test, CSP/static checks, `npm audit` |
| DIST-001..003 | Docker/compose/.env.example/README static checks; `data/` and `.env` excluded from git and the image |
| QA-001..014 | Traceability self-audit, 232 static checks, 41 backend tests, 9 E2E tests, restart, screenshots, exact evidence in this file |

This mapping is a **self-audit** by the implementing agent; no independent external audit is claimed.

## Evidence log

| Date | Command / check | Result | Evidence |
|---|---|---|---|
| 2026-10-20 | Stage 1 `node scripts/check.mjs` | PASS, 59 checks | Stage 1 approval; superseded by Stage 2 checks |
| 2026-10-20 | User UI approval | PASS | `UI_REVIEW.md` |
| 2026-10-20 | User Stage 2 UI approval | PASS | `UI_REVIEW.md` Stage 2 approval record |
| 2026-10-20 | D-016, D-018, D-019 policy confirmation | PASS | `DECISIONS.md`; D-018 enforced by API, UI, and migration 003 |
| 2026-10-20 | `node scripts/check.mjs` | PASS, 138/138 | Terminal output; check summary |
| 2026-10-20 | `bash scripts/test.sh` | PASS, 30/30 | Unit + integration output; restart test |
| 2026-10-20 | `bash scripts/test-e2e.sh` | PASS, 5/5 | Playwright output |
| 2026-10-20 | `npm audit` | PASS, 0 vulnerabilities | Terminal output |
| 2026-10-20 | Screenshot capture | PASS, 18 PNGs | `screenshots/` |
| 2026-10-20 | Post-signoff sequential account-code change (D-021, migration 004) | PASS | Live database migrated to schema 4; 138/138 static, 30/30 backend, 5/5 Playwright; profile/workspace/seed accounts preserved |
| 2026-10-20 | Final product signoff | PASS | User accepted current Stage 2 scope; `TASKS.yaml` Gate 3 |
| 2026-10-21 | Live database pre-migration backup | PASS | `data/backups/pre-005-20261021/` contains `accounting.sqlite` and its WAL/SHM sidecars |
| 2026-10-21 | `node scripts/check.mjs` | PASS, 182/182 | Terminal output; auth, ledger, report, and distribution checks |
| 2026-10-21 | `bash scripts/test.sh` | PASS, 38/38 | Unit + integration output; includes auth/ledger/report suites and the restart test |
| 2026-10-21 | `bash scripts/test-e2e.sh` | PASS, 9/9 | Playwright output; auth, critical path, reports, mobile, XSS, screenshots |
| 2026-10-21 | `npm run auth:reset-password` (offline) | PASS | Reset succeeds and revokes sessions; unknown username exits non-zero (verified against a temporary database) |
| 2026-10-21 | `npm audit` | PASS, 0 vulnerabilities | Terminal output |
| 2026-10-21 | `git check-ignore` | PASS | `data/accounting.sqlite`, `data/e2e.sqlite`, and `.env` are ignored |
| 2026-10-24 | `npm run check` (Windows Node 24.15.0, this folder) | PASS, 189/189 | Localized runtime; includes syntax/import checks for the new `scripts/*.mjs` entries |
| 2026-10-24 | `npm test` (Windows Node 24.15.0, this folder) | PASS, 38/38 in 6.6 s | Unit + integration, including the real restart test; no WSL or NVM on PATH |
| 2026-10-24 | `npm run test:e2e` (Windows, Chromium 156) | PASS, 9/9 in 29.0 s | Playwright starts the server through `scripts/e2e-server.mjs` on port 3100 with `data/e2e.sqlite`; screenshots regenerated byte-identically |
| 2026-10-24 | `npx playwright install chromium` | PASS | Browser + headless shell + winldd downloaded to `%LOCALAPPDATA%\ms-playwright` |
| 2026-10-24 | `npm audit` before the patch | FAIL, 1 high | `body-parser` 2.3.0 (GHSA-27r3-jxmh-p828, DoS via trailing bytes after a compressed body), a transitive Express dependency |
| 2026-10-24 | `npm audit fix` + `npm ci` | PASS, 0 vulnerabilities | `body-parser` 2.4.0 installed inside Express's existing range; `package.json` dependency ranges unchanged |
| 2026-10-24 | `npm run check`, `npm test`, `npm run test:e2e` after the dependency patch | PASS, 189/189, 38/38, 9/9 | Re-ran the full suite on the patched dependency tree (JSON body parsing is on the critical path) |
| 2026-10-24 | Live database safety | PASS (not touched) | `data/accounting.sqlite` keeps its 2026-10-20/21 timestamps; all localized runs used `data/e2e.sqlite`, temp directories, or a disposable `data/smoke2.sqlite` that was deleted afterwards |
| 2026-10-24 | `npm run demo:build` | PASS, 43 files | Seeds a temporary SQLite database through the real services (9 entries, 2 ledgers, 20 accounts), writes `demo/seed.js`, and copies `public/` into `docs/` with `demo/main.js` as the entry point |
| 2026-10-24 | `npm run check` after the demo | PASS, 206/206 | New checks: demo files exist, `demo/*.js` parses and resolves imports, the seed has no unbalanced posted entry, the demo imports `server/lib/validation.js`, no browser-storage APIs, and the Pages workflow builds `docs/` |
| 2026-10-24 | Browser walkthrough of the built demo (`http://127.0.0.1:4173`, static `docs/`) | PASS | Dashboard totals and the balanced trial balance; trial balance, income statement, and balance sheet in both bases (unadjusted drops ADJ-000006); draft SI-000010 -> posted -> reversal JE-000011; new ledger created and switching back restores the books; lock and sign-in with any password. Zero `/api/` network requests and no application console errors |
| 2026-10-24 | `npm test` + `npm run test:e2e` after the demo | PASS, 38/38 and 9/9 | Re-ran the full suite on the same tree; no application code changed for the demo |
| 2026-10-24 | First `Demo site` workflow run (commit 6938551) | FAIL at "Configure Pages" | `actions/configure-pages` with `enablement: true` cannot create the Pages site with the default `GITHUB_TOKEN` (no repository-admin rights); the build and upload steps succeeded |
| 2026-10-24 | Push of a `gh-pages` branch with the built site | PASS, Pages enabled | `has_pages` became true after the push; GitHub enabled Pages on the branch deploy. The workflow was changed to publish `docs/` to `gh-pages` instead of `actions/deploy-pages` |
| 2026-10-24 | Live site `https://derp28.github.io/AccountingSystem/` | PASS | Served over HTTPS from the project subpath: dashboard totals, reports page, and the unadjusted basis toggle work; no console warnings; zero `/api/` network requests (the fetch shim answers everything in the page) |

| 2026-10-27 | Starter chart (D-035) | PASS, 17 accounts | Fresh disposable SQLite database: migrations plus claim produced 100 Cash through 503 Depreciation Expense - Office Equipment, every code inside the D-018 ranges, with 104 documented as a contra asset |
| 2026-10-27 | Migration 006 guard | PASS | Disposable database migrated only through 005, one posted entry added, then 006 applied: the ledger kept its original 10 accounts and ids, proving posted history is not relabelled |
| 2026-10-27 | `npm run check` after the chart change | PASS, 217/217 | Adds starter-chart checks: 17 accounts, category ranges, unique codes, contra-asset wording, migration 006 vs `DEFAULT_ACCOUNTS` agreement, and the empty-ledger guard |
| 2026-10-27 | `npm test` after the chart change | PASS, 38/38 | Fixtures and account counts realigned (17 seeded accounts, 18 after an added account); health reports schema 6 |
| 2026-10-27 | `npm run test:e2e` after the chart change | PASS, 9/9 | E2E chart assertions use the new codes; the adjustment flow uses 500 Salaries Expense and 203 Salaries Payable |
| 2026-10-27 | `npm run demo:build` after the chart change | PASS, 44 files | `demo/books.js` replayed through the real services: 16 entries, 2 ledgers, 34 accounts, profile AAA Computer Services, currency PHP |
| 2026-10-27 | Demo sample transactions | PASS, 16 entries, equation difference 0 | Owner's December 2023 set plus the six 31 December adjusting entries posted through the real services: unadjusted trial balance 118,300.00, adjusted 153,650.00; assets 128,950.00 PHP, liabilities 6,500.00, equity 122,450.00, net income 25,450.00; every entry balanced, no draft or reversal injected into the sample books |
| 2026-10-27 | `npm run books:sample` on the live database | PASS, 16 posted entries | Live `data/accounting.sqlite` backed up to `data/backups/pre-sample-books-20261027T034332/`, then the sample books posted through the real services: one ledger (General Ledger for 2023, PHP), 17 accounts, 16 posted entries (6 of them adjustments), 0 drafts, 0 reversals; unadjusted trial balance 118,300.00, adjusted 153,650.00, assets 128,950.00 = liabilities 6,500.00 + equity 122,450.00 |
| 2026-11-02 | Live database pre-007 backup | PASS | `data/backups/pre-007-20261102/` contains `accounting.sqlite`; the server was stopped for the copy |
| 2026-11-02 | Live database migration to schema 7 | PASS | Migration 007 added `cash_flow_class` with its CHECK; all 17 starter accounts carry the expected classes (100 CASH; 102/103 INVESTING; 104 NON_CASH; 201/300/301 FINANCING; the rest OPERATING); posted history unchanged |
| 2026-11-02 | `npm run check` | PASS, 232/232 | Adds cash-flow class/migration checks, SOE/SOCF service/route/client checks, tab/tooltip/print/preview checks, and integration/E2E coverage checks |
| 2026-11-02 | `npm test` | PASS, 41/41 | Unit + integration; includes SOE roll-forward and balance-sheet tie, SOCF classification/reconciliation/cash transfers, and schema version 7 |
| 2026-11-02 | `npm run test:e2e` | PASS, 9/9 | Reports spec asserts the five tabs, tooltips, SOCI/SOE/SOFP/SOCF figures, print media, a real `%PDF-` file, and Print all; screenshots regenerated |
| 2026-11-02 | `npm audit` | PASS, 0 vulnerabilities | Terminal output |
| 2026-11-02 | `npm run demo:build` | PASS, 44 files | Replays the sample books through the real services: 16 entries, 2 ledgers, 34 accounts; writes `docs/` with the updated demo |
| 2026-11-02 | Browser walkthrough of the rebuilt demo (`http://127.0.0.1:4174`, static `docs/`) | PASS | Five tabs and full-name tooltips; SOCI adjusted 44,300.00 − 18,850.00 = 25,450.00; SOE ending capital 122,450.00; SOFP 128,950.00 = 6,500.00 + 122,450.00; SOCF operating 25,300.00, investing (16,500.00), financing 97,000.00, net/ending cash 105,800.00; reports default to 2023-12-01..2023-12-31; Download PDF and Preview all open a simulated preview with a disabled Save as PDF and an explicit no-file note; account form shows Office Supplies preselected as Investing and saves a change. No application console errors |
| 2026-11-02 | Screenshot evidence | PASS | `screenshots/` has 21 PNGs; the Playwright spec regenerated 19 (six pages at 1440/768/390 px plus mobile navigation), and the earlier setup-1440/setup-390 screenshots remain |
| 2026-11-04 | GitHub Pages deployment of the four-statement demo | PASS | Pushed `b4fc6b1`; workflow run 41752716402 completed successfully and published `gh-pages` commit 3d030d8 ("Demo site from b4fc6b1..."). A fresh Playwright Chromium context loaded <https://derp28.github.io/AccountingSystem/?v=b4fc6b1#/reports> and saw the five abbreviated tabs with full accessible names, SOCI ₱25,450.00, SOE ending capital ₱122,450.00, SOFP ₱128,950.00, SOCF ending cash ₱105,800.00, and the simulated preview with a disabled Save as PDF and the no-file note. No page errors. |
| 2026-11-04 | Stage 3 UI review | PASS | Live app at 390 px and demo at 1440/390 px: found the report status chip rendering light-on-light on the statement cards and the mobile drawer close button sitting under the persistent banner at scroll top. Fixed the chip to dark green `rgb(31, 77, 58)` on light green `rgb(226, 238, 230)` with a red failure variant; layered the drawer (z-index 80) and backdrop (75) above the banner (70); added `role="tabpanel"` and `aria-labelledby` linking the report body to the active tab. |
| 2026-11-04 | `npm run check` after the UI review fixes | PASS, 232/232 | Static, schema, auth, report, print, and demo checks unchanged |
| 2026-11-04 | `npm test` after the UI review fixes | PASS, 41/41 | Unit + integration, including the real restart and report invariants |
| 2026-11-04 | `npm run test:e2e` after the UI review fixes | PASS, 9/9 | Auth, critical path, mobile drawer, reports/print, XSS, and screenshots; screenshots regenerated with the fixed chip and visible mobile close button |
| 2026-11-04 | `npm run demo:build` after the UI review fixes | PASS, 44 files | 16 entries, 2 ledgers, 34 accounts; demo carries the contrast and tabpanel fixes |
| 2026-11-04 | Browser verification of the UI review fixes | PASS | Demo chip computed `color: rgb(31, 77, 58)` on `background: rgb(226, 238, 230)`; live 390 px drawer's close button hit-tested and clicked at scroll top; `#report-body` reported `role="tabpanel"` with `aria-labelledby="report-tab-owner-equity"` and the accessible name "Statement of Owner's Equity"; no page errors |
| 2026-11-04 | GitHub Pages deployment of the UI review fixes | PASS | Pushed `8895072`; workflow run 41755729378 succeeded and published `gh-pages` commit 615b618 ("Demo site from 8895072..."). A fresh Chromium context at <https://derp28.github.io/AccountingSystem/?v=8895072#/reports> verified the five tabs, SOCI ₱25,450.00, SOE ₱122,450.00, SOFP ₱128,950.00, SOCF ₱105,800.00, the chip computed `rgb(31, 77, 58)` on `rgb(226, 238, 230)`, the tabpanel label, the simulated preview with a disabled Save as PDF and no download, and a 390 px drawer whose close button hit-tests and closes. No page or console errors. |
| 2026-11-04 | User-requested page-header cleanup | PASS | Removed the shared page-header eyebrow from `public/js/components/ui.js` and the six page views, and removed the unused `.eyebrow` CSS; modal eyebrows remain. The same build keeps the mobile report status chip on one line and wraps it below the statement heading. |
| 2026-11-04 | `npm run check` after the page-header cleanup | PASS, 232/232 | Static, schema, auth, report, print, and demo checks unchanged |
| 2026-11-04 | `npm test` after the page-header cleanup | PASS, 41/41 | Unit + integration, including the real restart and report invariants |
| 2026-11-04 | `npm run test:e2e` after the page-header cleanup | PASS, 9/9 | Auth, critical path, mobile drawer, reports/print, XSS, and screenshots; screenshots regenerated without page eyebrows |
| 2026-11-04 | `npm run demo:build` after the page-header cleanup | PASS, 44 files | 16 entries, 2 ledgers, 34 accounts; demo carries the no-eyebrow page headers |
| 2026-11-04 | Browser verification of the page-header cleanup | PASS | Demo at 1440 and 390 px: zero `.page-header .eyebrow` elements on Dashboard, Chart of Accounts, Business Transactions, General Journal, Adjustments, and Reports; SOE chip 172.3 by 27.25 px with `white-space: nowrap`; no page errors |
| 2026-11-04 | GitHub Pages deployment of the final review build | PASS | Pushed `22cad53`; workflow run 41800659639 succeeded and published `gh-pages` commit c737923 ("Demo site from 22cad53..."). A fresh Chromium context at <https://derp28.github.io/AccountingSystem/?v=22cad53> found zero `.page-header .eyebrow` elements on all six pages at 1440 px and on Reports at 390 px, measured the SOE chip at 172.3 by 27.25 px with `white-space: nowrap`, and saw the simulated-PDF no-file note; no page errors. |
| 2026-11-04 | User-requested Chart of Accounts column cleanup | PASS | Removed the Normal balance and Balance columns from the Chart of Accounts table in `public/js/views/accounts.js`; rows now show Code, Account, Status, and Actions. The category header retains its Group balance summary. |
| 2026-11-04 | `npm run check` after the Chart of Accounts cleanup | PASS, 232/232 | Static, schema, auth, report, print, and demo checks unchanged |
| 2026-11-04 | `npm test` after the Chart of Accounts cleanup | PASS, 41/41 | Unit + integration, including the real restart and report invariants |
| 2026-11-04 | `npm run test:e2e` after the Chart of Accounts cleanup | PASS, 9/9 | Auth, critical path, mobile drawer, reports/print, XSS, and screenshots; screenshots regenerated with the reduced Chart of Accounts table |
| 2026-11-04 | `npm run demo:build` after the Chart of Accounts cleanup | PASS, 44 files | 16 entries, 2 ledgers, 34 accounts; demo carries the reduced Chart of Accounts table |
| 2026-11-04 | Browser verification of the Chart of Accounts cleanup | PASS | Demo at 1440 and 390 px: table headers are Code, Account, Status, and Actions with no Normal balance or Balance column; category Group balance summary remains; no horizontal overflow at 390 px; no page errors |

## Known limitations

- Period close, exports, automated adjustment schedules, tax/VAT/statutory rules, and multi-currency conversion are deferred. The trial balance and the four financial statements (SOCI, SOE, SOFP, SOCF) **are** implemented (REP-001..011).
- Automated backup is not implemented; only the documented stopped-server file copy exists.
- The password protects the running app, not the SQLite file. Data-at-rest protection requires full-disk encryption; the app says so on the access screen.
- There is no email recovery or password-reset link; recovery is the offline `npm run auth:reset-password` command.
- Entry numbering is global across ledgers (D-027); per-ledger numbering is not implemented.
- Ledgers are separate sets of books, not a multi-user workspace; there are no roles, sharing, or membership.
- SQLite is a single-writer local store; concurrent multi-user access is not supported.
- The GitHub release workflow was not executed here; its configuration is statically checked only.
- The GitHub Pages demo cannot persist data: everything is in memory, resets on reload, and the sign-in screen accepts any password. Only the demo's wording is rewritten; the shipped app is unchanged.
- Migrations 005, 006, and 007 were applied to the live `data/accounting.sqlite` (schema 7) after the pre-migration backups in `data/backups/pre-006-20261027/` and `data/backups/pre-007-20261102/`; new installations apply them automatically.
- The Statement of Cash Flows is a direct cash-line presentation: line labels are the counter-account names, cash transfers are excluded, and the section totals reconcile to the Cash account. It is not a jurisdiction-specific statutory format, and no tax/VAT/period-close rules are applied.
- The Statement of Comprehensive Income equals net income because the app has no other comprehensive income items. The Statement of Owner's Equity uses the computed accumulated-earnings line from the balance sheet; the books are not closed.
- The public demo's PDF preview is simulated. It creates no file and downloads nothing; only the self-hosted live app uses the browser's Print / Save as PDF dialog.
- The demo's sample transactions are the owner's December 2023 set; the 11 December hiring agreement has no entry until payroll is recorded.
- The Stage 3 UI has not yet been approved by the user. The 2026-11-04 review fixed the report-chip contrast, mobile drawer close-button layering, and mobile chip wrapping, and removed the redundant page eyebrows at the user's request; the remaining minor observations are in `UI_REVIEW.md`.
- Report tabs support Tab/Shift+Tab and Enter/Space but not arrow-key roving focus; the report body is a labelled tabpanel.
- Account codes are constrained to three-digit category hundred-series ranges by D-018; out-of-range codes are rejected by the API, UI, and database triggers.
- Reversals use the approved D-019 policy: server current UTC date and `GENERAL_JOURNAL` source type.
- Reversal of a posted entry whose account was later deactivated is allowed as the approved D-016 correction path.
- Browser coverage is Chromium only in this run. Edge fallback was not executed for Stage 2.
- Accessibility checks are targeted (labels, focus, Escape, aria-live, reduced-motion review); no automated axe audit or screen-reader session is claimed.
- Screenshots use synthetic E2E data, not user data.
- `npm audit` is a point-in-time result, not a guarantee.
- The 2026-10-21 evidence was recorded on an uncommitted working tree; the 2026-10-24 localization and demo work was committed with its push to GitHub. The 2026-11-02 four-statement work was committed in `b4fc6b1`, pushed on 2026-11-04, and deployed to GitHub Pages.
