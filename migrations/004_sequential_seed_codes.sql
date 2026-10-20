-- Renumber the seeded Chart of Accounts so each category starts at its
-- hundred-series base and increments by one:
--
--   Assets      100 Cash, 101 Accounts Receivable, 102 Prepaid Expenses, 103 Equipment
--   Liabilities 200 Accounts Payable, 201 Accrued Liabilities
--   Equity      300 Owner's Equity
--   Revenue     400 Service Revenue
--   Expenses    500 Operating Expenses, 501 Rent Expense
--
-- Migration 002 remains the historical initial seed. Account IDs are stable,
-- so journal lines and other references are unaffected by this renumbering.
-- Codes 101-103, 201, and 501 are inside the category ranges enforced by 003.

UPDATE accounts SET code = '101', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'acct-110';

UPDATE accounts SET code = '102', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'acct-120';

UPDATE accounts SET code = '103', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'acct-150';

UPDATE accounts SET code = '201', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'acct-210';

UPDATE accounts SET code = '501', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'acct-510';
