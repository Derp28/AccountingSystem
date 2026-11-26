import { ValidationError } from "./errors.js";

export const MAX_AMOUNT_CENTS = 99_999_999_999;

function fail(field, message) {
  throw new ValidationError([{ field, message }]);
}

/**
 * Accept an integer number of cents. Used by the browser client and persisted rows.
 */
export function parseIntegerCents(value, field = "amount") {
  if (value === null || value === undefined || value === "") return 0;
  const text = typeof value === "number" ? String(value) : String(value).trim();
  if (!/^\d+$/.test(text)) {
    fail(field, "Amounts must be whole cents.");
  }
  const cents = Number(text);
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) {
    fail(field, "Amount is too large.");
  }
  return cents;
}

/**
 * Accept a decimal amount with at most two places and convert it exactly to cents.
 * This is intentionally string-based; no floating point arithmetic is used.
 */
export function parseDecimalToCents(value, field = "amount") {
  if (value === null || value === undefined || value === "") return 0;
  const text = typeof value === "number" ? String(value) : String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    fail(field, "Use a positive amount with at most two decimal places.");
  }
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) {
    fail(field, "Amount is too large.");
  }
  return cents;
}

export function readLineAmount(line, centsKey, decimalKey, field) {
  if (line && line[centsKey] !== undefined && line[centsKey] !== null) {
    return parseIntegerCents(line[centsKey], field);
  }
  return parseDecimalToCents(line?.[decimalKey], field);
}

export function formatCents(cents) {
  const value = Number(cents || 0) / 100;
  return value.toFixed(2);
}
