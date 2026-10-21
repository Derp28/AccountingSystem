import { expect } from "@playwright/test";

export const CLAIM = {
  displayName: "E2E Studio",
  username: "e2e",
  password: "correct horse battery staple",
  ledgerName: "E2E Books",
  currency: "USD",
};

export const SECOND_LEDGER = {
  name: "Second Books",
  currency: "USD",
};

export async function fillClaim(page, overrides = {}) {
  const values = { ...CLAIM, ...overrides };
  await page.locator("#claim-display-name").fill(values.displayName);
  await page.locator("#claim-username").fill(values.username);
  await page.locator("#claim-password").fill(values.password);
  await page.locator("#claim-confirm").fill(values.confirm ?? values.password);
  await page.locator("#claim-ledger-name").fill(values.ledgerName);
  await page.locator("#claim-currency").fill(values.currency);
}

export async function submitClaim(page) {
  await page.getByRole("button", { name: "Create local account" }).click();
}

export async function signIn(page, { username = CLAIM.username, password = CLAIM.password } = {}) {
  await page.locator("#login-username").fill(username);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/**
 * Claims the installation on first run, or signs in on later runs, then waits
 * for the dashboard. Keeps every spec independent of execution order.
 */
export async function ensureAuthenticated(page) {
  await page.goto("/");
  if (await page.locator("[data-claim-form]").isVisible().catch(() => false)) {
    await fillClaim(page);
    await submitClaim(page);
  } else if (await page.locator("[data-login-form]").isVisible().catch(() => false)) {
    await signIn(page);
  }
  await expect(page.getByRole("heading", { name: /Welcome back,/ })).toBeVisible();
}

/** Read the CSRF token the page already holds from the last bootstrap. */
export async function csrfToken(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/bootstrap");
    const payload = await response.json();
    return payload.auth?.csrfToken || null;
  });
}

/**
 * Call the JSON API with the browser session and the CSRF header. Playwright's
 * page.request shares cookies with the page context.
 */
export async function apiJson(page, method, path, data) {
  const token = await csrfToken(page);
  return page.request.fetch(path, {
    method,
    headers: token ? { "X-CSRF-Token": token } : {},
    ...(data === undefined ? {} : { data }),
  });
}

export async function postEntry(page, entry) {
  const created = await apiJson(page, "POST", "/api/entries", entry);
  if (!created.ok()) throw new Error(`Entry create failed with ${created.status()}`);
  const { entry: draft } = await created.json();
  const posted = await apiJson(page, "POST", `/api/entries/${draft.id}/post`, {});
  if (!posted.ok()) throw new Error(`Entry post failed with ${posted.status()}`);
  return draft;
}
