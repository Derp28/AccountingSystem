import { test, expect } from "@playwright/test";
import { ensureAuthenticated, postEntry } from "./helpers.js";

test("reports page renders the four statements, the trial balance, and print output", async ({
  page,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await ensureAuthenticated(page);

  // June 2026 activity: cash and accrual entries exercise every statement.
  await postEntry(page, {
    sourceType: "GENERAL_JOURNAL",
    date: "2026-06-01",
    memo: "Owner investment",
    lines: [
      { accountId: "acct-100", description: "Cash", debitCents: 1000000, creditCents: 0 },
      { accountId: "acct-300", description: "Capital", debitCents: 0, creditCents: 1000000 },
    ],
  });
  await postEntry(page, {
    sourceType: "CASH_PAYMENT",
    date: "2026-06-05",
    memo: "Office equipment",
    lines: [
      { accountId: "acct-103", description: "Equipment", debitCents: 400000, creditCents: 0 },
      { accountId: "acct-100", description: "Cash", debitCents: 0, creditCents: 400000 },
    ],
  });
  await postEntry(page, {
    sourceType: "CASH_RECEIPT",
    date: "2026-06-15",
    memo: "Cash services",
    lines: [
      { accountId: "acct-100", description: "Cash", debitCents: 300000, creditCents: 0 },
      { accountId: "acct-400", description: "Revenue", debitCents: 0, creditCents: 300000 },
    ],
  });
  await postEntry(page, {
    sourceType: "SALES_INVOICE",
    date: "2026-06-20",
    memo: "Reports sale",
    lines: [
      { accountId: "acct-101", description: "Invoice", debitCents: 200000, creditCents: 0 },
      { accountId: "acct-400", description: "Revenue", debitCents: 0, creditCents: 200000 },
    ],
  });
  await postEntry(page, {
    sourceType: "CASH_PAYMENT",
    date: "2026-06-25",
    memo: "Salaries paid",
    lines: [
      { accountId: "acct-500", description: "Salaries", debitCents: 50000, creditCents: 0 },
      { accountId: "acct-100", description: "Cash", debitCents: 0, creditCents: 50000 },
    ],
  });
  await postEntry(page, {
    sourceType: "CASH_PAYMENT",
    date: "2026-06-28",
    memo: "Owner drawing",
    lines: [
      { accountId: "acct-301", description: "Drawing", debitCents: 30000, creditCents: 0 },
      { accountId: "acct-100", description: "Cash", debitCents: 0, creditCents: 30000 },
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

  // Tabs show abbreviations, while the full statement names are exposed to
  // assistive technology and to the hover/focus tooltip.
  const tabs = page.locator("[data-report-tab]");
  await expect(tabs).toHaveCount(5);
  await expect(tabs).toHaveText(["SOCI", "SOE", "SOFP", "SOCF", "TB"]);
  const tabNames = {
    "income-statement": "Statement of Comprehensive Income",
    "owner-equity": "Statement of Owner's Equity",
    "balance-sheet": "Statement of Financial Position",
    "cash-flows": "Statement of Cash Flows",
    "trial-balance": "Trial Balance (supporting schedule)",
  };
  for (const [tab, name] of Object.entries(tabNames)) {
    const button = page.locator(`[data-report-tab="${tab}"]`);
    await expect(button).toHaveAttribute("aria-label", name);
    await expect(button).toHaveAttribute("data-tooltip", name);
  }
  const sociTab = page.locator('[data-report-tab="income-statement"]');
  await sociTab.hover();
  await expect
    .poll(() => sociTab.evaluate((element) => getComputedStyle(element, "::after").opacity))
    .toBe("1");
  expect(
    await sociTab.evaluate((element) => getComputedStyle(element, "::after").content),
  ).toContain("Statement of Comprehensive Income");

  // Trial balance stays available as the supporting schedule.
  await expect(page.getByTestId("report-trial-balance")).toBeVisible();
  await expect(page.getByTestId("report-trial-balance")).toContainText("Adjusted basis");
  await page.locator("[data-report-asof]").fill("2026-06-30");
  await page.locator("[data-refresh-report]").click();
  await expect(page.getByTestId("report-trial-balance")).toContainText("as of 2026-06-30");
  await expect(page.getByTestId("report-trial-balance")).toContainText("Advertising Expense");
  await expect(page.getByTestId("report-trial-balance")).toContainText("Balanced");

  // The unadjusted basis excludes the 30 June adjustment.
  await page.locator("[data-report-basis]").selectOption("unadjusted");
  await expect(page.getByTestId("report-trial-balance")).toContainText("Unadjusted basis");
  await expect(page.getByTestId("report-trial-balance")).not.toContainText("Advertising Expense");
  await page.locator("[data-report-basis]").selectOption("adjusted");
  await expect(page.getByTestId("report-trial-balance")).toContainText("Adjusted basis");

  // SOCI: revenue 5,000 - expenses 1,500 = net income 3,500.
  await sociTab.click();
  await expect(page.getByTestId("report-income-statement")).toBeVisible();
  await page.locator("[data-report-from]").fill("2026-06-01");
  await page.locator("[data-report-to]").fill("2026-06-30");
  await page.locator("[data-refresh-report]").click();
  await expect(page.getByTestId("report-income-statement")).toContainText(
    "2026-06-01 to 2026-06-30",
  );
  await expect(page.getByTestId("report-net-income")).toContainText("3,500.00");
  await expect(page.getByTestId("report-income-statement")).toContainText("5,000.00");
  await expect(page.getByTestId("report-income-statement")).toContainText("1,500.00");

  // SOE: 0 + 10,000 + 3,500 - 300 = 13,200.
  await page.locator('[data-report-tab="owner-equity"]').click();
  await expect(page.getByTestId("report-owner-equity")).toBeVisible();
  await expect(page.getByTestId("report-owner-equity")).toContainText("Ties to the balance sheet");
  await expect(page.getByTestId("report-ending-capital")).toContainText("13,200.00");

  // SOFP: 14,200 assets = 1,000 liabilities + 13,200 equity.
  await page.locator('[data-report-tab="balance-sheet"]').click();
  await expect(page.getByTestId("report-financial-position")).toBeVisible();
  await page.locator("[data-report-asof]").fill("2026-06-30");
  await page.locator("[data-refresh-report]").click();
  await expect(page.getByTestId("report-financial-position")).toContainText("as of 2026-06-30");
  await expect(page.getByTestId("report-financial-position")).toContainText(
    "Assets = liabilities + equity",
  );
  await expect(page.getByTestId("report-total-liabilities-equity")).toContainText("14,200.00");

  // SOCF: operating 2,500 - investing 4,000 + financing 9,700 = 8,200 cash.
  await page.locator('[data-report-tab="cash-flows"]').click();
  await expect(page.getByTestId("report-cash-flows")).toBeVisible();
  await expect(page.getByTestId("report-cash-flows")).toContainText(
    "2026-06-01 to 2026-06-30",
  );
  await expect(page.getByTestId("report-cash-flows")).toContainText("Reconciles to Cash");
  await expect(page.getByTestId("report-cash-flows")).toContainText("2,500.00");
  await expect(page.getByTestId("report-cash-flows")).toContainText(/\(.*4,000\.00\)/);
  await expect(page.getByTestId("report-cash-flows")).toContainText("9,700.00");
  await expect(page.getByTestId("report-net-change")).toContainText("8,200.00");
  await expect(page.getByTestId("report-ending-cash")).toContainText("8,200.00");

  // The live app's Download PDF path uses the browser print dialog.
  await sociTab.click();
  await expect(page.getByTestId("report-income-statement")).toBeVisible();
  await page.evaluate(() => {
    window.__printCalls = 0;
    window.print = () => {
      window.__printCalls += 1;
    };
  });
  await page.getByRole("button", { name: /Print \/ Save as PDF/ }).click();
  expect(await page.evaluate(() => window.__printCalls)).toBe(1);

  // Print media hides the application chrome and shows the letterhead and the
  // full statement name; the browser can turn that layout into a real PDF.
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar").first()).toHaveCSS("display", "none");
  await expect(page.locator(".print-letterhead").first()).toBeVisible();
  await expect(page.locator(".statement-card h2").first()).toContainText(
    "Statement of Comprehensive Income",
  );
  await expect(page.locator(".statement-abbr").first()).toBeHidden();
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  await page.emulateMedia({ media: "screen" });

  // Print all creates a temporary four-statement sheet for the browser's
  // print dialog. The dialog itself is stubbed so the test never blocks.
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole("button", { name: /Print all/ }).click();
  await expect(page.locator("#print-all")).toBeVisible();
  await expect(page.locator("#print-all .statement-card")).toHaveCount(4);
  await expect(page.locator("#print-all")).toContainText("Statement of Cash Flows");
  await page.evaluate(() => {
    document.getElementById("print-all")?.remove();
    document.body.classList.remove("is-print-all");
  });

  expect(pageErrors).toEqual([]);
});
