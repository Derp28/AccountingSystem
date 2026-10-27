# REQUIREMENTS.md — Ledgerline

Single source of truth for requirements and acceptance criteria. Task mappings refer to `TASKS.yaml`. Deferred items are explicit and are not claimed as implemented.

**Stage 3 scope (current):** local username/password access, one local account owning multiple ledgers, and a Reports page with trial balance, income statement, and balance sheet on an adjusted/unadjusted basis, plus source-plus-self-hosted distribution. Requirements ONB-001..ONB-006 are superseded by the AUTH and LED groups below; their original acceptance criteria remain as historical record.

## Onboarding

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| ONB-001 | First-launch onboarding gate | With no profile, the app shows a welcome/profile screen and does not expose the main application. Saving a valid profile advances to the workspace setup step; the main application is not exposed until both profile and workspace exist. | T-102, T-203 |
| ONB-002 | Profile creation | Display name is required, trimmed, 1–100 characters. Invalid input shows an inline error and sets `aria-invalid`. The name appears in the greeting and header. | T-102, T-203 |
| ONB-003 | Report/workspace naming | Immediately after profile setup, a dedicated full-screen workspace step asks for a report/workspace name. It is required, 1–80 characters, and is never described as an accounting period. | T-102, T-203 |
| ONB-004 | Persistence (Stage 2) | In Stage 2, profile and workspace names survive restart and onboarding is not repeated. Stage 1 explicitly does not persist and labels every action as simulated. | T-203, T-302 |
| ONB-005 | Rename profile/workspace | Profile and workspace names can be renamed from the header menu using the same validation. Renames persist in SQLite and survive restart. | T-102, T-203 |
| ONB-006 | Currency selection | Onboarding requires a valid currency selection. It is stored with the workspace and used for display only; blank or invalid values are rejected. | T-102, T-203 |

## Local access (Stage 3)

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| AUTH-001 | First-run local account | A fresh installation shows a claim screen asking for a display name, username, password (with confirmation), first ledger name, and currency. The main application is not exposed until a valid account exists. | T-401, T-411 |
| AUTH-002 | Credentials | Username is 3–64 lowercase letters, numbers, dots, underscores, or hyphens. Password is 12–128 characters. Passwords are stored only as salted scrypt hashes and compared in constant time. No plaintext or reversible storage. | T-402, T-411 |
| AUTH-003 | Sign-in and lock | The app can be locked on demand ("Lock now") and by idle timeout. The lock leaves the installation claimed, so the next screen is sign-in, not first-run setup. | T-401, T-411 |
| AUTH-004 | Sessions | Server-side sessions with an `HttpOnly`, `SameSite=Strict` cookie (`Secure` only under HTTPS). Idle lock after 30 minutes; absolute expiry 12 hours after sign-in. Sign-out and lock delete the session. | T-402, T-403, T-411 |
| AUTH-005 | CSRF | Mutating requests require an `X-CSRF-Token` header matching the session's token; a missing or mismatched token is rejected. | T-402, T-404, T-411 |
| AUTH-006 | Brute-force resistance | Repeated failed sign-ins lock the account for 15 minutes; wrong credentials return a generic error and do not reveal whether the username exists. | T-402, T-411 |
| AUTH-007 | Password reset | There is no email recovery. `npm run auth:reset-password -- <username>` resets the password from the machine and revokes all sessions. | T-405, T-411 |
| AUTH-008 | Protection scope | The app states that the password protects the running app, not the SQLite file, and that data-at-rest protection needs full-disk encryption. | T-401, T-411 |

## Ledgers (Stage 3)

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| LED-001 | Multiple ledgers | One local account can own multiple ledgers. A sidebar switcher shows the ledgers and marks the active one. | T-406, T-411 |
| LED-002 | Create ledger | A new ledger requires a name (1–80 chars) and a valid currency. It receives a fresh seeded Chart of Accounts and starts with no entries. | T-406, T-411 |
| LED-003 | Isolation | Accounts, journal entries, numbering, and reports are scoped to the active ledger. An entry cannot reference an account from another ledger. Ledger-scoped unique account codes are allowed (the same code may exist in two ledgers). | T-406, T-407, T-411 |
| LED-004 | Fresh distributed copies | A distributed copy (clone, container, or release) starts with an empty database; first run claims the local account and creates its own ledger. No data is shipped in the repository. | T-409, T-410 |

