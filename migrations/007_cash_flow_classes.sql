-- Cash-flow classification for the Statement of Cash Flows.
--
-- Every account carries one class:
--   CASH       the account holds cash (a bank account or cash on hand)
--   OPERATING  customers, suppliers, rent, salaries, and utilities
--   INVESTING  equipment and supplies (the owner's rule; supplies can be
--              changed to operating per account in the Chart of Accounts)
--   FINANCING  owner capital, drawings, and loan proceeds/payments
--   NON_CASH   balance-sheet movements that never touch cash, such as
--              accumulated depreciation
--
-- Existing rows default to OPERATING. The starter chart is classified
-- explicitly below. New accounts default to OPERATING (equity to FINANCING)
-- in server/lib/validation.js and can be changed on the account form.
--
-- Matching on code and name keeps a user's custom account with a reused code
-- from being reclassified. The old pre-006 chart is covered too, so an
-- installation that kept its original accounts still gets sensible defaults.

ALTER TABLE accounts ADD COLUMN cash_flow_class TEXT NOT NULL DEFAULT 'OPERATING'
  CHECK (cash_flow_class IN ('CASH', 'OPERATING', 'INVESTING', 'FINANCING', 'NON_CASH'));

UPDATE accounts SET cash_flow_class = 'CASH'
WHERE code = '100' AND name = 'Cash';

UPDATE accounts SET cash_flow_class = 'INVESTING'
WHERE code = '102' AND name = 'Office Supplies';

UPDATE accounts SET cash_flow_class = 'INVESTING'
WHERE code = '103' AND name IN ('Office Equipment', 'Equipment');

UPDATE accounts SET cash_flow_class = 'NON_CASH'
WHERE code = '104' AND name = 'Accumulated Depreciation - Office Equipment';

UPDATE accounts SET cash_flow_class = 'FINANCING'
WHERE code = '201' AND name = 'Notes Payable';

UPDATE accounts SET cash_flow_class = 'FINANCING'
WHERE code = '300' AND name IN ('A, Capital', 'Owner''s Equity');

UPDATE accounts SET cash_flow_class = 'FINANCING'
WHERE code = '301' AND name = 'A, Drawing';
