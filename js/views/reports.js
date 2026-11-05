import { api } from "../api.js";
import { escapeHtml, qs } from "../dom.js";
import { formatDateTime, formatMoney } from "../format.js";
import { icon } from "../icons.js";
import { pageHeader } from "../components/ui.js";
import { openModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";

/**
 * The four financial statements plus the trial balance, which stays as a
 * supporting schedule. Tabs show only the abbreviation; the full name is in
 * the accessible label and in a CSS tooltip on hover and keyboard focus.
 */
const TABS = [
  {
    id: "income-statement",
    label: "SOCI",
    name: "Statement of Comprehensive Income",
    tooltip: "Statement of Comprehensive Income",
  },
  {
    id: "owner-equity",
    label: "SOE",
    name: "Statement of Owner's Equity",
    tooltip: "Statement of Owner's Equity",
  },
  {
    id: "balance-sheet",
    label: "SOFP",
    name: "Statement of Financial Position",
    tooltip: "Statement of Financial Position",
  },
  {
    id: "cash-flows",
    label: "SOCF",
    name: "Statement of Cash Flows",
    tooltip: "Statement of Cash Flows",
  },
  {
    id: "trial-balance",
    label: "TB",
    name: "Trial Balance",
    tooltip: "Trial Balance (supporting schedule)",
  },
];

const PERIOD_TABS = new Set(["income-statement", "owner-equity", "cash-flows"]);
const STATEMENT_TABS = ["income-statement", "owner-equity", "balance-sheet", "cash-flows"];

function isDemoMode() {
  return Boolean(window.__LEDGERLINE_DEMO__);
}

function basisLabel(basis) {
  return basis === "unadjusted" ? "Unadjusted" : "Adjusted";
}

function basisHelp(basis) {
  return basis === "unadjusted"
    ? "Excludes adjustment entries and the reversals linked to adjustments."
    : "Includes every posted entry, including adjustments.";
}

function balancedChip(balanced, label = "Balanced") {
  return `
    <span class="check-chip ${balanced ? "" : "is-bad"}">
      ${icon(balanced ? "check-circle" : "alert-circle", 15)}
      ${balanced ? escapeHtml(label) : "Needs review"}
    </span>
  `;
}

function emptyRows(columns, message) {
  return `<tr><td colspan="${columns}" class="table-empty">${escapeHtml(message)}</td></tr>`;
}

/**
 * Statement-style money: negative amounts use parentheses rather than a minus
 * sign, which is the convention for printed financial statements.
 */
function statementMoney(cents, currency) {
  const value = Number.isFinite(cents) ? Math.round(cents) : 0;
  return value < 0
    ? `(${formatMoney(Math.abs(value), currency)})`
    : formatMoney(value, currency);
}

function statementMeta(ledgerName, generatedAt) {
  return {
    ledgerName: ledgerName || "Active ledger",
    generatedLabel: `Generated ${formatDateTime(generatedAt)}`,
  };
}

function statementCard({ testId, title, abbr, subtitle, chip = "", body, footer = "", meta }) {
  return `
    <section class="card statement-card" data-testid="${testId}">
      <div class="print-only print-letterhead">
        <span class="print-letterhead-brand">Ledgerline</span>
        <span class="print-letterhead-ledger">${escapeHtml(meta.ledgerName)}</span>
        <span class="print-letterhead-meta">${escapeHtml(meta.generatedLabel)}</span>
      </div>
      <div class="card-header">
        <div>
          <h2 class="card-title">${escapeHtml(title)} <span class="statement-abbr">${escapeHtml(
            abbr,
          )}</span></h2>
          <p class="card-subtitle">${escapeHtml(subtitle)}</p>
        </div>
        ${chip}
      </div>
      ${body}
      ${footer ? `<div class="card-footer">${footer}</div>` : ""}
    </section>
  `;
}

function accountAmountRows(rows, currency) {
  if (!rows.length) return emptyRows(2, "No activity in this section.");
  return rows
    .map(
      (row) => `
        <tr>
          <td data-label="Account">
            <span class="account-code">${escapeHtml(row.account.code)}</span>
            <span class="account-name">${escapeHtml(row.account.name)}</span>
          </td>
          <td class="num" data-label="Amount">${escapeHtml(
            statementMoney(row.amountCents, currency),
          )}</td>
        </tr>
      `,
    )
    .join("");
}

function reportSection(title, rows, totalLabel, totalCents, currency) {
  return `
    <div class="report-section">
      <h3 class="report-section-title">${escapeHtml(title)}</h3>
      <div class="table-wrap">
        <table class="data-table responsive-table statement-table">
          <tbody>${accountAmountRows(rows, currency)}</tbody>
          <tfoot><tr><td class="strong">${escapeHtml(totalLabel)}</td><td class="num strong">${escapeHtml(
            statementMoney(totalCents, currency),
          )}</td></tr></tfoot>
        </table>
      </div>
    </div>
  `;
}

function trialBalanceHtml(data, currency, meta) {
  const rows = data.rows.length
    ? data.rows
        .map(
          (row) => `
            <tr>
              <td data-label="Account">
                <span class="account-code">${escapeHtml(row.account.code)}</span>
                <span class="account-name">${escapeHtml(row.account.name)}</span>
              </td>
              <td class="num" data-label="Debit">${
                row.debitCents ? escapeHtml(formatMoney(row.debitCents, currency)) : "—"
              }</td>
              <td class="num" data-label="Credit">${
                row.creditCents ? escapeHtml(formatMoney(row.creditCents, currency)) : "—"
              }</td>
            </tr>
          `,
        )
        .join("")
    : emptyRows(3, "No posted activity through this date.");

  return statementCard({
    testId: "report-trial-balance",
    title: "Trial Balance",
    abbr: "TB",
    subtitle: `Supporting schedule · ${basisLabel(data.basis)} basis · as of ${data.asOf}. ${basisHelp(
      data.basis,
    )}`,
    meta,
    chip: balancedChip(data.balanced),
    body: `
      <div class="table-wrap">
        <table class="data-table responsive-table statement-table">
          <caption class="sr-only">Trial balance</caption>
          <thead>
            <tr><th scope="col">Account</th><th scope="col" class="num">Debit</th><th scope="col" class="num">Credit</th></tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td class="strong">Totals</td>
              <td class="num strong" data-label="Debit">${escapeHtml(
                formatMoney(data.totalDebitCents, currency),
              )}</td>
              <td class="num strong" data-label="Credit">${escapeHtml(
                formatMoney(data.totalCreditCents, currency),
              )}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `,
    footer: `<span class="help">Difference: <strong>${escapeHtml(
      formatMoney(data.differenceCents, currency),
    )}</strong></span>`,
  });
}

function incomeStatementHtml(data, currency, meta) {
  return statementCard({
    testId: "report-income-statement",
    title: "Statement of Comprehensive Income",
    abbr: "SOCI",
    subtitle: `${basisLabel(data.basis)} basis · ${data.from} to ${data.to}. ${basisHelp(
      data.basis,
    )}`,
    meta,
    body: `
      ${reportSection("Revenue", data.revenueRows, "Total revenue", data.totalRevenueCents, currency)}
      ${reportSection("Expenses", data.expenseRows, "Total expenses", data.totalExpensesCents, currency)}
      <div class="report-total">
        <span>Net income <span class="report-formula">Revenue − Expenses</span></span>
        <strong class="num" data-testid="report-net-income">${escapeHtml(
          statementMoney(data.netIncomeCents, currency),
        )}</strong>
      </div>
    `,
    footer: `<span class="help">Revenue − Expenses = Net income. This ledger has no other comprehensive income items, so comprehensive income equals net income.</span>`,
  });
}

function sublineRows(rows, currency, negate = false) {
  return rows
    .map(
      (row) => `
        <tr class="report-subline">
          <td>
            <span class="account-code">${escapeHtml(row.account.code)}</span>
            <span class="account-name">${escapeHtml(row.account.name)}</span>
          </td>
          <td class="num">${escapeHtml(
            statementMoney(negate ? -row.amountCents : row.amountCents, currency),
          )}</td>
        </tr>
      `,
    )
    .join("");
}

function ownerEquityHtml(data, currency, meta) {
  const investmentSubRows = sublineRows(data.investmentRows, currency);
  const withdrawalSubRows = sublineRows(data.withdrawalRows, currency, true);
  return statementCard({
    testId: "report-owner-equity",
    title: "Statement of Owner's Equity",
    abbr: "SOE",
    subtitle: `${basisLabel(data.basis)} basis · ${data.from} to ${data.to}. ${basisHelp(
      data.basis,
    )}`,
    meta,
    chip: balancedChip(data.balanced, "Ties to the balance sheet"),
    body: `
      <div class="table-wrap">
        <table class="data-table responsive-table statement-table">
          <caption class="sr-only">Statement of Owner's Equity</caption>
          <tbody>
            <tr>
              <td>Owner's capital, beginning of period</td>
              <td class="num">${escapeHtml(statementMoney(data.beginningCapitalCents, currency))}</td>
            </tr>
            <tr>
              <td>Add: additional investments</td>
              <td class="num">${escapeHtml(statementMoney(data.additionalInvestmentsCents, currency))}</td>
            </tr>
            ${investmentSubRows}
            <tr>
              <td>Add: net income (loss)</td>
              <td class="num">${escapeHtml(statementMoney(data.netIncomeCents, currency))}</td>
            </tr>
            <tr>
              <td>Less: withdrawals</td>
              <td class="num">${escapeHtml(
                data.withdrawalsCents
                  ? statementMoney(-data.withdrawalsCents, currency)
                  : statementMoney(0, currency),
              )}</td>
            </tr>
            ${withdrawalSubRows}
          </tbody>
          <tfoot>
            <tr>
              <td class="strong">Owner's capital, end of period</td>
              <td class="num strong" data-testid="report-ending-capital">${escapeHtml(
                statementMoney(data.endingCapitalCents, currency),
              )}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `,
    footer: `<span class="help">Owner's capital + additional investments + net income − withdrawals = ending capital. Beginning capital includes all posted earnings before the period; this app does not close the books.</span>`,
  });
}

function financialPositionHtml(data, currency, meta) {
  const equityRows = [
    ...data.equityRows,
    {
      account: { code: "—", name: "Accumulated earnings (computed)" },
      amountCents: data.accumulatedEarningsCents,
    },
  ];
  return statementCard({
    testId: "report-financial-position",
    title: "Statement of Financial Position",
    abbr: "SOFP",
    subtitle: `${basisLabel(data.basis)} basis · as of ${data.asOf}. ${basisHelp(data.basis)}`,
    meta,
    chip: balancedChip(data.balanced, "Assets = liabilities + equity"),
    body: `
      ${reportSection("Assets", data.assetRows, "Total assets", data.totalAssetsCents, currency)}
      ${reportSection(
        "Liabilities",
        data.liabilityRows,
        "Total liabilities",
        data.totalLiabilitiesCents,
        currency,
      )}
      ${reportSection("Equity", equityRows, "Total equity", data.totalEquityCents, currency)}
      <div class="report-total">
        <span>Total liabilities + equity</span>
        <strong class="num" data-testid="report-total-liabilities-equity">${escapeHtml(
          statementMoney(data.totalLiabilitiesAndEquityCents, currency),
        )}</strong>
      </div>
    `,
    footer: `<span class="help">Assets = Liabilities + Owner's equity. Difference: <strong>${escapeHtml(
      formatMoney(data.differenceCents, currency),
    )}</strong></span>`,
  });
}

function cashFlowSection(title, rows, totalCents, currency) {
  return `
    <div class="report-section">
      <h3 class="report-section-title">${escapeHtml(title)}</h3>
      <div class="table-wrap">
        <table class="data-table responsive-table statement-table">
          <tbody>${accountAmountRows(rows, currency)}</tbody>
          <tfoot><tr><td class="strong">Net cash from ${escapeHtml(
            title.toLowerCase(),
          )}</td><td class="num strong">${escapeHtml(
            statementMoney(totalCents, currency),
          )}</td></tr></tfoot>
        </table>
      </div>
    </div>
  `;
}

function cashFlowsHtml(data, currency, meta) {
  return statementCard({
    testId: "report-cash-flows",
    title: "Statement of Cash Flows",
    abbr: "SOCF",
    subtitle: `${basisLabel(data.basis)} basis · ${data.from} to ${data.to}. ${basisHelp(
      data.basis,
    )}`,
    meta,
    chip: balancedChip(data.reconciled, "Reconciles to Cash"),
    body: `
      ${cashFlowSection("Operating activities", data.operatingRows, data.operatingCents, currency)}
      ${cashFlowSection("Investing activities", data.investingRows, data.investingCents, currency)}
      ${cashFlowSection("Financing activities", data.financingRows, data.financingCents, currency)}
      <div class="report-total">
        <span>Net increase (decrease) in cash</span>
        <strong class="num" data-testid="report-net-change">${escapeHtml(
          statementMoney(data.netChangeCents, currency),
        )}</strong>
      </div>
      <div class="report-section">
        <h3 class="report-section-title">Cash reconciliation</h3>
        <div class="table-wrap">
          <table class="data-table responsive-table statement-table">
            <tbody>
              <tr>
                <td>Cash at beginning of period</td>
                <td class="num">${escapeHtml(statementMoney(data.beginningCashCents, currency))}</td>
              </tr>
              <tr>
                <td>Net increase (decrease) in cash</td>
                <td class="num">${escapeHtml(statementMoney(data.netChangeCents, currency))}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td class="strong">Cash at end of period</td>
                <td class="num strong" data-testid="report-ending-cash">${escapeHtml(
                  statementMoney(data.endingCashCents, currency),
                )}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `,
    footer: `<span class="help">Operating + investing + financing = net change in cash. Cash at end agrees with the Cash account balance: <strong>${escapeHtml(
      formatMoney(data.cashBalanceCents, currency),
    )}</strong> (difference ${escapeHtml(
      formatMoney(data.differenceCents, currency),
    )}). Transfers between cash accounts are excluded.</span>`,
  });
}

function renderStatement(tab, data, currency, meta) {
  switch (tab) {
    case "income-statement":
      return incomeStatementHtml(data, currency, meta);
    case "owner-equity":
      return ownerEquityHtml(data, currency, meta);
    case "balance-sheet":
      return financialPositionHtml(data, currency, meta);
    case "cash-flows":
      return cashFlowsHtml(data, currency, meta);
    default:
      return trialBalanceHtml(data, currency, meta);
  }
}

async function fetchReport(filters) {
  const basis = filters.basis;
  switch (filters.tab) {
    case "income-statement":
      return api.incomeStatement({ from: filters.from, to: filters.to, basis });
    case "owner-equity":
      return api.ownerEquity({ from: filters.from, to: filters.to, basis });
    case "balance-sheet":
      return api.balanceSheet({ asOf: filters.asOf, basis });
    case "cash-flows":
      return api.cashFlows({ from: filters.from, to: filters.to, basis });
    default:
      return api.trialBalance({ asOf: filters.asOf, basis });
  }
}

async function allStatements(filters) {
  return Promise.all(
    STATEMENT_TABS.map(async (tab) => ({
      tab,
      data: await fetchReport({ ...filters, tab }),
    })),
  );
}

function slugify(value) {
  return (
    String(value || "ledger")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ledger"
  );
}

function openPdfPreview(entries, { ledgerName, currency }) {
  const stamp = entries[0]?.data?.to || entries[0]?.data?.asOf || "";
  const filePart =
    entries.length === 1 ? entries[0].tab : "financial-statements";
  const filename = `${slugify(ledgerName)}-${filePart}${stamp ? `-${stamp}` : ""}.pdf`;
  const meta = statementMeta(ledgerName, new Date().toISOString());
  const content = `
    <div class="pdf-preview" data-testid="pdf-preview">
      <div class="pdf-preview-toolbar">
        <span class="pdf-preview-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="pdf-preview-filename">${escapeHtml(filename)}</span>
        <span class="pdf-preview-badge">Simulated preview</span>
      </div>
      <div class="pdf-preview-scroll">
        ${entries
          .map(
            ({ tab, data }, index) => `
              <div class="pdf-preview-page">
                <div class="pdf-preview-sheet">${renderStatement(tab, data, currency, meta)}</div>
                <div class="pdf-preview-page-number">Page ${index + 1} of ${entries.length}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
    <p class="pdf-preview-note">${icon("info", 16)} <span>Demo only: this is a simulated PDF preview. No file is created or downloaded. In the self-hosted app, <strong>Print / Save as PDF</strong> opens your browser's print dialog.</span></p>
  `;
  openModal({
    title: "PDF preview",
    eyebrow: "Demo only",
    description: "A preview of the screen your browser would show before saving a PDF.",
    content,
    footer: `
      <button class="btn btn-secondary" type="button" data-close-preview>Close preview</button>
      <button class="btn btn-primary" type="button" disabled title="The demo cannot create files.">${icon(
        "save",
        15,
      )} Save as PDF</button>
    `,
    size: "modal-wide",
    onMount(dialog, close) {
      qs("[data-close-preview]", dialog)?.addEventListener("click", close);
    },
  });
}

function controlsHtml(filters) {
  const isPeriod = PERIOD_TABS.has(filters.tab);
  return `
    <section class="card report-controls" aria-label="Report options">
      <div class="report-tabs" role="tablist" aria-label="Financial statements">
        ${TABS.map(
          (tab) => `
            <button class="report-tab ${filters.tab === tab.id ? "is-active" : ""}" type="button"
              id="report-tab-${tab.id}" role="tab" aria-selected="${filters.tab === tab.id}"
              aria-label="${escapeHtml(tab.tooltip)}" aria-controls="report-body"
              data-tooltip="${escapeHtml(tab.tooltip)}" data-report-tab="${tab.id}">
              ${escapeHtml(tab.label)}
            </button>
          `,
        ).join("")}
      </div>
      <div class="report-filters">
        ${
          isPeriod
            ? `
              <div class="field report-date">
                <label class="label" for="report-from">From</label>
                <input class="input" id="report-from" type="date" value="${escapeHtml(
                  filters.from,
                )}" data-report-from />
              </div>
              <div class="field report-date">
                <label class="label" for="report-to">To</label>
                <input class="input" id="report-to" type="date" value="${escapeHtml(
                  filters.to,
                )}" data-report-to />
              </div>
            `
            : `
              <div class="field report-date">
                <label class="label" for="report-asof">As of</label>
                <input class="input" id="report-asof" type="date" value="${escapeHtml(
                  filters.asOf,
                )}" data-report-asof />
              </div>
            `
        }
        <div class="field report-basis">
          <label class="label" for="report-basis">Basis</label>
          <select class="select" id="report-basis" data-report-basis>
            <option value="adjusted" ${filters.basis === "adjusted" ? "selected" : ""}>Adjusted</option>
            <option value="unadjusted" ${filters.basis === "unadjusted" ? "selected" : ""}>Unadjusted</option>
          </select>
        </div>
        <button class="btn btn-secondary" type="button" data-refresh-report>${icon(
          "refresh",
          15,
        )} Refresh</button>
      </div>
    </section>
  `;
}

async function printAll(container, filters, ledgerName, currency) {
  const button = qs("[data-print-all]", container);
  const original = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span> Preparing…`;
  }
  try {
    const entries = await allStatements(filters);
    if (isDemoMode()) {
      openPdfPreview(entries, { ledgerName, currency });
      return;
    }
    const meta = statementMeta(ledgerName, new Date().toISOString());
    const sheet = document.createElement("div");
    sheet.id = "print-all";
    sheet.className = "print-all";
    sheet.innerHTML = entries
      .map(({ tab, data }) => renderStatement(tab, data, currency, meta))
      .join("");
    document.body.appendChild(sheet);
    document.body.classList.add("is-print-all");
    const cleanup = () => {
      sheet.remove();
      document.body.classList.remove("is-print-all");
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    setTimeout(cleanup, 60000);
  } catch (error) {
    showToast(
      "Could not prepare the printout",
      error?.message || "The statements could not be loaded.",
      "error",
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = original;
    }
  }
}

export function renderReports(container, state) {
  const currency = state.workspace?.currency || "USD";
  const ledgerName = state.workspace?.name || "Active ledger";
  const demo = isDemoMode();
  const filters = { ...state.reports };

  container.innerHTML = `
    <div class="page reports-page" data-page="reports">
      ${pageHeader({
        title: "Financial statements",
        description: demo
          ? `Unadjusted and adjusted statements for ${ledgerName} in ${currency}. Reports use posted entries only and are calculated in this browser tab.`
          : `Unadjusted and adjusted statements for ${ledgerName} in ${currency}. Reports use posted entries only and are calculated in your browser.`,
        actions: `
          <button class="btn btn-secondary" type="button" data-print-report>${icon(
            demo ? "save" : "printer",
            16,
          )} ${demo ? "Download PDF" : "Print / Save as PDF"}</button>
          <button class="btn btn-secondary" type="button" data-print-all>${icon(
            "printer",
            16,
          )} ${demo ? "Preview all" : "Print all"}</button>
        `,
      })}
      <div data-report-controls>${controlsHtml(filters)}</div>
      ${
        demo
          ? `<p class="report-demo-note">${icon(
              "info",
              15,
            )} <span>Demo only: PDF previews are simulated; no file is created or downloaded.</span></p>`
          : ""
      }
      <div id="report-body" role="tabpanel" tabindex="0"
        aria-labelledby="report-tab-${filters.tab}" aria-live="polite">
        <div class="card report-loading">Loading report…</div>
      </div>
    </div>
  `;

  const controls = qs("[data-report-controls]", container);
  const body = qs("#report-body", container);
  let loadSequence = 0;

  function readControls() {
    const basis = qs("[data-report-basis]", controls)?.value || filters.basis;
    const asOf = qs("[data-report-asof]", controls)?.value || filters.asOf;
    const from = qs("[data-report-from]", controls)?.value || filters.from;
    const to = qs("[data-report-to]", controls)?.value || filters.to;
    return { basis, asOf, from, to };
  }

  async function load() {
    Object.assign(filters, readControls());
    state.reports = { ...filters };
    const sequence = ++loadSequence;
    body.innerHTML = `<div class="card report-loading">Loading report…</div>`;
    try {
      const data = await fetchReport(filters);
      if (!body.isConnected || sequence !== loadSequence) return;
      body.innerHTML = renderStatement(
        filters.tab,
        data,
        currency,
        statementMeta(ledgerName, new Date().toISOString()),
      );
    } catch (error) {
      if (!body.isConnected || sequence !== loadSequence) return;
      body.innerHTML = `
        <div class="card warning-panel">
          ${icon("alert-circle", 17)}
          <span>${escapeHtml(error?.message || "The report could not be loaded.")}</span>
        </div>
      `;
    }
  }

  function rerenderControls() {
    controls.innerHTML = controlsHtml(filters);
    body.setAttribute("aria-labelledby", `report-tab-${filters.tab}`);
    wireControls();
  }

  function wireControls() {
    controls.querySelectorAll("[data-report-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        filters.tab = button.dataset.reportTab;
        rerenderControls();
        load();
      });
    });
    controls.querySelectorAll("[data-report-basis]").forEach((select) => {
      select.addEventListener("change", load);
    });
    controls
      .querySelectorAll("[data-report-asof], [data-report-from], [data-report-to]")
      .forEach((input) => {
        input.addEventListener("change", load);
      });
    controls.querySelector("[data-refresh-report]")?.addEventListener("click", load);
  }

  wireControls();
  container.querySelector("[data-print-report]")?.addEventListener("click", async () => {
    if (!isDemoMode()) {
      window.print();
      return;
    }
    const button = qs("[data-print-report]", container);
    if (button) button.disabled = true;
    try {
      const data = await fetchReport(filters);
      openPdfPreview([{ tab: filters.tab, data }], { ledgerName, currency });
    } catch (error) {
      showToast(
        "Could not open the PDF preview",
        error?.message || "The report could not be loaded.",
        "error",
      );
    } finally {
      if (button) button.disabled = false;
    }
  });
  container
    .querySelector("[data-print-all]")
    ?.addEventListener("click", () => printAll(container, filters, ledgerName, currency));
  load();
}
