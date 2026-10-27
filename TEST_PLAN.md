# TEST_PLAN.md — Risk-based verification and evidence

## Scope

Stage 3 verifies the local Express + SQLite implementation of the approved Ledgerline UI plus local username/password access, multiple ledgers, and the adjusted/unadjusted reports. It covers persistence, migrations, posting, immutability, reversal, duplicate/partial-write prevention, transaction-to-journal consistency, security controls, sessions and CSRF, ledger isolation, the three reports, and the critical browser path. Stage 1 was a UI-only prototype and is recorded separately. Evidence for the approved Stage 2 core remains valid.

Period close, exports, automated adjustment schedules, tax/VAT/statutory logic, multi-currency conversion, and automated backup are out of scope and are not claimed.

## Environment

- WSL Ubuntu, Node v24.22.0 (`/home/derp_28/.nvm/versions/node/v24.22.0/bin`)
- Project: `/home/derp_28/accounting-app`
- App: `http://127.0.0.1:3000`, database `data/accounting.sqlite`
- E2E: `http://127.0.0.1:3100`, database `data/e2e.sqlite`
- Browser: Playwright Chromium in WSL; `scripts/test-e2e.sh` supplies user-local browser libraries
- SQLite: Node built-in `node:sqlite`, SQLite 3.53.4
- Date of this evidence run: 2026-10-21

## Commands

