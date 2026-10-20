-- Minimal editable Chart of Accounts using the approved hundreds series.
-- Allocation:
--   100–199 assets, 200–299 liabilities, 300–399 equity,
--   400–499 revenue, 500–599 expenses.

INSERT INTO accounts (id, code, name, category, description, active, created_at, updated_at)
VALUES
  ('acct-100', '100', 'Cash', 'ASSET', 'Operating bank account and cash on hand.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('acct-110', '110', 'Accounts Receivable', 'ASSET', 'Amounts invoiced to customers and not yet collected.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('acct-120', '120', 'Prepaid Expenses', 'ASSET', 'Costs paid in advance that will be used over time.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('acct-150', '150', 'Equipment', 'ASSET', 'Cameras, lighting, computers, and other studio equipment.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('acct-200', '200', 'Accounts Payable', 'LIABILITY', 'Supplier bills received but not yet paid.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('acct-210', '210', 'Accrued Liabilities', 'LIABILITY', 'Expenses incurred but not yet invoiced or paid.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('acct-300', '300', 'Owner''s Equity', 'EQUITY', 'The owner''s investment in the business.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('acct-400', '400', 'Service Revenue', 'REVENUE', 'Income from design, photography, and consulting work.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('acct-500', '500', 'Operating Expenses', 'EXPENSE', 'Software, supplies, insurance, and other operating costs.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('acct-510', '510', 'Rent Expense', 'EXPENSE', 'Monthly studio and workspace rent.', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO number_sequences (name, next_value) VALUES ('entry', 1);
