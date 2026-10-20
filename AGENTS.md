# AGENTS.md — Ledgerline accounting app

## Roles

| Role | Responsibility | File ownership |
|---|---|---|
| Orchestrator | Dependencies, phase gates, integration, reporting | `AGENTS.md`, `PLANS.md`, `TASKS.yaml`, `DECISIONS.md` |
| Requirements Auditor | Coverage and ambiguity review | `REQUIREMENTS.md` (review), read-only elsewhere |
| UI Agent | Approved screens and client interactions | `public/**`, `scripts/**` |
| Backend/Accounting Agent | Persistence and accounting rules | `server/**`, `migrations/**`, `package.json` (with Orchestrator coordination) |
| QA Agent | Tests and evidence | `tests/**`, `TEST_PLAN.md`, `screenshots/**` |

## Global rules

1. The requirements registry in `REQUIREMENTS.md` is the single source of truth for acceptance criteria. Do not duplicate or weaken criteria elsewhere.
2. Every implementation task must reference requirement IDs. Every requirement must map to a task/test or an explicit deferral.
3. Stage 1 was a **UI prototype only**. Stage 2 now uses Express 5 and built-in `node:sqlite`; preserve the approved visual system and navigation unless the user approves a change.
4. Do not describe real persistence or posting as simulated. The banner must accurately describe the local database; “Reload data” only re-reads SQLite.
5. Preserve existing work. Do not delete or rewrite files outside the assigned ownership area without approval.
6. Use precise monetary arithmetic. Store integer cents; validate on the server; never use binary floating-point for money.
7. Posted entries are immutable. Corrections are reversals only. No silent edits or deletes.
8. Do not invent tax, VAT, statutory, jurisdiction-specific, or period-close rules.
9. Run focused checks after each change. Never claim a test that did not run.
10. Keep dependencies minimal: Express at runtime, Node's built-in SQLite, and Playwright as a dev-only test dependency.

## Runtime rules

- Run the app from WSL Ubuntu, not Windows Node on the UNC path.
- Node path: `/home/derp_28/.nvm/versions/node/v24.22.0/bin`.
- Project path: `/home/derp_28/accounting-app`.
- App URL: `http://127.0.0.1:3000`; default database: `data/accounting.sqlite`.
- E2E URL: `http://127.0.0.1:3100`; E2E database: `data/e2e.sqlite`.
- The server binds loopback only and refuses non-loopback `HOST` values.
- Playwright must be launched through `scripts/test-e2e.sh`, which sets the user-local browser library path.
- Back up the database only while the server is stopped; copy `data/accounting.sqlite` (and its WAL sidecars if present) to a safe location.

## Phase gates

| Gate | Condition | Status |
|---|---|---|
| G0 Discovery | Environment verified. | Passed |
| G1 UI approval | UI checks pass and the user explicitly approves the UI. | Stage 1 passed 2026-10-20; Stage 2 UI approved 2026-10-20 |
| G2 Accounting | Stage 2 posting, immutability, reversal, persistence, security, and tests pass. | Technical criteria passed; Stage 2 UI approved 2026-10-20; policies D-016, D-018, D-019, D-021 approved |
| G3 Final | Product-wide final signoff and any later-stage scope. | Passed 2026-10-20 for current Stage 2 scope; no later-stage features authorized |

## Definition of done

A task is DONE only when:

- its referenced acceptance criteria pass,
- required verification was actually executed,
- evidence is recorded in `TASKS.yaml` / `TEST_PLAN.md`,
- no blocking console errors, dead links, or misleading persistence claims remain.

## Current phase

**Final signoff — Stage 2 local accounting app.** The Stage 2 UI was approved and final product signoff was accepted on 2026-10-20. Gate 2 and Gate 3 are passed with 30 backend tests, 5 Playwright tests, 138 static/schema checks, a real process restart test, and `npm audit` at zero vulnerabilities. D-016, D-018, D-019, and the D-021 account-code auto-fill rule are approved and implemented. Later-stage feature work remains unauthorized.
