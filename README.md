# Ledgerline

A local-first accounting workspace. Ledgerline runs entirely on your own machine:
an Express API, a single SQLite file, and a browser UI. There is no telemetry and
no account on a remote server.

**Try the interactive demo:** <https://derp28.github.io/AccountingSystem/>

The demo runs the same UI and the same validation rules in your browser. It is a
demonstration only: the sample books are generated from a real database, but
everything you change lives in the browser tab and disappears when you reload.
Nothing is saved and no request leaves the page.

## What is included

- A local username and password that locks the running app.
- One local account that can own **multiple ledgers** (separate sets of books).
- Chart of Accounts, business transactions, general journal, and manual
  adjustments. Posted entries are immutable; corrections are reversals.
- Financial reports scoped to the active ledger:
  - **Trial balance** with an **as-of** date and a net debit/credit presentation.
  - **Income statement** for a from/to period.
  - **Balance sheet** as of a date, with a computed accumulated earnings line.
  - An **Adjusted / Unadjusted** basis toggle on every report.

Adjusted reports include every posted entry. Unadjusted reports exclude
adjustment entries and the reversals linked to adjustments. Drafts are never
included, zero-balance accounts are hidden, and money is stored as integer
cents.

## Interactive demo

`npm run demo:build` writes a static copy of the app to `docs/`, which
`.github/workflows/pages.yml` publishes to the `gh-pages` branch (served by
GitHub Pages) on every push to `main`. The build:

1. Replays a set of sample books through the real services and a real SQLite
   database (claim, drafts, postings, an adjustment, a reversal, a second
   ledger) and serializes them to `demo/seed.js`.
2. Copies the untouched `public/` UI to `docs/` and points it at `demo/main.js`,
   which answers `/api/*` from `demo/api.js` instead of the network.

`demo/api.js` imports the server's own `server/lib/validation.js`, so amounts,
dates, account-code ranges, and posting rules cannot drift from the shipped app.
The demo keeps everything in memory: reloading restores the sample books, and the
sign-in screen accepts any password because no credential is checked.

GitHub Pages is static hosting, so the demo cannot run Express or SQLite. The
sentences in the demo that would otherwise claim local persistence are rewritten
by the build script, and the build fails if that wording changes.

## Requirements

- Node.js 24 or newer (for the built-in `node:sqlite` module), or Docker.
- A modern browser.

The server binds to `127.0.0.1` only. It refuses to start on a non-loopback
host unless it is running inside a container with `LEDGERLINE_CONTAINER=1`.

## Run from source

```bash
npm install
npm start
```

Then open <http://127.0.0.1:3000>. The first launch asks you to create the local
account and the first ledger. A fresh installation starts with an empty
database and a seeded Chart of Accounts.

Other commands:

```bash
npm run dev                 # same as npm start
npm run check               # static, schema, and data checks
npm test                    # unit and integration tests
npm run test:unit           # unit tests only
npm run test:e2e            # Playwright browser tests
npm run auth:reset-password -- <username>
npm run demo:build          # rebuild the static demo site in docs/
```

Every command works the same in PowerShell, a POSIX shell, WSL, and CI: the
`npm` scripts call cross-platform Node entry points in `scripts/`, which resolve
the project root from their own location. The `scripts/*.sh` files are thin
wrappers that delegate to those entry points for Linux/WSL/CI use. Playwright
needs its browser once: `npx playwright install chromium`.

### Windows

Run the commands above from the project folder with Node.js 24 or newer. Paths
with spaces (including this repository's default location) need no special
handling. Two platform notes, also recorded in `AGENTS.md`:

- A terminated server reports `signalCode` instead of `exitCode`, so tooling must
  treat either as "exited".
- `fs.chmod` only toggles the read-only attribute on Windows; NTFS ACLs, not the
  POSIX `0600` mode, protect the SQLite file.

## Run with Docker

```bash
docker compose up --build
```

Open <http://127.0.0.1:3000>. The database lives in the `ledgerline-data`
Docker volume, so it survives image upgrades.

Reset a password inside the container:

```bash
docker compose exec ledgerline node scripts/reset-password.mjs <username>
```

The published port is bound to `127.0.0.1` on the host. Do not change it to
`0.0.0.0` unless you intentionally want other machines on your network to reach
the app; doing so would make it a network service rather than a local one.

## Starter chart of accounts

Every new ledger starts with the AAA Computer Services chart, and the public
demo uses the same accounts. Codes stay inside each category's hundred series
(D-018).

| Code | Account | Category |
|---|---|---|
| 100 | Cash | Asset |
| 101 | Accounts Receivable | Asset |
| 102 | Office Supplies | Asset |
| 103 | Office Equipment | Asset |
| 104 | Accumulated Depreciation - Office Equipment | Asset (contra) |
| 200 | Accounts Payable | Liability |
| 201 | Notes Payable | Liability |
| 202 | Unearned Computer Service Revenue | Liability |
| 203 | Salaries Payable | Liability |
| 204 | Advertising Payable | Liability |
| 300 | A, Capital | Equity |
| 301 | A, Drawing | Equity |
| 400 | Computer Services Revenue | Revenue |
| 500 | Salaries Expense | Expense |
| 501 | Advertising Expense | Expense |
| 502 | Office Supplies Expense | Expense |
| 503 | Depreciation Expense - Office Equipment | Expense |

Account 104 is a **contra asset**: it is categorised as an asset but carries a
credit balance, so it reduces total assets instead of adding to them.

Migration `006_starter_chart.sql` applies this chart to the ledger created by the
first install, but only while that ledger has no journal entries. A ledger that
already contains entries keeps its accounts untouched, so posted history is never
relabelled. Rename, add, or deactivate accounts from **Chart of Accounts**.

## Multiple ledgers

After signing in, use the ledger switcher in the sidebar to move between ledgers
or to create a new one. Each ledger has its own Chart of Accounts, journal
entries, numbering sequence, and reports. Creating a ledger seeds the standard
Chart of Accounts again; it does not copy transactions from any other ledger.

## Login and sessions

- One local account per installation. There is no public sign-up.
- Passwords are stored as salted scrypt hashes. Sessions are server-side and the
  browser holds an `HttpOnly`, `SameSite=Strict` cookie.
- The session locks after 30 idle minutes and expires 12 hours after sign-in.
- Five failed sign-in attempts lock the account for 15 minutes.
- Use **Lock now** in the sidebar or settings to sign out immediately.
- There is no email recovery. `npm run auth:reset-password -- <username>` resets
  the password and revokes every active session.

## Data, backups, and privacy

- The database is a single file, by default `data/accounting.sqlite` (plus WAL
  sidecars while the server is running).
- `data/` is git-ignored. No database or personal data belongs in the
  repository, and downloaded or cloned copies always start from an empty
  database.
- To back up, stop the server and copy `data/accounting.sqlite` to a safe
  location. Copy the `-wal` and `-shm` files too if they are present.
- The password protects the running app. It does **not** encrypt the SQLite
  file. For data-at-rest protection, use full-disk encryption and keep the
  machine account locked.

## Distribution

The source lives in Git. Tagged releases publish a container image to the GitHub
Container Registry (`ghcr.io/<owner>/<repo>`) and create a GitHub Release with
generated notes. You can also clone the repository and build the image locally
with `docker build -t ledgerline .`.

## Repository layout

```
migrations/        SQLite schema and seed migrations
server/            Express app, services, routes, middleware
public/            Browser UI (vanilla ES modules)
scripts/           Check, test, dev, and reset-password scripts
tests/             Unit, integration, and Playwright tests
Dockerfile         Self-hosted container image
docker-compose.yml Local compose setup
```
