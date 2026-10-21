import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { apiJson, ensureAuthenticated, postEntry } from "./helpers.js";

const screenshotDir = path.resolve("screenshots");

async function ensureSetup(page) {
  await ensureAuthenticated(page);
  await apiJson(page, "PUT", "/api/profile", { name: "Ledgerline Studio" });
  await apiJson(page, "PUT", "/api/workspace", { name: "Studio books 2026", currency: "USD" });
  await page.reload();
  await expect(page.getByRole("heading", { name: /Welcome back, Ledgerline Studio/i })).toBeVisible();
}

async function ensureSampleData(page) {
  const bootstrap = await (await page.request.get("/api/bootstrap")).json();
  if (bootstrap.dashboard.counts.postedEntries === 0) {
    await postEntry(page, {
      sourceType: "SALES_INVOICE",
      date: "2026-10-18",
      memo: "Brand identity package — Harbor & Co.",
      reference: "INV-1042",
      lines: [
        { accountId: "acct-110", description: "Invoice total", debitCents: 480000, creditCents: 0 },
        { accountId: "acct-400", description: "Brand identity package", debitCents: 0, creditCents: 480000 },
      ],
    });
  }

  const refreshed = await (await page.request.get("/api/bootstrap")).json();
  if (!refreshed.entries.some((entry) => entry.sourceType === "ADJUSTMENT")) {
    await postEntry(page, {
      sourceType: "ADJUSTMENT",
      date: "2026-10-19",
      memo: "Accrue October studio rent",
      adjustmentType: "ACCRUED_EXPENSE",
      adjustmentReason: "October rent was not invoiced before month end.",
      lines: [
        { accountId: "acct-510", description: "October rent", debitCents: 95000, creditCents: 0 },
        { accountId: "acct-210", description: "Accrued rent", debitCents: 0, creditCents: 95000 },
      ],
    });
  }
}

const pages = [
  { slug: "dashboard", heading: /Welcome back/i },
  { slug: "accounts", heading: "Chart of Accounts" },
  { slug: "transactions", heading: "Business Transactions" },
  { slug: "journal", heading: "General Journal" },
  { slug: "adjustments", heading: "Adjustments" },
  { slug: "reports", heading: "Financial statements" },
];

test("capture Stage 3 screenshots at 1440, 768, and 390 px", async ({ page }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(screenshotDir, { recursive: true });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await ensureSetup(page);
  await ensureSampleData(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
  await page.evaluate(() => document.querySelectorAll(".toast-close").forEach((button) => button.click()));
  await expect(page.locator("dialog[open]")).toHaveCount(0);

  for (const viewport of [
    { width: 1440, height: 900, key: "1440" },
    { width: 768, height: 1024, key: "768" },
    { width: 390, height: 844, key: "390" },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const view of pages) {
      await page.goto(`/#/${view.slug}`);
      await expect(page.getByRole("heading", { name: view.heading }).first()).toBeVisible();
      if (view.slug === "reports") {
        await expect(page.locator('[data-testid^="report-"]').first()).toBeVisible();
      }
      await page.waitForFunction(
        () => getComputedStyle(document.querySelector(".page")).opacity === "1",
      );
      await page.evaluate(() => document.activeElement?.blur());
      await page.screenshot({
        path: path.join(screenshotDir, `${view.slug}-${viewport.key}.png`),
        fullPage: true,
      });
    }

    if (viewport.key === "390") {
      await page.goto("/#/dashboard");
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(page.getByRole("link", { name: "Adjustments", exact: true })).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(screenshotDir, "mobile-navigation-390.png"),
        fullPage: false,
      });
      await page.keyboard.press("Escape");
    }
  }

  expect(pageErrors).toEqual([]);
});
