import { test, expect } from "@playwright/test";
import { ensureAuthenticated, postEntry } from "./helpers.js";

test("reports page renders all three statements and toggles the basis", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await ensureAuthenticated(page);

  await postEntry(page, {
    sourceType: "SALES_INVOICE",
    date: "2026-06-15",
    memo: "Reports sale",
    lines: [
      { accountId: "acct-101", description: "Invoice", debitCents: 300000, creditCents: 0 },
      { accountId: "acct-400", description: "Revenue", debitCents: 0, creditCents: 300000 },
    ],
  });
  await postEntry(page, {
    sourceType: "ADJUSTMENT",
    date: "2026-06-30",
    memo: "Reports adjustment",
    adjustmentType: "OTHER",
    adjustmentReason: "Covers the report test period.",
    lines: [
      { accountId: "acct-501", description: "Advertising", debitCents: 100000, creditCents: 0 },
      { accountId: "acct-204", description: "Advertising payable", debitCents: 0, creditCents: 100000 },
    ],
  });

  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Financial statements" })).toBeVisible();

  // Trial balance defaults to the adjusted basis.
  await expect(page.getByTestId("report-trial-balance")).toBeVisible();
  await expect(page.getByTestId("report-trial-balance")).toContainText("Adjusted basis");

  // Widen the as-of window so the seeded dates are always in range.
  await page.locator("[data-report-asof]").fill("2026-12-31");
  await page.locator("[data-refresh-report]").click();
  await expect(page.getByTestId("report-trial-balance")).toContainText("as of 2026-12-31");
  // The adjustment appears on the adjusted basis.
  await expect(page.getByTestId("report-trial-balance")).toContainText("Advertising Expense");

  // Switching to the unadjusted basis excludes the adjustment.
  await page.locator("[data-report-basis]").selectOption("unadjusted");
  await expect(page.getByTestId("report-trial-balance")).toContainText("Unadjusted basis");
  await expect(page.getByTestId("report-trial-balance")).not.toContainText("Advertising Expense");
  await page.locator("[data-report-basis]").selectOption("adjusted");
  await expect(page.getByTestId("report-trial-balance")).toContainText("Adjusted basis");

  // Income statement for the June period.
  await page.locator('[data-report-tab="income-statement"]').click();
  await expect(page.getByTestId("report-income-statement")).toBeVisible();
  await page.locator("[data-report-from]").fill("2026-06-01");
  await page.locator("[data-report-to]").fill("2026-06-30");
  await page.locator("[data-refresh-report]").click();
  await expect(page.getByTestId("report-income-statement")).toContainText("2026-06-01 to 2026-06-30");
  await expect(page.getByTestId("report-net-income")).toBeVisible();
  await expect(page.getByText("Computer Services Revenue").first()).toBeVisible();

  // Balance sheet with the computed accumulated earnings line.
  await page.locator('[data-report-tab="balance-sheet"]').click();
  await expect(page.getByTestId("report-balance-sheet")).toBeVisible();
  await page.locator("[data-report-asof]").fill("2026-12-31");
  await page.locator("[data-refresh-report]").click();
  await expect(page.getByTestId("report-balance-sheet")).toContainText("Accumulated earnings");
  await expect(page.getByTestId("report-balance-sheet")).toContainText(
    "Assets = liabilities + equity",
  );

  expect(pageErrors).toEqual([]);
});
