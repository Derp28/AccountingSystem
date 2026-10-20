import { saveProfile, saveWorkspace } from "../../server/services/setup.js";

export function setupProfileWorkspace(db, { profileName = "Test Studio", workspaceName = "Test Books", currency = "USD" } = {}) {
  saveProfile(db, { name: profileName });
  return saveWorkspace(db, { name: workspaceName, currency });
}

export function accountByCode(db, code) {
  return db.prepare("SELECT * FROM accounts WHERE code = ?").get(code);
}

export function draftPayload(overrides = {}) {
  return {
    sourceType: "SALES_INVOICE",
    date: "2026-10-15",
    memo: "Consulting invoice",
    reference: "INV-1001",
    lines: [
      { accountId: "acct-110", description: "Invoice total", debitCents: 250000, creditCents: 0 },
      { accountId: "acct-400", description: "Consulting", debitCents: 0, creditCents: 250000 },
    ],
    ...overrides,
  };
}
