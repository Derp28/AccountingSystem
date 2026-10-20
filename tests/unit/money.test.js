import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_AMOUNT_CENTS,
  parseDecimalToCents,
  parseIntegerCents,
  readLineAmount,
} from "../../server/lib/money.js";

test("decimal input converts exactly to integer cents", () => {
  assert.equal(parseDecimalToCents("12.34"), 1234);
  assert.equal(parseDecimalToCents("0.10"), 10);
  assert.equal(parseDecimalToCents("9"), 900);
  assert.equal(parseDecimalToCents(25.5), 2550);
  assert.equal(parseDecimalToCents(""), 0);
});

test("decimal input rejects more than two places and negatives", () => {
  assert.throws(() => parseDecimalToCents("12.345"), /at most two decimal places/);
  assert.throws(() => parseDecimalToCents("-1.00"), /at most two decimal places/);
  assert.throws(() => parseDecimalToCents("abc"), /at most two decimal places/);
});

test("integer cents are validated and bounded", () => {
  assert.equal(parseIntegerCents(1234), 1234);
  assert.equal(parseIntegerCents("250000"), 250000);
  assert.throws(() => parseIntegerCents(12.5), /whole cents/);
  assert.throws(() => parseIntegerCents("12.34"), /whole cents/);
  assert.throws(() => parseIntegerCents(String(MAX_AMOUNT_CENTS + 1)), /too large/);
});

test("readLineAmount prefers integer cents and falls back to decimals", () => {
  assert.equal(readLineAmount({ debitCents: 500 }, "debitCents", "debit", "line"), 500);
  assert.equal(readLineAmount({ debit: "5.00" }, "debitCents", "debit", "line"), 500);
  assert.equal(readLineAmount({}, "debitCents", "debit", "line"), 0);
});
