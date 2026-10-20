-- D-018: user-created account codes must stay inside their category's
-- hundred series. Server validation returns a field-level message; these
-- triggers keep the same rule true for any direct database write.
--
--   100-199 assets, 200-299 liabilities, 300-399 equity,
--   400-499 revenue, 500-599 expenses.

CREATE TRIGGER IF NOT EXISTS accounts_code_range_insert
BEFORE INSERT ON accounts
FOR EACH ROW
WHEN NOT (NEW.code GLOB '[0-9][0-9][0-9]')
  OR CAST(NEW.code AS INTEGER) NOT BETWEEN
    CASE NEW.category
      WHEN 'ASSET' THEN 100
      WHEN 'LIABILITY' THEN 200
      WHEN 'EQUITY' THEN 300
      WHEN 'REVENUE' THEN 400
      WHEN 'EXPENSE' THEN 500
    END
    AND CASE NEW.category
      WHEN 'ASSET' THEN 199
      WHEN 'LIABILITY' THEN 299
      WHEN 'EQUITY' THEN 399
      WHEN 'REVENUE' THEN 499
      WHEN 'EXPENSE' THEN 599
    END
BEGIN
  SELECT RAISE(ABORT, 'account code is outside its category hundred series');
END;

CREATE TRIGGER IF NOT EXISTS accounts_code_range_update
BEFORE UPDATE OF code, category ON accounts
FOR EACH ROW
WHEN NOT (NEW.code GLOB '[0-9][0-9][0-9]')
  OR CAST(NEW.code AS INTEGER) NOT BETWEEN
    CASE NEW.category
      WHEN 'ASSET' THEN 100
      WHEN 'LIABILITY' THEN 200
      WHEN 'EQUITY' THEN 300
      WHEN 'REVENUE' THEN 400
      WHEN 'EXPENSE' THEN 500
    END
    AND CASE NEW.category
      WHEN 'ASSET' THEN 199
      WHEN 'LIABILITY' THEN 299
      WHEN 'EQUITY' THEN 399
      WHEN 'REVENUE' THEN 499
      WHEN 'EXPENSE' THEN 599
    END
BEGIN
  SELECT RAISE(ABORT, 'account code is outside its category hundred series');
END;
