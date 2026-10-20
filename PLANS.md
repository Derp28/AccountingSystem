# PLANS.md — Architecture and phase plan

## Current phase

**Final signoff — Stage 2 local accounting app.** The approved UI is connected to an Express 5 API and a single SQLite database. Gate 2 evidence is complete, the Stage 2 UI was approved on 2026-10-20, and final product signoff was accepted the same day. Accounting policies D-016, D-018, D-019, and D-021 were confirmed and implemented. Later-stage product work, formal reports, exports, and period close remain deferred and unauthorized.

## Discovery summary

| Item | Result |
|---|---|
| Workspace | `/home/derp_28` (WSL Ubuntu), opened from Windows over UNC |
| Repository | `accounting-app` initialized as a git repository; changes remain uncommitted |
| Node | v24.22.0 via NVM in WSL |
| SQLite | Node built-in `node:sqlite`, SQLite 3.53.4 |
| Tests | `node:test` for unit/integration; Playwright Chromium for E2E |
| Browser | WSL loopback reachable from Windows; E2E uses Chromium with user-local libraries |
| Windows Node | Avoid on the UNC workspace due to CWD limitations |
| Stale files | Home-directory helper scripts reference a deleted prior app; left untouched |

## Stage 1 — approved UI prototype (historical)

- Static single-page app, ES modules, hash routing, in-memory mock state.
- Ledger-paper visual system, system fonts only, responsive navigation.
- Views: onboarding, dashboard, accounts, transactions, journal, adjustments.
- Approved by the user on 2026-10-20 after 59 static checks and focused UI checks.
- Stage 1 did not persist data and labeled actions as simulated. Stage 2 replaces that behavior.

## Stage 2 — implemented architecture

### Runtime and files

- Express 5 serves `public/` and JSON APIs from `server/`.
- `node:sqlite` opens one local database (default `data/accounting.sqlite`) with WAL, foreign keys, busy timeout, and `BEGIN IMMEDIATE` mutations.
- Integer cents are stored in SQLite; money is never computed with binary floating-point.
- The browser never opens SQLite and never receives the database path from the API.
- The server binds `127.0.0.1` by default and refuses non-loopback hosts.

### Database

- `schema_migrations` tracks applied versions; migrations run transactionally and idempotently.
- `profile` and `workspace` are singleton rows protected by constraints.
- `accounts` has unique case-insensitive codes, five categories, active/inactive state, and no hard delete.
- `journal_entries` stores source type, date, memo, reference, adjustment fields, status, entry number, version, idempotency key, and reversal links.
- `journal_lines` stores line order, account, description, and integer debit/credit cents.
- `reversal_links` enforces one reversal per posted entry and links original/reversal entries.
- `number_sequences` allocates source-prefixed entry numbers inside the same transaction.
- Triggers reject unbalanced posting, posted-entry/line updates and deletes, invalid reversal targets, and reversal-link mutation.
- Drafts are excluded from balances. Only posted lines feed account balances, the dashboard, and the trial balance.

### API

- `GET /api/health`, `GET /api/bootstrap`
- `PUT /api/profile`, `PUT /api/workspace`
- `GET/POST /api/accounts`, `PUT /api/accounts/:id`, `POST /api/accounts/:id/active`
- `GET/POST /api/entries`, `GET/PUT/DELETE /api/entries/:id`
- `POST /api/entries/:id/post`, `POST /api/entries/:id/reverse`
- `GET /api/dashboard`, `GET /api/trial-balance`

### Validation and consistency

- Server-side validation is authoritative: required fields, lengths, ISO dates, source/adjustment types, active accounts, one positive side per line, at least two lines when posting, non-zero balanced totals, and at most 100 lines.
- The API prefers integer-cent fields and accepts two-decimal `debit`/`credit` strings as a fallback, parsed exactly.
- Draft updates use optimistic `version` checks. Creation and reversal use one idempotency key per request.
- Posting runs in one immediate transaction: re-validate, update status, write the reversal link where applicable, and commit. Any failure rolls back completely.
- Posted entries are immutable through both API and database triggers; correction is by reversal only.

