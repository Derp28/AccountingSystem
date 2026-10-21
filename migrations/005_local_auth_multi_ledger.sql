-- Local authentication and multiple ledgers.
--
-- Existing installations are preserved: migration 005 creates one unclaimed
-- local user and one ledger, then attaches the existing profile, workspace,
-- accounts, and journal entries to them. The first-run setup claims that user
-- with a username and password. A fresh installation follows the same path
-- with the seeded Chart of Accounts already attached to the default ledger.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT,
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 100),
  password_hash TEXT,
  claimed INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0, 1)),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (claimed = 0 OR (username IS NOT NULL AND password_hash IS NOT NULL))
);

CREATE UNIQUE INDEX idx_users_username_unique
  ON users (lower(username))
  WHERE username IS NOT NULL;

CREATE TRIGGER trg_single_local_user
BEFORE INSERT ON users
FOR EACH ROW
WHEN (SELECT COUNT(*) FROM users) >= 1
BEGIN
  SELECT RAISE(ABORT, 'only one local user is supported');
END;

CREATE TABLE ledgers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_ledgers_user ON ledgers (user_id, created_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  active_ledger_id TEXT REFERENCES ledgers(id),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- The legacy singleton profile/workspace rows become the first local user and
-- ledger. They remain in place for migration history but are no longer read by
-- the application.
INSERT INTO users (
  id, username, display_name, password_hash, claimed, failed_attempts,
  locked_until, created_at, updated_at
) VALUES (
  'user-local',
  NULL,
  COALESCE((SELECT name FROM profile WHERE id = 1), 'Local user'),
  NULL,
  0,
  0,
  NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

INSERT INTO ledgers (id, user_id, name, currency, created_at, updated_at)
VALUES (
  'ledger-default',
  'user-local',
  COALESCE((SELECT name FROM workspace WHERE id = 1), 'My ledger'),
  COALESCE((SELECT currency FROM workspace WHERE id = 1), 'USD'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

ALTER TABLE accounts ADD COLUMN ledger_id TEXT REFERENCES ledgers(id);
ALTER TABLE journal_entries ADD COLUMN ledger_id TEXT REFERENCES ledgers(id);

UPDATE accounts SET ledger_id = 'ledger-default' WHERE ledger_id IS NULL;
UPDATE journal_entries SET ledger_id = 'ledger-default' WHERE ledger_id IS NULL;

DROP INDEX idx_accounts_code_unique;
CREATE UNIQUE INDEX idx_accounts_ledger_code_unique
  ON accounts (ledger_id, lower(code));
CREATE INDEX idx_accounts_ledger_category ON accounts (ledger_id, category);

CREATE INDEX idx_entries_ledger_date
  ON journal_entries (ledger_id, entry_date DESC, entry_no DESC);
CREATE INDEX idx_entries_ledger_status ON journal_entries (ledger_id, status);

-- A ledger cannot be reassigned, and new rows must name their ledger.
CREATE TRIGGER trg_accounts_ledger_required
BEFORE INSERT ON accounts
FOR EACH ROW
WHEN NEW.ledger_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'account requires a ledger');
END;

CREATE TRIGGER trg_accounts_ledger_immutable
BEFORE UPDATE OF ledger_id ON accounts
FOR EACH ROW
WHEN OLD.ledger_id IS NOT NULL AND OLD.ledger_id IS NOT NEW.ledger_id
BEGIN
  SELECT RAISE(ABORT, 'account ledger cannot be changed');
END;

CREATE TRIGGER trg_entries_ledger_required
BEFORE INSERT ON journal_entries
FOR EACH ROW
WHEN NEW.ledger_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'journal entry requires a ledger');
END;

CREATE TRIGGER trg_entries_ledger_immutable
BEFORE UPDATE OF ledger_id ON journal_entries
FOR EACH ROW
WHEN OLD.ledger_id IS NOT NULL AND OLD.ledger_id IS NOT NEW.ledger_id
BEGIN
  SELECT RAISE(ABORT, 'journal entry ledger cannot be changed');
END;

-- A journal line may only use an account from the entry's ledger.
CREATE TRIGGER trg_lines_account_same_ledger_insert
BEFORE INSERT ON journal_lines
FOR EACH ROW
WHEN (SELECT ledger_id FROM accounts WHERE id = NEW.account_id)
  IS NOT (SELECT ledger_id FROM journal_entries WHERE id = NEW.entry_id)
BEGIN
  SELECT RAISE(ABORT, 'journal line account belongs to another ledger');
END;

CREATE TRIGGER trg_lines_account_same_ledger_update
BEFORE UPDATE OF entry_id, account_id ON journal_lines
FOR EACH ROW
WHEN (SELECT ledger_id FROM accounts WHERE id = NEW.account_id)
  IS NOT (SELECT ledger_id FROM journal_entries WHERE id = NEW.entry_id)
BEGIN
  SELECT RAISE(ABORT, 'journal line account belongs to another ledger');
END;

-- A reversal must stay inside the original entry's ledger.
CREATE TRIGGER trg_reversal_links_same_ledger
BEFORE INSERT ON reversal_links
FOR EACH ROW
WHEN (SELECT ledger_id FROM journal_entries WHERE id = NEW.original_entry_id)
  IS NOT (SELECT ledger_id FROM journal_entries WHERE id = NEW.reversal_entry_id)
BEGIN
  SELECT RAISE(ABORT, 'reversal entries must share a ledger');
END;
