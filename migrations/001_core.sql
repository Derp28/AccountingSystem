-- Core accounting schema. Money is always an integer number of cents.

CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE workspace (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  category TEXT NOT NULL CHECK (category IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 200),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_accounts_code_unique ON accounts (lower(code));
CREATE INDEX idx_accounts_category ON accounts (category);

CREATE TABLE number_sequences (
  name TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL CHECK (next_value >= 1)
);

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  entry_no TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'SALES_INVOICE', 'PURCHASE_BILL', 'CASH_RECEIPT', 'CASH_PAYMENT', 'GENERAL_JOURNAL', 'ADJUSTMENT'
  )),
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'POSTED')),
  entry_date TEXT NOT NULL CHECK (
    entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  memo TEXT NOT NULL CHECK (length(memo) <= 500),
  reference TEXT CHECK (reference IS NULL OR length(reference) <= 80),
  adjustment_type TEXT CHECK (
    adjustment_type IS NULL OR adjustment_type IN (
      'ACCRUED_EXPENSE', 'ACCRUED_REVENUE', 'PREPAID_EXPENSE', 'DEPRECIATION', 'OTHER'
    )
  ),
  adjustment_reason TEXT CHECK (adjustment_reason IS NULL OR length(adjustment_reason) <= 300),
  client_request_id TEXT,
  reversal_of_entry_id TEXT REFERENCES journal_entries(id),
  reversal_reason TEXT CHECK (reversal_reason IS NULL OR length(reversal_reason) <= 300),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  posted_at TEXT,
  CHECK (status <> 'POSTED' OR posted_at IS NOT NULL),
  CHECK (status <> 'DRAFT' OR posted_at IS NULL),
  CHECK (reversal_of_entry_id IS NULL OR reversal_reason IS NOT NULL)
);

CREATE UNIQUE INDEX idx_entries_client_request ON journal_entries (client_request_id)
  WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX idx_entries_reversal_of ON journal_entries (reversal_of_entry_id)
  WHERE reversal_of_entry_id IS NOT NULL;
CREATE INDEX idx_entries_date ON journal_entries (entry_date DESC, entry_no DESC);
CREATE INDEX idx_entries_status ON journal_entries (status);

CREATE TABLE journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL CHECK (line_no >= 1),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 200),
  debit_cents INTEGER NOT NULL DEFAULT 0 CHECK (
    typeof(debit_cents) = 'integer' AND debit_cents >= 0
  ),
  credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (
    typeof(credit_cents) = 'integer' AND credit_cents >= 0
  ),
  CHECK (debit_cents = 0 OR credit_cents = 0),
  UNIQUE (entry_id, line_no)
);

CREATE INDEX idx_lines_entry ON journal_lines (entry_id);
CREATE INDEX idx_lines_account ON journal_lines (account_id);

CREATE TABLE reversal_links (
  original_entry_id TEXT PRIMARY KEY REFERENCES journal_entries(id),
  reversal_entry_id TEXT NOT NULL UNIQUE REFERENCES journal_entries(id),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 300),
  created_at TEXT NOT NULL
);

-- Posted entries are append-only at the database layer.
CREATE TRIGGER trg_entries_immutable_update
BEFORE UPDATE ON journal_entries
FOR EACH ROW
WHEN OLD.status = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'posted entry is immutable');
END;

CREATE TRIGGER trg_entries_immutable_delete
BEFORE DELETE ON journal_entries
FOR EACH ROW
WHEN OLD.status = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'posted entry is immutable');
END;

CREATE TRIGGER trg_lines_immutable_insert
BEFORE INSERT ON journal_lines
FOR EACH ROW
WHEN (SELECT status FROM journal_entries WHERE id = NEW.entry_id) = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'posted entry lines are immutable');
END;

CREATE TRIGGER trg_lines_immutable_update
BEFORE UPDATE ON journal_lines
FOR EACH ROW
WHEN (SELECT status FROM journal_entries WHERE id = OLD.entry_id) = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'posted entry lines are immutable');
END;

CREATE TRIGGER trg_lines_immutable_delete
BEFORE DELETE ON journal_lines
FOR EACH ROW
WHEN (SELECT status FROM journal_entries WHERE id = OLD.entry_id) = 'POSTED'
BEGIN
  SELECT RAISE(ABORT, 'posted entry lines are immutable');
END;

-- Posting is only allowed when the stored lines are complete and balanced.
CREATE TRIGGER trg_entries_posting_rules
BEFORE UPDATE ON journal_entries
FOR EACH ROW
WHEN OLD.status = 'DRAFT' AND NEW.status = 'POSTED'
BEGIN
  SELECT CASE
    WHEN length(trim(NEW.memo)) = 0
    THEN RAISE(ABORT, 'posting requires a memo')
  END;
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM journal_lines WHERE entry_id = NEW.id) < 2
    THEN RAISE(ABORT, 'posting requires at least two lines')
  END;
  SELECT CASE
    WHEN (SELECT COALESCE(SUM(debit_cents), 0) FROM journal_lines WHERE entry_id = NEW.id) = 0
    THEN RAISE(ABORT, 'posting requires a non-zero amount')
  END;
  SELECT CASE
    WHEN (SELECT COALESCE(SUM(debit_cents), 0) FROM journal_lines WHERE entry_id = NEW.id)
      <> (SELECT COALESCE(SUM(credit_cents), 0) FROM journal_lines WHERE entry_id = NEW.id)
    THEN RAISE(ABORT, 'posting requires balanced debits and credits')
  END;
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM journal_lines
      WHERE entry_id = NEW.id AND debit_cents > 0 AND credit_cents > 0
    )
    THEN RAISE(ABORT, 'a posting line must have one side')
  END;
  SELECT CASE
    WHEN NEW.source_type = 'ADJUSTMENT' AND (
      NEW.adjustment_type IS NULL OR length(trim(COALESCE(NEW.adjustment_reason, ''))) = 0
    )
    THEN RAISE(ABORT, 'adjustments require a type and reason')
  END;
END;

-- Reversal links are append-only and must point at a valid posted original.
CREATE TRIGGER trg_reversal_links_valid
BEFORE INSERT ON reversal_links
FOR EACH ROW
WHEN (SELECT status FROM journal_entries WHERE id = NEW.original_entry_id) <> 'POSTED'
  OR (SELECT reversal_of_entry_id FROM journal_entries WHERE id = NEW.original_entry_id) IS NOT NULL
  OR (SELECT status FROM journal_entries WHERE id = NEW.reversal_entry_id) <> 'POSTED'
  OR (SELECT reversal_of_entry_id FROM journal_entries WHERE id = NEW.reversal_entry_id) IS NOT NEW.original_entry_id
BEGIN
  SELECT RAISE(ABORT, 'invalid reversal target');
END;

CREATE TRIGGER trg_reversal_links_immutable_update
BEFORE UPDATE ON reversal_links
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'reversal links are immutable');
END;

CREATE TRIGGER trg_reversal_links_immutable_delete
BEFORE DELETE ON reversal_links
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'reversal links are immutable');
END;
