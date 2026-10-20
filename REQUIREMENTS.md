# REQUIREMENTS.md — Ledgerline

Single source of truth for requirements and acceptance criteria. Task mappings refer to `TASKS.yaml`. Deferred items are explicit and are not claimed as implemented.

## Onboarding

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| ONB-001 | First-launch onboarding gate | With no profile, the app shows a welcome/profile screen and does not expose the main application. Saving a valid profile advances to the workspace setup step; the main application is not exposed until both profile and workspace exist. | T-102, T-203 |
| ONB-002 | Profile creation | Display name is required, trimmed, 1–100 characters. Invalid input shows an inline error and sets `aria-invalid`. The name appears in the greeting and header. | T-102, T-203 |
| ONB-003 | Report/workspace naming | Immediately after profile setup, a dedicated full-screen workspace step asks for a report/workspace name. It is required, 1–80 characters, and is never described as an accounting period. | T-102, T-203 |
| ONB-004 | Persistence (Stage 2) | In Stage 2, profile and workspace names survive restart and onboarding is not repeated. Stage 1 explicitly does not persist and labels every action as simulated. | T-203, T-302 |
| ONB-005 | Rename profile/workspace | Profile and workspace names can be renamed from the header menu using the same validation. Renames persist in SQLite and survive restart. | T-102, T-203 |
| ONB-006 | Currency selection | Onboarding requires a valid currency selection. It is stored with the workspace and used for display only; blank or invalid values are rejected. | T-102, T-203 |

## User interface

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| UI-001 | Application shell and navigation | Sidebar on desktop and hamburger drawer on mobile provide Dashboard, Chart of Accounts, Business Transactions, General Journal, and Adjustments. Active state, keyboard operation, Escape-to-close, and focus return work. | T-101, T-108 |
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
| ACC-001 | Chart of Accounts rules | Five standard categories; seeded codes begin at each category base and increment by one (100–103 assets, 200–201 liabilities, 300 equity, 400 revenue, 500–501 expenses); user-created codes are unique and inside the category hundred-series range (assets 100–199, liabilities 200–299, equity 300–399, revenue 400–499, expenses 500–599); normal balance derived from category; accounts can be deactivated. | T-104, T-204, T-305 |
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
| ACC-018 | Deferred accounting scope | Formal statements, exports, period close, automated adjustment schedules, multi-currency, multi-workspace, tax/VAT, and statutory rules are deferred. | Explicit deferral |

## Database (Stage 2)

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| DB-001 | SQLite location | One file at `data/accounting.sqlite`, gitignored, opened only by the backend. | T-201 |
| DB-002 | Migrations | Versioned, transactional, idempotent migrations tracked in `schema_migrations`. | T-201 |
| DB-003 | Constraints and pragmas | Foreign keys, unique/CHECK constraints, indexes; WAL, `foreign_keys=ON`, busy timeout. | T-201 |
| DB-004 | Singleton setup | Profile and workspace are singleton rows with constraints. | T-201, T-203 |
| DB-005 | Atomic mutations | `BEGIN IMMEDIATE` for mutations. | T-202 |
| DB-006 | Persistence | Data survives restart; migrations preserve data. | T-302 |
| DB-007 | Database immutability | Triggers block posted-entry/line changes and enforce posting balance rules. | T-201, T-206 |
| DB-008 | Money columns | INTEGER cents only; no REAL money columns. | T-201 |
| DB-009 | Backup | Documented stopped-server file-copy backup; automated backup deferred. | T-304 (documentation) |
| DB-010 | No ORM | Prepared statements and fixed identifiers only. | T-202 |

## Security

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| SEC-001 | Local binding | Server binds `127.0.0.1` by default; single user, no login; local-only threat model documented. | T-203, T-303 |
| SEC-002 | SQL injection | Parameterized SQL only; no user values interpolated into SQL. | T-202 |
| SEC-003 | Server validation | Server validates all inputs; JSON-only mutations; body and field/line limits. | T-203, T-210 |
| SEC-004 | XSS and headers | Render user text as inert text (escaped interpolation or `textContent`); CSP and security headers; no inline scripts/eval. | T-101, T-210 |
| SEC-005 | Origin checks | Mutation requests validate same-origin Origin/Host. | T-210 |
| SEC-006 | Error hygiene | No stacks, SQL, or filesystem paths in responses. | T-210 |
| SEC-007 | Local file security | Restricted DB permissions; no secrets, telemetry, or external calls. | T-201, T-303 |
| SEC-008 | Dependency hygiene | Minimal locked dependencies; `npm audit` recorded. | T-210, T-303 |

## QA

| ID | Requirement | Acceptance criteria | Task |
|---|---|---|---|
| QA-001 | Traceability | Every requirement maps to a task and test, or has an explicit deferral. | T-003, T-213 |
| QA-002 | UI regression checks | Onboarding, all five pages, settings rename, mobile nav, keyboard/focus, console errors, and screenshots at 1440/768/390 px. | T-109, T-212 |
| QA-003 | Unit tests | Money conversion, balance rules, category signs, numbering, date validation. | T-211 |
| QA-004 | Integration tests | Posting, immutability, reversal, duplicate/partial posting, transaction-to-journal consistency. | T-211 |
| QA-005 | Persistence tests | Restart and migration idempotency pass. | T-211, T-302 |
| QA-006 | Security tests | XSS strings, SQL metacharacters, oversized payloads, bad Origin. | T-211, T-303 |
| QA-007 | E2E critical path | Onboarding → workspace → COA → transaction → draft → post → journal → adjustment → reversal. | T-212 |
| QA-008 | Financial invariants | Balanced entries, balanced trial balance, zero net reversal, drafts excluded, derived dashboard totals. | T-211, T-301 |
| QA-009 | Regression | Focused regression after shared changes; full suites at gates. | T-212, T-304 |
| QA-010 | Evidence | Record exact commands, dates, results, counts, and screenshot paths. | T-109, T-301, T-304 |
| QA-011 | Honest reporting | Tests not run are never reported as passed; self-audit is labeled as such. | T-109, T-213 |