```bash
export PATH=/home/derp_28/.nvm/versions/node/v24.22.0/bin:$PATH
cd /home/derp_28/accounting-app

./scripts/dev.sh              # start the app on 127.0.0.1:3000
node scripts/check.mjs        # static, schema, API, security, auth, reports, distribution checks
bash scripts/test.sh          # unit + integration tests, including restart
bash scripts/test-e2e.sh      # Playwright auth, critical path, reports, mobile, XSS, screenshots
npm audit                     # dependency audit
npm run auth:reset-password -- <username>   # offline password reset (revokes sessions)
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

Result: **182 passed, 0 failed.** Covers required files, syntax/import resolution, absence of browser storage, Stage 1 accounting fixtures, migration invariants, integer-cent columns, trigger count and messages, account-code range triggers, per-category sequential seed codes, WAL/foreign-key/busy-timeout/`BEGIN IMMEDIATE`, database permissions, loopback refusal, CSP and security middleware, API route registration, prepared-SQL checks, no `eval`, client API usage, package scripts, and `.gitignore`. Stage 3 additions assert migration 005's auth/ledger schema and isolation triggers, the scrypt/session/lockout safeguards, the cookie and CSRF middleware, the three report routes and adjusted-basis filter, the Docker loopback/boundary settings, and that `data/`/`.env` stay ignored while `.env.example` is kept.

### Unit and integration tests

Command: `bash scripts/test.sh`

Result: **38 tests, 38 passed, 0 failed** (10 unit + 28 integration).

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

### Browser end-to-end tests

Command: `bash scripts/test-e2e.sh`

Result: **9 tests, 9 passed, 0 failed.**

1. First run: the claim screen fits a 390 px viewport; short password, mismatched confirmation, and empty ledger name each produce inline errors; valid input creates the account and opens the dashboard.
2. Lock and sign-in: "Lock now" shows the sign-in screen (not first-run setup), a wrong password shows a generic error, and the correct password returns to the dashboard.
3. Ledgers: a second ledger is created, becomes active with its own seeded Chart of Accounts, and the sidebar switches back to the first ledger.
4. Critical path: seeded COA → add account (asserting prefilled next codes `104` and `502`, then rejecting an out-of-range code) → sale draft → post → journal → adjustment draft/post → reversal → reload → dashboard trial balance/equation.
5. Profile/ledger rename through settings → reload → renamed values persist.
6. Mobile navigation: 390 px drawer, Escape close, no page-level horizontal overflow.
7. Reports: adjusted/unadjusted trial balance, income statement for a June period, and balance sheet with the computed accumulated earnings line.
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

## Requirement-to-evidence map

| Requirement group | Evidence |
|---|---|
| ONB-001..006 (superseded) | Historical Stage 2 onboarding; replaced by AUTH/LED groups in Stage 3 |
| AUTH-001..008 | Claim/login/lock E2E; HTTP 401/403 tests; lockout and reset integration; static scrypt/session/cookie checks |
| LED-001..004 | Ledger switcher E2E; isolation and new-ledger integration; `data/`/`.env` ignore checks |
| REP-001..005 | Report integration invariants; reports E2E (basis toggle, three tabs); static route/basis checks |
| UI-001..015 | E2E auth, critical path, mobile drawer, reports, settings rename, screenshots, static checks, CSS/accessibility review |
| ACC-001..017 | Unit validation, integration lifecycle/immutability/reversal/balances/equation, E2E critical path, schema triggers |
| ACC-018 | Period close, exports, tax, multi-currency, and automated adjustments deferred; formal statements implemented as REP-001..005 |
| DB-001..008, DB-010..012 | Migration/schema checks, integrity tests, real restart, ledger isolation triggers, prepared-SQL check |
| DB-009 | Manual stopped-server backup documented in `PLANS.md`; automated backup deferred |
| DB-013 | Migration 005 preserves legacy data by assigning it to `ledger-default`; string checks plus backup of the live file |
| SEC-001..008 | Loopback checks, Origin/content-type/body-limit tests, CSRF/session tests, XSS test, SQL injection test, error hygiene review, `0600` test, CSP/static checks, `npm audit` |
| DIST-001..003 | Docker/compose/.env.example/README static checks; `data/` and `.env` excluded from git and the image |
| QA-001..014 | Traceability self-audit, 182 static checks, 38 backend tests, 9 E2E tests, restart, screenshots, exact evidence in this file |

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
| 2026-10-27 | `npm run demo:build` after the chart change | PASS, 44 files | `demo/books.js` replayed through the real services: 9 entries, 2 ledgers, 34 accounts, profile AAA Computer Services, currency PHP |
| 2026-10-27 | Demo sample transactions | PASS, 9 entries, equation difference 0 | Owner's December 2023 set posted through the real services: assets 104,300.00 PHP, liabilities 7,500.00, equity 97,000.00, net loss 200.00; every entry balanced, no draft or reversal injected into the sample books |

## Known limitations

- Period close, exports, automated adjustment schedules, tax/VAT/statutory rules, and multi-currency conversion are deferred. The trial balance, income statement, and balance sheet **are** implemented (REP-001..005).
- Automated backup is not implemented; only the documented stopped-server file copy exists.
- The password protects the running app, not the SQLite file. Data-at-rest protection requires full-disk encryption; the app says so on the access screen.
- There is no email recovery or password-reset link; recovery is the offline `npm run auth:reset-password` command.
- Entry numbering is global across ledgers (D-027); per-ledger numbering is not implemented.
- Ledgers are separate sets of books, not a multi-user workspace; there are no roles, sharing, or membership.
- SQLite is a single-writer local store; concurrent multi-user access is not supported.
- The GitHub release workflow was not executed here; its configuration is statically checked only.
- The GitHub Pages demo cannot persist data: everything is in memory, resets on reload, and the sign-in screen accepts any password. Only the demo's wording is rewritten; the shipped app is unchanged.
- Migrations 005 and 006 have not yet been applied to the live `data/accounting.sqlite` (schema 4); they apply on the next server start, after the pre-migration backup.
- The demo's sample transactions are the owner's December 2023 set; the 11 December hiring agreement has no entry until payroll is recorded.
- The Stage 3 UI has not yet been reviewed or approved by the user.
- Account codes are constrained to three-digit category hundred-series ranges by D-018; out-of-range codes are rejected by the API, UI, and database triggers.
- Reversals use the approved D-019 policy: server current UTC date and `GENERAL_JOURNAL` source type.
- Reversal of a posted entry whose account was later deactivated is allowed as the approved D-016 correction path.
- Browser coverage is Chromium only in this run. Edge fallback was not executed for Stage 2.
- Accessibility checks are targeted (labels, focus, Escape, aria-live, reduced-motion review); no automated axe audit or screen-reader session is claimed.
- Screenshots use synthetic E2E data, not user data.
- `npm audit` is a point-in-time result, not a guarantee.
- The 2026-10-21 evidence was recorded on an uncommitted working tree; the 2026-10-24 localization and demo work is committed with the push to GitHub.
