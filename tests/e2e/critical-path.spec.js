import { test, expect } from "@playwright/test";

test("critical path: onboarding, COA, transaction, post, journal, adjustment, reversal, restart", async ({
  page,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Start on mobile to prove Step 2 appears in front, above the fold, rather
  // than being appended below the page.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome to Ledgerline" })).toBeVisible();

  // Profile and workspace onboarding.
  await page.locator("#profile-name").fill("E2E Studio");
  await page.getByRole("button", { name: /Continue to workspace/i }).click();
  const setupCard = page.locator(".onboarding-form-card");
  await expect(setupCard).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const setupBox = await setupCard.boundingBox();
  expect(setupBox).not.toBeNull();
  expect(setupBox.y).toBeGreaterThanOrEqual(0);
  expect(setupBox.y + setupBox.height).toBeLessThanOrEqual(844);
  await page.locator("#setup-workspace-name").fill("E2E Books");
  await page.locator("#setup-currency").fill("USD");
  await page.getByRole("button", { name: /Open workspace/i }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole("heading", { name: /Welcome back, E2E Studio/i })).toBeVisible();
  await expect(page.getByText("E2E Books · USD workspace")).toBeVisible();

  // Chart of accounts uses the approved hundreds series and survives a reload.
  await page.getByRole("link", { name: "Chart of Accounts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Chart of Accounts" })).toBeVisible();
  for (const code of ["100", "101", "102", "103", "200", "201", "300", "400", "500", "501"]) {
    await expect(page.locator(`[data-account-code="${code}"]`)).toBeVisible();
  }

  await page.getByRole("button", { name: /Add account/i }).first().click();
  let dialog = page.locator("dialog[open]");
  await expect(dialog.locator("#account-code")).toHaveValue("104");
  await dialog.locator("#account-name").fill("Software subscriptions");
  await dialog.locator("#account-category-input").selectOption("EXPENSE");
  await expect(dialog.locator("#account-code")).toHaveValue("502");
  await dialog.locator("#account-code").fill("520");
  await dialog.locator("#account-category-input").selectOption("ASSET");
  await dialog.getByRole("button", { name: "Add account", exact: true }).click();
  await expect(dialog.locator("#account-code-error")).toContainText(
    "Asset codes must be between 100 and 199.",
  );
  await dialog.locator("#account-category-input").selectOption("EXPENSE");
  await dialog.locator("#account-description").fill("Monthly tools");
  await dialog.getByRole("button", { name: "Add account", exact: true }).click();
  await expect(page.locator('[data-account-code="520"]')).toBeVisible();

  // Create a sales invoice draft.
  await page.getByRole("link", { name: "Business Transactions", exact: true }).click();
  await page.getByRole("button", { name: /New transaction/i }).click();
  dialog = page.locator("dialog[open]");
  await dialog.locator("#entry-memo").fill("E2E sale");
  await dialog.locator("#entry-reference").fill("INV-E2E");
  const saleRows = dialog.locator(".line-row");
  await expect(saleRows).toHaveCount(2);
  await saleRows.nth(0).locator("[data-line-debit]").fill("150.00");
  await saleRows.nth(1).locator("[data-line-credit]").fill("150.00");
  await dialog.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draft saved" }).last()).toBeVisible();
  await expect(page.locator("[data-transaction-row]").filter({ hasText: "E2E sale" })).toBeVisible();

  // Post the sale and confirm it appears in the shared journal.
  await page
    .locator("[data-transaction-row]")
    .filter({ hasText: "E2E sale" })
    .getByRole("button", { name: /Open/ })
    .click();
  await page.getByRole("button", { name: /Post entry/ }).click();
  await page.locator("dialog[open]").locator("[data-confirm]").click();
  await expect(page.getByText("Entry posted")).toBeVisible();

  await page.getByRole("link", { name: "General Journal", exact: true }).click();
  const journalRow = page.locator("[data-journal-row]").filter({ hasText: "E2E sale" });
  await expect(journalRow).toBeVisible();
  await expect(journalRow).toContainText("SI-");

  // Create and post a manual adjustment with a type and reason.
  await page.getByRole("link", { name: "Adjustments", exact: true }).click();
  await page.getByRole("button", { name: /New adjustment/i }).first().click();
  dialog = page.locator("dialog[open]");
  await dialog.locator("#entry-memo").fill("Accrue October rent");
  await dialog.locator("#entry-adjustment-type").selectOption("ACCRUED_EXPENSE");
  await dialog.locator("#entry-adjustment-reason").fill("October rent not yet invoiced");
  const adjustmentRows = dialog.locator(".line-row");
  await expect(adjustmentRows).toHaveCount(2);
  await adjustmentRows.nth(0).locator("[data-line-account]").selectOption("acct-510");
  await adjustmentRows.nth(0).locator("[data-line-debit]").fill("500.00");
  await adjustmentRows.nth(1).locator("[data-line-account]").selectOption("acct-210");
  await adjustmentRows.nth(1).locator("[data-line-credit]").fill("500.00");
  await dialog.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draft saved" }).last()).toBeVisible();

  await page
    .locator("[data-adjustment-card]")
    .filter({ hasText: "Accrue October rent" })
    .getByRole("button", { name: /Open/ })
    .click();
  await page.getByRole("button", { name: /Post entry/ }).click();
  await page.locator("dialog[open]").locator("[data-confirm]").click();
  await expect(page.getByRole("status").filter({ hasText: "Entry posted" }).last()).toBeVisible();

  // Reopen the adjustment and reverse it with a reason.
  await page
    .locator("[data-adjustment-card]")
    .filter({ hasText: "Accrue October rent" })
    .getByRole("button", { name: /Open/ })
    .click();
  await page.getByRole("button", { name: /Reverse entry/ }).click();
  dialog = page.locator("dialog[open]");
  await dialog.locator("[data-reversal-reason]").fill("Rent was invoiced in November");
  await dialog.getByRole("button", { name: /Create reversal/i }).click();
  await expect(page.getByText("Reversal created")).toBeVisible();

  // Reload to prove the data came from SQLite, not browser memory.
  await page.reload();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Welcome back, E2E Studio/i })).toBeVisible();
  await page.getByRole("link", { name: "General Journal", exact: true }).click();
  await expect(page.locator("[data-journal-row]").filter({ hasText: "E2E sale" })).toBeVisible();
  await expect(
    page.locator('[data-journal-row][data-type="ADJUSTMENT"]').filter({ hasText: "Accrue October rent" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-journal-row][data-type="GENERAL_JOURNAL"]').filter({ hasText: "Reversal of" }),
  ).toBeVisible();
  await expect(
    page.locator('[data-journal-row][data-type="ADJUSTMENT"]').filter({ hasText: "ADJ-000002" }),
  ).toContainText("Reversed");

  // The dashboard is derived from posted lines after the reversal nets to zero.
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page.getByTestId("trial-balance")).toBeVisible();
  await expect(page.getByText("Accounting equation balances")).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("profile and workspace renames persist across a reload", async ({ page }) => {
  await page.goto("/");
  if (await page.locator("#profile-name").isVisible().catch(() => false)) {
    await page.locator("#profile-name").fill("Rename Studio");
    await page.getByRole("button", { name: /Continue to workspace/i }).click();
    await page.locator("#setup-workspace-name").fill("Rename Books");
    await page.locator("#setup-currency").fill("USD");
    await page.getByRole("button", { name: /Open workspace/i }).click();
  }

  await page.locator("[data-open-settings]").click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator("#settings-profile-name").fill("Renamed Studio");
  await dialog.locator("#settings-workspace-name").fill("Renamed Books 2026");
  await dialog.locator("#settings-currency").fill("USD");
  await dialog.getByRole("button", { name: /Save changes/i }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: /Welcome back, Renamed Studio/i })).toBeVisible();
  await expect(page.getByText("Renamed Books 2026 · USD workspace")).toBeVisible();
});

test("mobile navigation opens, closes with Escape, and keeps the layout usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  // The web server is shared with the critical-path test, which normally leaves
  // a saved profile behind. Support a fresh database too.
  if (await page.locator("#profile-name").isVisible().catch(() => false)) {
    await page.locator("#profile-name").fill("Mobile Studio");
    await page.getByRole("button", { name: /Continue to workspace/i }).click();
    await page.locator("#setup-workspace-name").fill("Mobile Books");
    await page.locator("#setup-currency").fill("USD");
    await page.getByRole("button", { name: /Open workspace/i }).click();
  }

  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  await expect(page.getByRole("link", { name: "Chart of Accounts", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  await menu.click();
  await page.getByRole("link", { name: "General Journal", exact: true }).click();
  await expect(page.getByRole("heading", { name: "General Journal" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