### Security and local operations

- CSP (`script-src 'self'`), frame denial, nosniff, no-referrer, permissions policy, and no-store API responses.
- Mutation requests must be JSON and must come from a loopback Host with a same-origin Origin when one is supplied.
- SQL uses fixed identifiers and prepared statements; no user values are interpolated into SQL.
- User text is HTML-escaped in templates and covered by an XSS E2E test.
- Database files are created with mode `0600` where the filesystem supports POSIX permissions.
- No authentication, telemetry, external calls, or remote access. The threat model is a single local user.

### Backup and recovery

Automated backup is deferred. To take a consistent manual backup:

1. Stop the server with `Ctrl+C` or `SIGTERM`.
2. Copy `data/accounting.sqlite` to a safe location. If `data/accounting.sqlite-wal` or `-shm` files exist, copy them with the database.
3. Restart the server and verify `/api/health` or the dashboard.

Do not copy the database while writes are in progress. Restore by stopping the server and replacing the database file (and sidecars) with the backup, then restarting.

## Key design choices

- Single workspace/report per installation; it is not an accounting period.
- Sales Invoice, Purchase Bill, Cash Receipt, Cash Payment, General Journal, and Adjustments each map to one balanced entry.
- Minimal editable seed Chart of Accounts using the approved hundreds series, with codes incrementing by one within each category.
- Currency is chosen at onboarding, stored with the workspace, and used for formatting only; no conversion.
- Posted entries are immutable; one reversal per entry; reversals cannot be reversed.
- No tax, VAT, statutory, period-close, automated adjustment, export, multi-currency, or multi-workspace logic.
- Account codes use the approved category hundred-series ranges; server validation and database triggers enforce the rule. New accounts prefill the next unused code in the selected category and remain editable.
- Material accounting policies are recorded in `DECISIONS.md`; D-016, D-018, D-019, and D-021 are approved.

## Testing and evidence

- `node scripts/check.mjs`: 138 static, schema, API, security, and Stage 1 regression checks.
- `bash scripts/test.sh`: 30 unit/integration tests, including a real child-process restart.
- `bash scripts/test-e2e.sh`: 5 Playwright tests (critical path, settings rename, mobile navigation, screenshots, XSS).
- `npm audit`: 0 vulnerabilities across runtime and dev dependencies.
- Screenshots at 1440, 768, and 390 px are in `screenshots/`.
- Exact commands and results are recorded in `TEST_PLAN.md`.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Posted data appears editable | API checks plus database triggers; E2E verifies view/reverse-only behavior |
| Unbalanced or partial posting | Server validation, `BEGIN IMMEDIATE`, balance trigger, rollback tests |
| Duplicate submission | Unique client request IDs and idempotent create/reverse paths |
| Money rounding drift | Integer cents, exact decimal parsing, bounded values, unit tests |
| Data loss on restart | WAL, migrations, process-restart integration test, documented stopped-server backup |
| XSS or injected SQL | Escaped rendering, parameterized SQL, CSP, security tests |
| Unauthorized remote access | Loopback binding, same-origin/Host checks, JSON-only mutations |
| Responsive regressions | 1440/768/390 screenshots, mobile drawer test, overflow assertion |
| Scope creep | Requirements registry, explicit deferrals, Gate 2 stop |
| Tooling on Windows UNC | All commands run through WSL; test scripts set the Node path and browser libraries |

## Phase gates

1. **G0 — Discovery:** passed.
2. **G1 — UI approval:** passed 2026-10-20; see `UI_REVIEW.md`.
3. **G2 — Accounting integrity:** passed; Stage 2 UI approved and policies D-016, D-018, D-019, D-021 confirmed on 2026-10-20. See `TEST_PLAN.md` evidence.
4. **G3 — Final product signoff / later-stage scope:** passed 2026-10-20 for the current Stage 2 scope. No later-stage features authorized.
