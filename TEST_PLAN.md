# TEST_PLAN.md — Risk-based verification and evidence

## Scope

Stage 2 verifies the local Express + SQLite implementation of the approved Ledgerline UI. It covers persistence, migrations, posting, immutability, reversal, duplicate/partial-write prevention, transaction-to-journal consistency, security controls, and the critical browser path. Stage 1 was a UI-only prototype and is recorded separately.

Formal reports, exports, period close, tax/VAT/statutory logic, multi-currency conversion, multiple workspaces, authentication, and automated backup are out of scope and are not claimed.

## Environment

- WSL Ubuntu, Node v24.22.0 (`/home/derp_28/.nvm/versions/node/v24.22.0/bin`)
- Project: `/home/derp_28/accounting-app`
- App: `http://127.0.0.1:3000`, database `data/accounting.sqlite`
- E2E: `http://127.0.0.1:3100`, database `data/e2e.sqlite`
- Browser: Playwright Chromium in WSL; `scripts/test-e2e.sh` supplies user-local browser libraries
- SQLite: Node built-in `node:sqlite`, SQLite 3.53.4
- Date of this evidence run: 2026-10-20

## Commands

```bash
export PATH=/home/derp_28/.nvm/versions/node/v24.22.0/bin:$PATH
cd /home/derp_28/accounting-app

./scripts/dev.sh              # start the app on 127.0.0.1:3000
node scripts/check.mjs        # static, schema, API, and security checks
bash scripts/test.sh          # unit + integration tests, including restart
bash scripts/test-e2e.sh      # Playwright critical path, rename, mobile, XSS, screenshots
npm audit                     # dependency audit
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

Result: **138 passed, 0 failed.** Covers required files, syntax/import resolution, absence of browser storage, Stage 1 accounting fixtures, migration invariants, integer-cent columns, trigger count and messages, account-code range triggers, per-category sequential seed codes, WAL/foreign-key/busy-timeout/`BEGIN IMMEDIATE`, database permissions, loopback refusal, CSP and security middleware, API route registration, prepared-SQL checks, no `eval`, client API usage, package scripts, and `.gitignore`.

### Unit and integration tests

Command: `bash scripts/test.sh`

Result: **30 tests, 30 passed, 0 failed** (10 unit + 20 integration).

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
- **Actual server process restart**: stop the child server, restart against the same SQLite file, and verify profile/workspace renames, posted entry, balances, trial balance, and equation.

### Browser end-to-end tests

Command: `bash scripts/test-e2e.sh`

Result: **5 tests, 5 passed, 0 failed.**

1. Critical path: onboarding → full-screen workspace Step 2 → seeded COA → add account (asserting prefilled next codes `104` and `502`, then rejecting an out-of-range code) → sale draft → post → journal → adjustment draft/post → reversal → reload → dashboard trial balance/equation. Starts at 390 px to assert Step 2 is in front and above the fold with no dialog.
2. Profile/workspace rename through settings → reload → renamed values persist.
3. Mobile navigation: 390 px drawer, Escape close, no page-level horizontal overflow.
4. Screenshot capture at 1440×900, 768×1024, and 390×844 for Dashboard, Chart of Accounts, Business Transactions, General Journal, and Adjustments.
5. XSS: user markup in account name/description renders as text; no script/img/svg execution; no page errors.

### Dependency audit

Command: `npm audit`

Result: **0 vulnerabilities** across runtime and dev dependencies.

Command: `npm ls --depth=0`

Result: `express@5.3.0`, `@playwright/test@1.64.1`.

### Screenshot evidence

Directory: `screenshots/`

- `dashboard-1440.png`, `accounts-1440.png`, `transactions-1440.png`, `journal-1440.png`, `adjustments-1440.png`
- `dashboard-768.png`, `accounts-768.png`, `transactions-768.png`, `journal-768.png`, `adjustments-768.png`
- `dashboard-390.png`, `accounts-390.png`, `transactions-390.png`, `journal-390.png`, `adjustments-390.png`
- `mobile-navigation-390.png`
- `setup-1440.png`, `setup-390.png`

## Requirement-to-evidence map

| Requirement group | Evidence |
|---|---|
| ONB-001..006 | E2E onboarding, rename, and restart integration; API/DB singleton and validation tests |
| UI-001..015 | E2E critical path, mobile drawer, settings rename, screenshots, static checks, CSS/accessibility review; data-mode banner inspected |
| ACC-001..017 | Unit validation, integration lifecycle/immutability/reversal/balances/equation, E2E critical path, schema triggers |
| ACC-018 | Explicit deferral; not implemented |
| DB-001..008, DB-010 | Migration/schema checks, integrity tests, real restart, prepared-SQL check |
| DB-009 | Manual stopped-server backup documented in `PLANS.md`; automated backup deferred |
| SEC-001..008 | Loopback checks, Origin/content-type/body-limit tests, XSS test, SQL injection test, error hygiene review, `0600` test, CSP/static checks, `npm audit` |
| QA-001..011 | Traceability self-audit, 138 static checks, 30 backend tests, 5 E2E tests, restart, screenshots, exact evidence in this file |

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

## Known limitations

- Formal statements, exports, period close, automated adjustment schedules, tax/VAT/statutory rules, multi-currency conversion, and multiple workspaces are deferred.
- Automated backup is not implemented; only the documented stopped-server file copy exists.
- The app has no authentication or authorization beyond loopback binding, same-origin mutation checks, JSON-only mutations, and the local-only threat model.
- There is no CSRF token, rate limiting, or account lockout; these are not meaningful protections for a single-user loopback app but would be required before remote use.
- SQLite is a single-writer local store; concurrent multi-user access is not supported.
- Account codes are constrained to three-digit category hundred-series ranges by D-018; out-of-range codes are rejected by the API, UI, and database triggers.
- Reversals use the approved D-019 policy: server current UTC date and `GENERAL_JOURNAL` source type.
- Reversal of a posted entry whose account was later deactivated is allowed as the approved D-016 correction path.
- Browser coverage is Chromium only in this run. Edge fallback was not executed for Stage 2.
- Accessibility checks are targeted (labels, focus, Escape, aria-live, reduced-motion review); no automated axe audit or screen-reader session is claimed.
- Screenshots use synthetic E2E data, not user data.
- `npm audit` is a point-in-time result, not a guarantee.
- The working tree is not committed; evidence is based on the files and commands above.
