# PLANS.md — Architecture and phase plan

## Current phase

**Stage 3 implemented — local access, multiple ledgers, reports, and self-hosted distribution (pending user UI review).** Stage 2 remains the approved accounting core. Stage 3 adds a local username/password gate, one local account owning multiple ledgers, and a Reports page with trial balance, income statement, and balance sheet on an adjusted/unadjusted basis. Distribution is source on GitHub plus self-hosted Docker/release copies; there is no public hosting. Automated verification passes (182 static checks, 38 backend tests, 9 Playwright tests, `npm audit` 0). The Stage 3 UI has not yet been reviewed by the user, and migration 005 has not yet been applied to the live database. Period close, exports, multi-currency, tax/VAT, and statutory rules remain deferred.

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
- `POST /api/auth/claim`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/lock`
- `GET/POST /api/ledgers`, `POST /api/ledgers/:id/switch`
- `PUT /api/profile`, `PUT /api/workspace`
- `GET/POST /api/accounts`, `PUT /api/accounts/:id`, `POST /api/accounts/:id/active`
- `GET/POST /api/entries`, `GET/PUT/DELETE /api/entries/:id`
- `POST /api/entries/:id/post`, `POST /api/entries/:id/reverse`
- `GET /api/dashboard`, `GET /api/trial-balance`
- `GET /api/reports/trial-balance`, `GET /api/reports/income-statement`, `GET /api/reports/balance-sheet`

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
- No telemetry, external calls, or remote access. From Stage 3 on, the running app is gated by a local username/password (D-022); the loopback threat model still applies.

### Backup and recovery

Automated backup is deferred. To take a consistent manual backup:

1. Stop the server with `Ctrl+C` or `SIGTERM`.
2. Copy `data/accounting.sqlite` to a safe location. If `data/accounting.sqlite-wal` or `-shm` files exist, copy them with the database.
3. Restart the server and verify `/api/health` or the dashboard.

Do not copy the database while writes are in progress. Restore by stopping the server and replacing the database file (and sidecars) with the backup, then restarting.

## Stage 3 — local access, multiple ledgers, reports, and distribution

### Local access

- First launch shows a claim screen for a display name, username, password (with confirmation), first ledger name, and currency. The main app is not exposed until the account exists.
- Passwords are salted scrypt hashes compared with `crypto.timingSafeEqual`. The plaintext password is never stored.
- Sessions are rows in `sessions`; the browser holds an `HttpOnly`, `SameSite=Strict` cookie (`ledgerline_session`), with `Secure` added only when `LEDGERLINE_SECURE_COOKIES=1`.
- Idle lock after 30 minutes; absolute expiry 12 hours after sign-in. Five failed sign-ins lock the account for 15 minutes. Mutations require an `X-CSRF-Token` matching the session.
- `npm run auth:reset-password -- <username>` resets the password offline and revokes every session. There is no email recovery.

### Multiple ledgers

- `users`, `ledgers`, and `sessions` are the new tables. Accounts, journal entries, and related rows carry `ledger_id`.
- Migration `005_local_auth_multi_ledger.sql` creates an unclaimed placeholder user and `ledger-default`, assigns all pre-existing rows to `ledger-default`, adds ledger-scoped indexes, and adds triggers for single-user and cross-ledger isolation. Existing data is preserved; a fresh copy starts empty.
- A new ledger gets a fresh seeded Chart of Accounts and its own empty journal. The sidebar switcher changes the active ledger for the session.
- Entry numbering stays global (D-027); the single local user is also enforced by `trg_single_local_user`.

### Reports

- `GET /api/reports/trial-balance?asOf=&basis=`, `GET /api/reports/income-statement?from=&to=&basis=`, and `GET /api/reports/balance-sheet?asOf=&basis=` compute integer-cent figures on the server.
- Adjusted includes every posted entry. Unadjusted excludes adjustment entries and the reversals linked to adjustments. Drafts are excluded and zero-balance accounts are hidden.
- The balance sheet uses a computed accumulated-earnings line (D-025) because period close is not implemented.

### Distribution

- The repository holds source only; `data/` and `.env` stay git-ignored and are excluded from the image.
- `Dockerfile` pins Node 24, runs as the non-root `node` user, sets `LEDGERLINE_CONTAINER=1`, and declares a `/app/data` volume. `docker-compose.yml` publishes the host port on `127.0.0.1` only.
- The server keeps its loopback default and refuses non-loopback hosts unless `LEDGERLINE_CONTAINER=1`.
- `.github/workflows/release.yml` builds and pushes `ghcr.io/<owner>/<repo>` on version tags and creates a GitHub Release. It was not executed in this environment.

## Key design choices

- One local account per installation can own multiple ledgers (D-023). A ledger is a set of books, not an accounting period; period close is deferred.
- Sales Invoice, Purchase Bill, Cash Receipt, Cash Payment, General Journal, and Adjustments each map to one balanced entry.
- Minimal editable seed Chart of Accounts using the approved hundreds series, with codes incrementing by one within each category.
- Currency is chosen at onboarding, stored with the workspace, and used for formatting only; no conversion.
- Posted entries are immutable; one reversal per entry; reversals cannot be reversed.
- No tax, VAT, statutory, period-close, automated adjustment, export, or multi-currency logic. Multiple ledgers are supported as separate sets of books (D-023); they are not a multi-user workspace.
- Account codes use the approved category hundred-series ranges; server validation and database triggers enforce the rule. New accounts prefill the next unused code in the selected category and remain editable.
- Material accounting policies are recorded in `DECISIONS.md`; D-016, D-018, D-019, and D-021 are approved.

## Testing and evidence

- `node scripts/check.mjs`: 182 static, schema, API, security, auth, reports, and distribution checks.
- `bash scripts/test.sh`: 38 unit/integration tests, including a real child-process restart with session persistence.
- `bash scripts/test-e2e.sh`: 9 Playwright tests (claim/sign-in/lock, ledger switching, critical path, rename, mobile navigation, reports, screenshots, XSS).
- `npm audit`: 0 vulnerabilities across runtime and dev dependencies.
- Screenshots at 1440, 768, and 390 px are in `screenshots/`, including the six application pages.
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
| Password or session compromise | scrypt hashes, server-side sessions, HttpOnly/SameSite cookies, CSRF tokens, lockout, offline reset that revokes sessions |
| Cross-ledger data leak | Ledger-scoped queries and indexes plus database isolation triggers; integration tests |
| Wrong adjusted/unadjusted numbers | Server-side integer-cent calculation, explicit basis filter, integration invariant tests |
| Shipping personal data in a release | `data/` and `.env` git-ignored and excluded from the image; fresh empty database per copy |
| Responsive regressions | 1440/768/390 screenshots, mobile drawer test, overflow assertion |
| Scope creep | Requirements registry, explicit deferrals, Gate 2 stop |
| Tooling on Windows UNC | All commands run through WSL; test scripts set the Node path and browser libraries |

## Phase gates

1. **G0 — Discovery:** passed.
2. **G1 — UI approval:** passed 2026-10-20; see `UI_REVIEW.md`.
3. **G2 — Accounting integrity:** passed; Stage 2 UI approved and policies D-016, D-018, D-019, D-021 confirmed on 2026-10-20. See `TEST_PLAN.md` evidence.
4. **G3 — Final product signoff / later-stage scope:** passed 2026-10-20 for the Stage 2 scope.
5. **G4 — Stage 3 local access, multiple ledgers, reports, distribution:** implemented and automatically verified 2026-10-21 (182 static checks, 38 backend tests, 9 E2E tests, `npm audit` 0). Pending user UI review before signoff; migration 005 is not yet applied to the live database.
