# AGENTS.md — Ledgerline accounting app

## Roles

| Role | Responsibility | File ownership |
|---|---|---|
| Orchestrator | Dependencies, phase gates, integration, reporting | `AGENTS.md`, `PLANS.md`, `TASKS.yaml`, `DECISIONS.md` |
| Requirements Auditor | Coverage and ambiguity review | `REQUIREMENTS.md` (review), read-only elsewhere |
| UI Agent | Approved screens and client interactions | `public/**`, `demo/**`, `scripts/build-demo.mjs` |
| Backend/Accounting Agent | Persistence and accounting rules | `server/**`, `migrations/**`, `package.json` (with Orchestrator coordination) |
| QA Agent | Tests and evidence | `tests/**`, `TEST_PLAN.md`, `screenshots/**` |

## Global rules

1. The requirements registry in `REQUIREMENTS.md` is the single source of truth for acceptance criteria. Do not duplicate or weaken criteria elsewhere.
2. Every implementation task must reference requirement IDs. Every requirement must map to a task/test or an explicit deferral.
3. Stage 1 was a **UI prototype only**. Stage 2 connected it to Express 5 and built-in `node:sqlite`; Stage 3 added local access, multiple ledgers, and reports. Preserve the approved visual system and navigation unless the user approves a change.
4. Do not describe real persistence or posting as simulated. The banner must accurately describe the local database; “Reload data” only re-reads SQLite.
5. Preserve existing work. Do not delete or rewrite files outside the assigned ownership area without approval.
6. Use precise monetary arithmetic. Store integer cents; validate on the server; never use binary floating-point for money.
7. Posted entries are immutable. Corrections are reversals only. No silent edits or deletes.
8. Do not invent tax, VAT, statutory, jurisdiction-specific, or period-close rules.
9. Run focused checks after each change. Never claim a test that did not run.
10. Keep dependencies minimal: Express at runtime, Node's built-in SQLite, and Playwright as a dev-only test dependency.

## Runtime rules

- Run the app from this project folder with Node.js 24 or newer. The canonical local runtime is Windows Node in this folder; no WSL, NVM, or hard-coded home path is required.
- Project path: `C:\Users\Chaz Vincent Aurin\Downloads\koreanbananachicken\I FUCKED UP FOLDER\accounting-app`. Paths with spaces are supported: every script resolves the project root from its own file location, never from the shell's working directory.
- Commands: `npm start` / `npm run dev`, `npm run check`, `npm test`, `npm run test:unit`, `npm run test:e2e`, `npm run auth:reset-password -- <username>`, `npm run demo:build`.
- App URL: `http://127.0.0.1:3000`; default database: `data/accounting.sqlite`.
- Public demo: <https://derp28.github.io/AccountingSystem/>, built by `.github/workflows/pages.yml` on every push to `main` and force-published to the `gh-pages` branch, which Pages serves. `npm run demo:build` writes the static site to `docs/`, which is generated output and git-ignored. The demo runs the real UI against an in-memory engine (`demo/api.js`); it cannot persist data, resets on reload, and must say so.
- E2E URL: `http://127.0.0.1:3100`; E2E database: `data/e2e.sqlite` (reset by `scripts/e2e-server.mjs` on every run).
- The server binds loopback only and refuses non-loopback `HOST` values; container mode may bind `0.0.0.0` only when `LEDGERLINE_CONTAINER=1`, and the compose file publishes the host port on `127.0.0.1` only.
- The running app is gated by a local username/password. Passwords are scrypt hashes; sessions are server-side with an `HttpOnly`, `SameSite=Strict` cookie; mutations require an `X-CSRF-Token` header; five failures lock the account for 15 minutes. There is no public registration or email recovery; use `npm run auth:reset-password -- <username>` (which revokes sessions) for recovery.
- The `scripts/*.sh` files are thin wrappers for Linux/WSL/CI that delegate to the cross-platform `scripts/*.mjs` entry points. Put behavior in the `.mjs` files so every platform stays in sync.
- Playwright must be launched through `scripts/test-e2e.mjs` (or the `npm run test:e2e` wrapper). Install the browser once with `npx playwright install chromium`; Linux hosts without sudo may unpack the shared libraries with `scripts/setup-local-browser-libs.sh`.
- Windows has no POSIX signals: a killed server exits with `signalCode` set and `exitCode` null, and `fs.chmod` only toggles the read-only bit. Tests must not assume POSIX signals or `0600` file modes.
- Back up the database only while the server is stopped; copy `data/accounting.sqlite` (and its WAL sidecars if present) to a safe location.

## Phase gates

| Gate | Condition | Status |
|---|---|---|
| G0 Discovery | Environment verified. | Passed |
| G1 UI approval | UI checks pass and the user explicitly approves the UI. | Stage 1 passed 2026-10-20; Stage 2 UI approved 2026-10-20 |
| G2 Accounting | Stage 2 posting, immutability, reversal, persistence, security, and tests pass. | Technical criteria passed; Stage 2 UI approved 2026-10-20; policies D-016, D-018, D-019, D-021 approved |
| G3 Final | Product-wide final signoff and any later-stage scope. | Passed 2026-10-20 for current Stage 2 scope; later-stage scope authorized as Stage 3 |
| G4 Stage 3 | Local access, multiple ledgers, reports, and distribution implemented and verified; UI approved by the user. | Implemented and automatically verified 2026-10-21; **UI approval pending** |
| G5 Public demo | Static GitHub Pages demo builds from the real UI and services, carries no persistence claims, and publishes on push. | Passed 2026-10-24: workflow publishes `docs/` to `gh-pages`; <https://derp28.github.io/AccountingSystem/> verified in a browser |

## Definition of done

A task is DONE only when:

- its referenced acceptance criteria pass,
- required verification was actually executed,
- evidence is recorded in `TASKS.yaml` / `TEST_PLAN.md`,
- no blocking console errors, dead links, or misleading persistence claims remain.

## Current phase

**Stage 3 implemented — local access, multiple ledgers, reports, and self-hosted distribution (pending user UI review).** Stage 2 remains the approved accounting core. Stage 3 adds a local username/password gate (scrypt, server-side sessions, CSRF, lockout, offline reset), one local account owning multiple ledgers with database isolation triggers, and a Reports page with unadjusted/adjusted trial balance, income statement, and balance sheet. Distribution is source on GitHub plus self-hosted Docker/release copies, plus a static interactive demo on GitHub Pages (D-034) that cannot persist data and says so. The runtime is localized to this folder (D-032): Windows Node 24 with no WSL/NVM dependency, cross-platform `scripts/*.mjs` entry points, and bash wrappers for Linux/CI. The starter Chart of Accounts is now the AAA Computer Services chart (D-035): 17 accounts across the five categories, with 104 Accumulated Depreciation - Office Equipment documented as a contra asset. `server/lib/seed-accounts.js` seeds it into new ledgers, and migration `006_starter_chart.sql` applies it to the migration-created ledger only while that ledger has no journal entries, so posted history is never relabelled. Automated verification on 2026-10-27 in this folder: 216 static checks, 38 backend tests, 9 Playwright tests, plus a rebuilt static demo seeded through the real services. The demo's sample transactions are placeholders (`demo/books.js`) until the user supplies the real ones. Migration 006 has not yet been applied to the live database; it applies on the next server start. Period close, exports, multi-currency, tax/VAT, and statutory rules remain deferred and unauthorized.
