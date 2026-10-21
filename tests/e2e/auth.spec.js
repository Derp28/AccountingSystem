import { test, expect } from "@playwright/test";
import {
  CLAIM,
  SECOND_LEDGER,
  ensureAuthenticated,
  fillClaim,
  signIn,
  submitClaim,
} from "./helpers.js";

test("first run validates the form and creates the local account", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Start on a phone to prove the claim form fits without horizontal scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Create your local account" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await fillClaim(page, { password: "short", confirm: "short" });
  await submitClaim(page);
  await expect(page.locator("#claim-password-error")).toContainText("at least 12 characters");

  await page.locator("#claim-password").fill(CLAIM.password);
  await page.locator("#claim-confirm").fill("something completely different");
  await submitClaim(page);
  await expect(page.locator("#claim-confirm-error")).toContainText("do not match");

  await page.locator("#claim-ledger-name").fill("");
  await page.locator("#claim-confirm").fill(CLAIM.password);
  await submitClaim(page);
  await expect(page.locator("#claim-ledger-name-error")).toContainText("name");

  await page.locator("#claim-ledger-name").fill(CLAIM.ledgerName);
  await page.setViewportSize({ width: 1280, height: 720 });
  await submitClaim(page);
  await expect(
    page.getByRole("heading", { name: `Welcome back, ${CLAIM.displayName}` }),
  ).toBeVisible();
  await expect(page.getByText(`${CLAIM.ledgerName} · ${CLAIM.currency} workspace`)).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("locking and a wrong password are rejected before signing in again", async ({ page }) => {
  await ensureAuthenticated(page);

  await page.locator(".sidebar-lock").click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await signIn(page, { password: "definitely not the password" });
  await expect(page.locator("[data-login-error]")).toContainText("Invalid username or password");

  await signIn(page);
  await expect(page.getByRole("heading", { name: /Welcome back,/ })).toBeVisible();
});

test("a second ledger can be created and the sidebar switches between ledgers", async ({ page }) => {
  await ensureAuthenticated(page);

  const switcher = page.locator("#ledger-switcher");
  await expect(switcher.locator("option")).toHaveCount(1);

  await page.locator("[data-new-ledger]").first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator("#new-ledger-name").fill(SECOND_LEDGER.name);
  await dialog.locator("#new-ledger-currency").fill(SECOND_LEDGER.currency);
  await dialog.getByRole("button", { name: "Create ledger" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ledger created" }).last()).toBeVisible();

  await expect(page.getByText(`${SECOND_LEDGER.name} · ${SECOND_LEDGER.currency} workspace`)).toBeVisible();
  await expect(switcher.locator("option")).toHaveCount(2);

  // The new ledger still gets its own seeded Chart of Accounts.
  await page.getByRole("link", { name: "Chart of Accounts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chart of Accounts" })).toBeVisible();
  await expect(page.locator('[data-account-code="100"]')).toBeVisible();

  // Switch back to the first ledger by value.
  const firstLedgerValue = await switcher.locator("option").nth(0).getAttribute("value");
  await switcher.selectOption(firstLedgerValue);
  await expect(page.getByRole("status").filter({ hasText: "Ledger switched" }).last()).toBeVisible();

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByText(`${CLAIM.ledgerName} · ${CLAIM.currency} workspace`)).toBeVisible();
});
