-- Starter Chart of Accounts for AAA Computer Services.
--
-- Migration 002 seeded the original chart and migration 004 renumbered it. This
-- migration replaces that seeded chart with the AAA Computer Services chart so
-- a fresh installation and an upgraded-but-empty installation start from the
-- same accounts as every newly created ledger (server/lib/seed-accounts.js).
--
-- Scope: only the ledger created by migration 005 ('ledger-default'), and only
-- while it has never recorded a journal entry. A draft counts as an entry. Any
-- ledger with entries keeps its accounts exactly as they are, so posted history
-- is never relabelled. Accounts created by the user in that empty ledger are
-- replaced as well, because the new chart owns the whole code range.
--
-- Codes stay inside the category ranges enforced by migration 003:
--   assets 100-199, liabilities 200-299, equity 300-399,
--   revenue 400-499, expenses 500-599.
-- Account 104 is a contra asset: category ASSET with a credit balance.

DELETE FROM accounts
WHERE ledger_id = 'ledger-default'
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries WHERE ledger_id = 'ledger-default'
  );

WITH chart(code, name, category, description) AS (
  VALUES
    ('100', 'Cash', 'ASSET', 'Operating bank account and cash on hand.'),
    ('101', 'Accounts Receivable', 'ASSET', 'Amounts invoiced to customers and not yet collected.'),
    ('102', 'Office Supplies', 'ASSET', 'Supplies on hand and not yet used.'),
    ('103', 'Office Equipment', 'ASSET', 'Computers, peripherals, and other equipment used in the business.'),
    ('104', 'Accumulated Depreciation - Office Equipment', 'ASSET', 'Contra asset: depreciation recorded on office equipment. Carries a credit balance and reduces office equipment.'),
    ('200', 'Accounts Payable', 'LIABILITY', 'Supplier bills received but not yet paid.'),
    ('201', 'Notes Payable', 'LIABILITY', 'Formal borrowings repayable on agreed terms.'),
    ('202', 'Unearned Computer Service Revenue', 'LIABILITY', 'Service fees collected before the work is performed.'),
    ('203', 'Salaries Payable', 'LIABILITY', 'Salaries earned by staff but not yet paid.'),
    ('204', 'Advertising Payable', 'LIABILITY', 'Advertising received but not yet paid.'),
    ('300', 'A, Capital', 'EQUITY', 'Owner''s capital: the owner''s investment in the business.'),
    ('301', 'A, Drawing', 'EQUITY', 'Owner''s withdrawals: amounts the owner takes out of the business.'),
    ('400', 'Computer Services Revenue', 'REVENUE', 'Income from computer services, support, and repairs.'),
    ('500', 'Salaries Expense', 'EXPENSE', 'Wages and salaries paid to staff.'),
    ('501', 'Advertising Expense', 'EXPENSE', 'Cost of advertising and promotions.'),
    ('502', 'Office Supplies Expense', 'EXPENSE', 'Office supplies consumed during the period.'),
    ('503', 'Depreciation Expense - Office Equipment', 'EXPENSE', 'Depreciation charged on office equipment.')
)
INSERT INTO accounts (
  id, ledger_id, code, name, category, description, active, created_at, updated_at
)
SELECT
  'acct-' || chart.code,
  'ledger-default',
  chart.code,
  chart.name,
  chart.category,
  chart.description,
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM chart
WHERE NOT EXISTS (
  SELECT 1 FROM journal_entries WHERE ledger_id = 'ledger-default'
);
