# UI_REVIEW.md — Stage 1, Stage 2, and Stage 3 approval records

**Stage 1 status:** Approved by the user on 2026-10-20.
**Stage 2 status:** UI approved and final product signoff accepted by the user on 2026-10-20.
**Stage 3 status:** Implemented and automatically verified on 2026-11-02; UI review fixes applied 2026-11-04. **Awaiting user UI review. Not yet approved.**
**Build:** Stage 3 local Express + SQLite app using the approved Stage 1/2 visual system, adding local access screens, a ledger switcher, and a Reports page with the Statement of Comprehensive Income (SOCI), Statement of Owner's Equity (SOE), Statement of Financial Position (SOFP), Statement of Cash Flows (SOCF), and a supporting trial balance, plus browser print/PDF.
**Reviewer:** User approved the Stage 1 and Stage 2 UI. The implementation team produced the Stage 3 automated evidence and performed the 2026-11-04 UI review; user approval remains the gate.

## Launch

From this project folder, with Windows Node.js 24 or newer:

```powershell
npm start
```

Open `http://127.0.0.1:3000`. Use `npm run dev` for the auto-restarting development server. The app requires a local username/password; the first run shows the claim screen.

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

Command: `npm run test:e2e`

Result: **5/5 passed at the Stage 2 gate** (critical path, settings rename, mobile navigation, XSS, screenshots). The critical path starts at 390 px, verifies that Step 2 is full-screen with no open dialog and that the setup card fits above the fold, then continues at 1280 px. See `TEST_PLAN.md` for exact coverage.

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
- A new **Reports** page (`/reports`) adds five abbreviated tabs — SOCI, SOE, SOFP, SOCF, and a supporting TB — with full statement names on hover/focus and in accessible labels and headings. The four statements and the trial balance share an **Adjusted / Unadjusted** basis toggle, as-of/period date inputs, and a Refresh control, and keep the ledger-paper card design.
- **Cash-flow activity** is editable on the account form. The starter chart classifies cash accounts as cash, equipment and supplies as investing, accumulated depreciation as non-cash, and equity/notes as financing.
- The live app prints the active statement or all four statements through the browser's **Print / Save as PDF** dialog, with a letterhead and without application chrome.
- The public demo at <https://derp28.github.io/AccountingSystem/> runs the same UI against an in-memory engine. It cannot persist data, resets on reload, says so, and shows a labeled simulated PDF preview instead of creating a file.
- The dashboard trial-balance card links to the Reports page.

## Stage 3 automated UI evidence

Command: `npm run test:e2e`

Result: **9/9 passed** (claim/sign-in/lock, ledger switching, critical path, rename, mobile navigation, reports, XSS, screenshots). The claim screen is checked at 390 px for fit and inline validation. The 2026-11-04 run also passed **232/232 static checks** and **41/41 backend tests** after the review fixes. See `TEST_PLAN.md` for exact coverage.

The 2026-11-04 UI review found and fixed two presentation defects in the live UI:

- The report status chip was light-on-light on the statement cards; it now uses dark green ink on a light green pill (computed `rgb(31, 77, 58)` on `rgb(226, 238, 230)`), with a red variant for a failed check.
- The mobile drawer's close button sat beneath the persistent banner at scroll top; the drawer and its backdrop now layer above the banner, so the close button is visible and clickable, and the drawer still closes with Escape.

The report body is now exposed as a labelled `tabpanel` (`role="tabpanel"`, `aria-labelledby` pointing at the active tab). The demo was rebuilt and the screenshots were regenerated; no page errors were recorded.

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
- [x] The Reports page shows the Statement of Comprehensive Income (SOCI), Statement of Owner's Equity (SOE), Statement of Financial Position (SOFP), Statement of Cash Flows (SOCF), and a supporting trial balance on a shared adjusted/unadjusted toggle.
- [x] Report tabs show only SOCI/SOE/SOFP/SOCF/TB; hovering or keyboard-focusing a tab shows the full statement name, and full names are used in accessible labels and statement headings.
- [x] The report body is a labelled `tabpanel` linked to the active tab.
- [x] Report status chips are readable on the light statement cards, including the long “Ties to the balance sheet” label.
- [x] The live app prints the active statement or all four statements through the browser's Print / Save as PDF dialog, with a letterhead and without application chrome.
- [x] The public demo's PDF action opens a clearly labeled simulated preview with a disabled Save as PDF button and says that no file is created or downloaded.
- [x] Cash-flow activity is editable on the account form; the starter chart classifies equipment and supplies as investing, cash accounts as cash, and depreciation as non-cash.
- [x] Zero-balance accounts are hidden; the SOFP shows a computed accumulated-earnings line and a balanced indicator.
- [x] Desktop, tablet, and mobile layouts remain usable; the mobile drawer's close button is reachable at scroll top; no console errors.
- [ ] **User approval of the Stage 3 UI** — pending.

### Minor observations (non-blocking)

- The demo repeats its non-persistence notice in the demo banner and the sidebar, and retains a small “Local” pill. The wording is accurate but could be tightened in a later polish pass.
- Report tabs support Tab/Shift+Tab and Enter/Space, but not arrow-key roving focus.
- The Reports page still opens on the supporting trial balance by default, preserving the Stage 2 landing state; the four statements are one click away.

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
- Report tabs do not implement arrow-key roving focus; Tab/Shift+Tab and Enter/Space work, and the report body is a labelled tabpanel.
- The Stage 3 UI has not yet been approved by the user; this review records the fixes and evidence for the user's decision.

## Feedback

Stage 2 UI and final product scope were approved by the user on 2026-10-20. Accounting policies D-016, D-018, and D-019 were confirmed the same day; D-018 range enforcement is implemented and tested. After signoff, the user requested +1 per-category account codes; D-021 implements the sequential seed codes and editable next-code prefill, recorded above.

**Stage 3 (2026-10-21, extended 2026-11-02):** the user requested a local username/password login, multiple ledgers under one local account, the four adjusted/unadjusted financial statements plus a supporting trial balance, browser print/PDF, and self-hosted distribution. That scope is implemented, documented in `DECISIONS.md` (D-022..D-038), and automatically verified. The public demo is deployed at <https://derp28.github.io/AccountingSystem/>.

**Stage 3 UI review (2026-11-04):** the implementation team reviewed the live app and the demo at desktop, tablet, and mobile widths. The review fixed the report-chip contrast and the mobile drawer close-button layering, added tabpanel semantics, rebuilt the demo, and reran 232 static checks, 41 backend tests, and 9 Playwright tests. **User approval of the Stage 3 UI is the outstanding gate.**
