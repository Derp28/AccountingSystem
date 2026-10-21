# UI_REVIEW.md — Stage 1, Stage 2, and Stage 3 approval records

**Stage 1 status:** Approved by the user on 2026-10-20.
**Stage 2 status:** UI approved and final product signoff accepted by the user on 2026-10-20.
**Stage 3 status:** Implemented and automatically verified on 2026-10-21; **awaiting user UI review**. Not yet approved.
**Build:** Stage 3 local Express + SQLite app using the approved Stage 1/2 visual system, adding local access screens, a ledger switcher, and a Reports page.
**Reviewer:** User approved the Stage 1 and Stage 2 UI; automated evidence was produced by the implementation team.

## Launch

```bash
cd /home/derp_28/accounting-app
./scripts/dev.sh
```

Open `http://127.0.0.1:3000`.

The database is `data/accounting.sqlite`. It is created on first launch and persists across restarts. The E2E suite uses `data/e2e.sqlite` on port 3100 and must not be confused with the real local database.

## Stage 2 UI changes while preserving the approved layout

- The persistent banner now says **Saved locally**, names `data/accounting.sqlite`, states that posted entries are immutable and corrections use reversals, and offers **Reload data**.
- “Reload data” re-reads SQLite after confirmation; it deletes nothing. It replaced the ambiguous “Start over” action.
- Onboarding, dashboard, Chart of Accounts, Business Transactions, General Journal, Adjustments, settings, dialogs, toasts, and mobile navigation keep the approved ledger-paper design.
- Workspace setup is a dedicated full-screen Step 2 instead of a dialog layered over the dashboard. After profile registration the form appears immediately; at widths of 1000 px or less the decorative panel is removed and the form starts at the top of the viewport.
- Loading, empty, server-error, validation, pending, and success states now reflect real API responses.
- Posted entries expose view/reverse actions only; drafts remain editable/deletable.
- Workspace settings rename the profile/workspace and change the display currency with server validation.
- No simulated-action claims remain.

## Stage 2 automated UI evidence

Command: `bash scripts/test-e2e.sh`

Result: **5/5 passed** (critical path, settings rename, mobile navigation, XSS, screenshots). The critical path starts at 390 px, verifies that Step 2 is full-screen with no open dialog and that the setup card fits above the fold, then continues at 1280 px. See `TEST_PLAN.md` for exact coverage.

Screenshots at the required widths:

- Setup 1440×900: `screenshots/setup-1440.png`
- Setup 390×844: `screenshots/setup-390.png`
- Desktop 1440×900: `screenshots/dashboard-1440.png`, `accounts-1440.png`, `transactions-1440.png`, `journal-1440.png`, `adjustments-1440.png`
- Tablet 768×1024: `screenshots/dashboard-768.png`, `accounts-768.png`, `transactions-768.png`, `journal-768.png`, `adjustments-768.png`
- Mobile 390×844: `screenshots/dashboard-390.png`, `accounts-390.png`, `transactions-390.png`, `journal-390.png`, `adjustments-390.png`
- Mobile drawer: `screenshots/mobile-navigation-390.png`

The browser run also asserts no page errors, no page-level horizontal overflow at 390 px, Escape-to-close navigation, and that markup entered as account text renders as inert text.

## Stage 3 UI changes while preserving the approved layout

- A **first-run claim screen** replaces the Stage 2 two-step onboarding: display name, username, password (with confirmation), first ledger name, and currency. It fits a 390 px viewport with no horizontal scroll.
- A **sign-in screen** appears when the install is locked or signed out. It keeps the same ledger-paper styling and shows the local-only privacy note.
- The sidebar gains a **ledger switcher** (`Ledger` select) and a **Lock now** control. A **New ledger** action opens the existing modal pattern for name and currency.
- Settings gains **Lock now** and **Sign out** actions and renames “workspace” wording to “ledger” where it refers to the active set of books.
- A new **Reports** page (`/reports`) adds three tabs — Trial balance, Income statement, Balance sheet — with a shared **Adjusted / Unadjusted** toggle, as-of/period date inputs, and a Refresh control. All three pages keep the ledger-paper card design.
- The dashboard trial-balance card links to the Reports page.

## Stage 3 automated UI evidence

Command: `bash scripts/test-e2e.sh`

Result: **9/9 passed** (claim/sign-in/lock, ledger switching, critical path, rename, mobile navigation, reports, XSS, screenshots). The claim screen is checked at 390 px for fit and inline validation. See `TEST_PLAN.md` for exact coverage.

Screenshots at the required widths now include the Reports page:

- Desktop 1440×900: `screenshots/dashboard-1440.png`, `accounts-1440.png`, `transactions-1440.png`, `journal-1440.png`, `adjustments-1440.png`, `reports-1440.png`
- Tablet 768×1024: `screenshots/dashboard-768.png`, `accounts-768.png`, `transactions-768.png`, `journal-768.png`, `adjustments-768.png`, `reports-768.png`
- Mobile 390×844: `screenshots/dashboard-390.png`, `accounts-390.png`, `transactions-390.png`, `journal-390.png`, `adjustments-390.png`, `reports-390.png`
- Mobile drawer: `screenshots/mobile-navigation-390.png`

## Stage 3 review checklist (evidence-backed, pending user approval)

