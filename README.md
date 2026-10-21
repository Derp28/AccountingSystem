# Ledgerline

A local-first accounting workspace. Ledgerline runs entirely on your own machine:
an Express API, a single SQLite file, and a browser UI. There is no public
hosting, no telemetry, and no account on a remote server.

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
npm run test:e2e            # Playwright browser tests
npm run auth:reset-password -- <username>
```

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
