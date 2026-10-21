import { test, expect } from "@playwright/test";
import { ensureAuthenticated } from "./helpers.js";

test("markup in user text is escaped and never executed", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await ensureAuthenticated(page);

  await page.getByRole("link", { name: "Chart of Accounts", exact: true }).click();
  await page.getByRole("button", { name: /Add account/i }).first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator("#account-code").fill("598");
  await dialog
    .locator("#account-name")
    .fill('<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>');
  await dialog.locator("#account-category-input").selectOption("EXPENSE");
  await dialog.locator("#account-description").fill('<svg onload="window.__xss=3"></svg>');
  await dialog.getByRole("button", { name: "Add account", exact: true }).click();

  await expect(page.locator('[data-account-code="598"]')).toContainText("<img src=x");
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.locator('[data-account-code="598"] script')).toHaveCount(0);
  await expect(page.locator('[data-account-code="598"] svg[onload]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(pageErrors).toEqual([]);
});