- [x] First launch shows the claim screen; a valid claim creates the account, ledger, and session.
- [x] Invalid claim input shows inline errors and `aria-invalid` (short password, mismatched confirmation, missing ledger name).
- [x] “Lock now” shows the sign-in screen (not first-run setup); a wrong password shows a generic error.
- [x] The sidebar exposes a ledger switcher and a New ledger action; switching changes the active ledger.
- [x] A new ledger receives its own seeded Chart of Accounts and starts with no entries.
- [x] The Reports page shows trial balance, income statement, and balance sheet on a shared adjusted/unadjusted toggle.
- [x] Zero-balance accounts are hidden; the balance sheet shows a computed accumulated-earnings line and a balanced indicator.
- [x] Desktop, tablet, and mobile layouts remain usable; no console errors.
- [ ] **User approval of the Stage 3 UI** — pending.

## Stage 1 approval record

- [x] **Approved for Stage 2** — the user confirmed the UI was acceptable and authorized SQLite/backend work.
- Approved by: User
- Date: 2026-10-20
- Requested change applied: use the hundreds series for account codes
  (100 Cash, 110 Accounts Receivable, 120 Prepaid Expenses, 150 Equipment,
  200 Accounts Payable, 210 Accrued Liabilities, 300 Owner's Equity,
  400 Service Revenue, 500 Operating Expenses, 510 Rent Expense).
- Stage 1 evidence: 59 static checks passed and the focused UI review was
  completed before approval.

## Stage 2 approval record

- [x] **Approved** — the user approved the Stage 2 UI on 2026-10-20 and authorized proceeding.
- [x] **Final product signoff** — the user accepted the current Stage 2 scope on 2026-10-20. No later-stage features were authorized.
- Approved by: User
- Scope: Stage 2 UI, including the full-screen Step 2 workspace setup and responsive layouts.
- Evidence: 5/5 Playwright tests, 137/137 static checks, screenshots at 1440, 768, and 390 px.
- Accounting policies D-016, D-018, and D-019 were confirmed on 2026-10-20. D-018 now enforces category hundred-series codes; see `DECISIONS.md` and migration `003_account_code_ranges.sql`.

## Post-signoff change record — sequential account codes

- Request (2026-10-20): codes increment by one within each category, starting with Cash `100` and Accounts Receivable `101`, and the next code is prefilled when adding an account.
- Implemented as `D-021`: seeded codes are now assets `100–103`, liabilities `200–201`, equity `300`, revenue `400`, expenses `500–501`; new accounts prefill the next unused code in the selected category and remain editable.
- Applied through migration `004_sequential_seed_codes.sql`. The live database migrated to schema version 4 with profile, workspace, and the ten seeded accounts preserved; no journal entries existed.
- Evidence after the change: 138/138 static checks, 30/30 backend tests, 5/5 Playwright tests including the prefilled `104`/`502` assertions.

## Stage 2 review checklist (evidence-backed)

The checklist below records the acceptance checks. Automated coverage is in `TEST_PLAN.md`; the user approved the resulting UI on 2026-10-20.

- [x] First launch shows onboarding; an existing profile/workspace skips it after restart.
- [x] After profile registration, Step 2 opens full-screen in front of the user; at 390 px the setup form starts above the fold.
- [x] Banner accurately says data is saved locally and “Reload data” deletes nothing.
- [x] Profile/workspace settings rename values and the change survives reload.
- [x] Chart of Accounts CRUD, deactivation, search, and filters work against SQLite.
- [x] A balanced transaction can be saved as a draft and posted; totals update.
- [x] An unbalanced or inactive-account entry is rejected with a clear inline error.
- [x] Journal and transactions show the same posted entry; drafts are excluded from balances.
- [x] Adjustments require a type and reason and post through the same ledger.
- [x] Posted entries cannot be edited/deleted; reversal requires a reason and is linked.
- [x] Dashboard equation and trial balance remain balanced after reversal.
- [x] Desktop, tablet, and mobile layouts remain usable; mobile drawer closes with Escape.
- [x] No console errors or misleading success messages.

## Known UI limitations

- Period close, exports, automated adjustments, tax, multi-currency conversion, and roles/sharing are not present.
- The password protects the running app, not the SQLite file; the access screen states that data-at-rest protection needs full-disk encryption.
- There is no email recovery or reset link; recovery is the offline `npm run auth:reset-password` command.
- Ledgers are separate sets of books, not a multi-user workspace.
- The dashboard is a snapshot plus trial balance, not a formal statement package; the Reports page holds the statements.
- Error states are practical server messages, not a full offline/conflict-resolution workflow.
- Screenshots are synthetic E2E data and may include a keyboard focus ring on the page heading.
- Automated accessibility coverage is targeted; no axe or screen-reader audit is claimed.
- The Stage 3 UI has not yet been approved by the user.

## Feedback

Stage 2 UI and final product scope were approved by the user on 2026-10-20. Accounting policies D-016, D-018, and D-019 were confirmed the same day; D-018 range enforcement is implemented and tested. After signoff, the user requested +1 per-category account codes; D-021 implements the sequential seed codes and editable next-code prefill, recorded above.

**Stage 3 (2026-10-21):** the user requested a local username/password login, multiple ledgers under one local account, and unadjusted/adjusted trial balance, income statement, and balance sheet, distributed as source on GitHub plus self-hosted Docker/release copies with no public hosting. That scope is implemented, documented in `DECISIONS.md` (D-022..D-031), and automatically verified. **UI approval is the outstanding gate.**