## Reports (Stage 3)

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| REP-001 | Adjusted/Unadjusted basis | Every report has a shared basis toggle, default Adjusted. Adjusted includes all posted entries. Unadjusted excludes adjustment entries and the reversals linked to adjustments. Drafts are never included. | T-408, T-412 |
| REP-002 | Trial balance | Net debit/credit per account with as-of-date filtering, grand totals, and a zero difference; zero-balance accounts are hidden. | T-408, T-412 |
| REP-003 | Income statement | From/to period with revenue lines, expense lines, and net income or loss. Defaults to the current month. | T-408, T-412 |
| REP-004 | Balance sheet | As-of-date report with assets, liabilities, a computed accumulated earnings line, total equity, and total liabilities + equity, with a balanced indicator. | T-408, T-412 |
| REP-005 | Server-calculated and ledger-scoped | All figures are calculated on the server in integer cents from posted lines and are scoped to the active ledger. | T-408, T-412 |


## User interface

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| UI-001 | Application shell and navigation | Sidebar on desktop and hamburger drawer on mobile provide Dashboard, Chart of Accounts, Business Transactions, General Journal, Adjustments, and Reports. A ledger switcher and a "Lock now" control appear in the sidebar. Active state, keyboard operation, Escape-to-close, and focus return work. | T-101, T-108, T-406 |
| UI-002 | Dashboard | Shows personalized greeting, workspace name, financial summary, trial-balance totals, recent entries, and quick actions. All figures derive from posted journal lines returned by the API; none are hardcoded into the view. | T-103, T-208 |
| UI-003 | Chart of Accounts list | Groups accounts by the five categories; supports search, category/status filters, balances, and an empty state. | T-104 |
| UI-004 | Chart of Accounts editor | Add/edit code, name, category, description, and active status. New accounts prefill the next unused code in the selected category (starting at that category's minimum) while remaining editable. Code uniqueness and category hundred-series ranges are validated. Accounts cannot be hard-deleted. | T-104, T-305 |
| UI-005 | Business Transactions list | Shows date, type, reference, description, amount, and status; supports search and type/status filters. | T-105 |
| UI-006 | Transaction editor | Supports Sales Invoice, Purchase Bill, Cash Receipt, Cash Payment, and General Journal; dynamic debit/credit rows; running totals; draft save; clear validation. | T-105 |
| UI-007 | General Journal view | Chronological entries with date, entry number, source, memo, debit/credit totals, and status. Rows expand to show lines. Supports status/type filters. | T-106 |
| UI-008 | Journal editor | Dynamic lines, account selection, debit/credit inputs, running totals, and a balanced/unbalanced indicator. Draft save and server-side posting are available. | T-106, T-206 |
| UI-009 | Adjustments | Lists adjustment entries and provides a manual editor with adjustment type and required reason. Clearly states that no calculations are automated. | T-107 |
| UI-010 | Post/reverse confirmations | Confirmation dialogs show consequences; submit buttons disable while pending; errors appear inline; no false success is reported. | T-105, T-106, T-107, T-109 |
| UI-011 | Loading, empty, error, and success states | Relevant screens provide loading feedback, empty states, inline errors, and success toasts. | T-103, T-109 |
| UI-012 | Data-mode labeling | The persistent banner states that data is saved locally to `data/accounting.sqlite`, that posted entries are immutable, and that corrections use reversals. “Reload data” re-reads SQLite and deletes nothing; no control claims to simulate saving or posting. | T-102, T-109, T-209 |
| UI-013 | Accessibility | Labels, visible focus, native dialog focus behavior, Escape handling, `aria-live` feedback, contrast, semantic tables, and reduced-motion support. | T-108 |
| UI-014 | Responsive layout | Works at 360–1440 px. Primary flows have no page-level horizontal scroll. Tables adapt or scroll within their region. Touch targets are adequate. | T-108 |
| UI-015 | Visual system | Ledger-paper design tokens, system fonts only, consistent buttons/tables/forms/badges/dialogs/navigation. No external asset requests. | T-101, T-108 |

## Accounting behavior

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| ACC-001 | Chart of Accounts rules | Five standard categories; seeded codes begin at each category base and increment by one (100-104 assets, 200-204 liabilities, 300-301 equity, 400 revenue, 500-503 expenses); account 104 Accumulated Depreciation - Office Equipment is a contra asset (asset category, credit balance); user-created codes are unique and inside the category hundred-series range (assets 100-199, liabilities 200-299, equity 300-399, revenue 400-499, expenses 500-599); normal balance derived from category; accounts can be deactivated. | T-104, T-204, T-305, T-416 |
| ACC-002 | Defined transaction types | Sales Invoice, Purchase Bill, Cash Receipt, Cash Payment, General Journal, and Adjustment. Each maps to exactly one journal entry. | T-105, T-205 |
| ACC-003 | Drafts | Drafts may be incomplete and have no ledger effect. Drafts are editable/deletable with optimistic-concurrency checking in Stage 2. | T-105, T-205 |
| ACC-004 | Posting validation | At least two lines; exactly one positive side per line; integer cents; balanced totals; active existing accounts; valid ISO date; memo; adjustment reason when applicable. | T-106, T-107, T-206 |
| ACC-005 | Atomic posting | Posting is one database transaction; any failure leaves the entry unchanged with no partial posting. | T-206 |
| ACC-006 | Posted immutability | Posted entries and lines cannot be edited or deleted through API or database. Correction is reversal only. | T-206, T-207 |
| ACC-007 | Reversal workflow | Creates a new posted entry with sides swapped, linked to the original, with a required reason. One reversal per entry; reversal entries cannot be reversed; original and reversal net to zero. | T-107, T-207 |
| ACC-008 | Entry numbering | Server-generated, unique, immutable, and displayed with a source-type prefix. | T-205 |
| ACC-009 | Derived balances | Account balances and dashboard figures derive only from posted lines; drafts are excluded. | T-103, T-206, T-208 |
| ACC-010 | Trial balance | Per-account debit/credit totals and grand totals; difference must be zero. | T-103, T-208 |
| ACC-011 | Money precision | Integer cents internally; API accepts at most two decimals and converts exactly; no float arithmetic; display uses workspace currency. | T-202, T-208 |
| ACC-012 | Manual adjustments | Adjustments are manual entries with a type label and reason. No automated accrual, depreciation, or period-close calculations. | T-107, T-205 |
| ACC-013 | Transaction/journal consistency | Transactions, journal, adjustments, and dashboard read the same entries; no duplicate source records or divergent totals. | T-105, T-106, T-205 |
| ACC-014 | Duplicate/partial posting prevention | Unique client request ID; repeated posting returns conflict/current state without duplicates; no partial writes. | T-205, T-206 |
| ACC-015 | Account lifecycle | Deactivation blocks new use and posting but preserves historical posted lines. Reactivation is allowed. | T-104, T-204 |
| ACC-016 | Accounting equation | Dashboard displays Assets = Liabilities + Equity + Net income from posted data with a check indicator. | T-103, T-208 |
| ACC-017 | Dates and ordering | Entry dates must be valid. Journal ordering is date descending, then entry number. Future dates are not restricted. | T-106, T-206 |
| ACC-018 | Deferred accounting scope | Period close, automated adjustment schedules, multi-currency conversion, exports, tax/VAT, and statutory rules remain deferred. **Stage 3 note:** the trial balance, income statement, and balance sheet are now implemented as read-only reports (REP-001..005); period close is still not implemented. | T-408, explicit deferral |

## Database (Stage 2)

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| DB-001 | SQLite location | One file at `data/accounting.sqlite`, gitignored, opened only by the backend. | T-201 |
| DB-002 | Migrations | Versioned, transactional, idempotent migrations tracked in `schema_migrations`. | T-201 |
| DB-003 | Constraints and pragmas | Foreign keys, unique/CHECK constraints, indexes; WAL, `foreign_keys=ON`, busy timeout. | T-201 |
| DB-004 | Singleton setup | Profile and workspace are singleton rows with constraints. In Stage 3 the local user is a singleton enforced by the `trg_single_local_user` trigger, and `ledger-default` holds pre-existing data. | T-201, T-203, T-401 |
| DB-005 | Atomic mutations | `BEGIN IMMEDIATE` for mutations. | T-202 |
| DB-006 | Persistence | Data survives restart; migrations preserve data. | T-302 |
| DB-007 | Database immutability | Triggers block posted-entry/line changes and enforce posting balance rules. | T-201, T-206 |
| DB-008 | Money columns | INTEGER cents only; no REAL money columns. | T-201 |
| DB-009 | Backup | Documented stopped-server file-copy backup; automated backup deferred. | T-304 (documentation) |
| DB-010 | No ORM | Prepared statements and fixed identifiers only. | T-202 |
| DB-011 | Auth and ledger schema | `users`, `ledgers`, and `sessions` tables; `ledger_id` columns on accounts, journal entries, and related rows with ledger-scoped indexes. | T-401 |
| DB-012 | Ledger isolation triggers | Triggers reject journal lines whose account belongs to a different ledger and reversal links across ledgers. | T-401, T-407 |
| DB-013 | Migration preserves legacy data | Migration `005` assigns all pre-existing rows to `ledger-default` and does not delete data. | T-401, T-413 |


## Security

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| SEC-001 | Local binding and access | Server binds `127.0.0.1` by default and refuses non-loopback hosts; container mode may bind `0.0.0.0` only with `LEDGERLINE_CONTAINER=1` and publishes the host port on loopback. The running app is gated by a local username/password (AUTH-001..008). No remote or shared access is supported. | T-203, T-303, T-402, T-409 |
| SEC-002 | SQL injection | Parameterized SQL only; no user values interpolated into SQL. | T-202 |
| SEC-003 | Server validation | Server validates all inputs; JSON-only mutations; body and field/line limits. | T-203, T-210 |
| SEC-004 | XSS and headers | Render user text as inert text (escaped interpolation or `textContent`); CSP and security headers; no inline scripts/eval. | T-101, T-210 |
| SEC-005 | Origin checks | Mutation requests validate same-origin Origin/Host. | T-210 |
| SEC-006 | Error hygiene | No stacks, SQL, or filesystem paths in responses. | T-210 |
| SEC-007 | Local file security | Restricted DB permissions; no secrets, telemetry, or external calls. | T-201, T-303 |
| SEC-008 | Dependency hygiene | Minimal locked dependencies; `npm audit` recorded. | T-210, T-303 |

## Distribution (Stage 3)

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| DIST-001 | Source and self-hosting | GitHub stores and distributes source only. Releases publish a container image and a GitHub Release. There is no public hosting, landing page, or hosted database. | T-409, T-410 |
| DIST-002 | Empty database per copy | `data/` and `.env` are git-ignored and are excluded from the container image. Every clone, image, or release starts from an empty database; existing local data is preserved locally and never uploaded. | T-409, T-410, T-413 |
| DIST-003 | Documented self-hosting | `README.md`, `Dockerfile`, `docker-compose.yml`, and `.env.example` document running from source and with Docker, plus the loopback port and password-reset command. | T-409, T-410 |

## QA

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| QA-001 | Traceability | Every requirement maps to a task and test, or has an explicit deferral. | T-003, T-213 |
| QA-002 | UI regression checks | First-run claim, sign-in/lock, ledger switching, all six pages, settings rename, mobile nav, keyboard/focus, console errors, and screenshots at 1440/768/390 px. | T-109, T-212, T-411 |
| QA-003 | Unit tests | Money conversion, balance rules, category signs, numbering, date validation. | T-211 |
| QA-004 | Integration tests | Posting, immutability, reversal, duplicate/partial posting, transaction-to-journal consistency. | T-211 |
| QA-005 | Persistence tests | Restart and migration idempotency pass, including session persistence across restart. | T-211, T-302 |
| QA-006 | Security tests | XSS strings, SQL metacharacters, oversized payloads, bad Origin, CSRF, lockout, and unauthenticated access. | T-211, T-303, T-412 |
| QA-007 | E2E critical path | Claim/sign-in → COA → transaction → draft → post → journal → adjustment → reversal → reports. | T-212, T-411 |
| QA-008 | Financial invariants | Balanced entries, balanced trial balance, zero net reversal, drafts excluded, derived dashboard totals. | T-211, T-301 |
| QA-009 | Regression | Focused regression after shared changes; full suites at gates. | T-212, T-304 |
| QA-010 | Evidence | Record exact commands, dates, results, counts, and screenshot paths. | T-109, T-301, T-304 |
| QA-011 | Honest reporting | Tests not run are never reported as passed; self-audit is labeled as such. | T-109, T-213 |
| QA-012 | Auth and ledger isolation tests | Integration covers claim, login, lockout, reset-with-session-revocation, second-ledger creation, per-ledger account codes, entry isolation, and cross-ledger account rejection. | T-411, T-412 |
| QA-013 | Report invariant tests | Integration covers adjusted vs unadjusted trial balance, linked-reversal exclusion, income statement period totals, balance-sheet balance and computed accumulated earnings, and invalid basis/date rejection. | T-412 |
| QA-014 | Distribution checks | Static checks assert the Docker image pins Node 24, runs as non-root, publishes on host loopback, and that `data/`/`.env` are ignored and excluded from the image. | T-410, T-413 |

