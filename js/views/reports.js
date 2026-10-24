import { api } from "../api.js";
import { escapeHtml, qs } from "../dom.js";
import { formatMoney } from "../format.js";
import { icon } from "../icons.js";
import { getState } from "../state.js";
import { pageHeader } from "../components/ui.js";

const TABS = [
  { id: "trial-balance", label: "Trial balance" },
  { id: "income-statement", label: "Income statement" },
  { id: "balance-sheet", label: "Balance sheet" },
];

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

function trialBalanceHtml(data, currency) {
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

  return `
    <section class="card" data-testid="report-trial-balance">
      <div class="card-header">
        <div>
          <h2 class="card-title">Trial balance</h2>
          <p class="card-subtitle">${escapeHtml(basisLabel(data.basis))} basis · as of ${escapeHtml(
            data.asOf,
          )}. ${escapeHtml(basisHelp(data.basis))}</p>
        </div>
        ${balancedChip(data.balanced)}
      </div>
      <div class="table-wrap">
        <table class="data-table responsive-table">
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
      <div class="card-footer">
        <span class="help">Difference: <strong>${escapeHtml(
          formatMoney(data.differenceCents, currency),
        )}</strong></span>
      </div>
    </section>
  `;
}

function incomeRows(rows, currency) {
  if (rows.length === 0) return emptyRows(2, "No activity in this period.");
  return rows
    .map(
      (row) => `
        <tr>
          <td data-label="Account">
            <span class="account-code">${escapeHtml(row.account.code)}</span>
            <span class="account-name">${escapeHtml(row.account.name)}</span>
          </td>
          <td class="num" data-label="Amount">${escapeHtml(formatMoney(row.amountCents, currency))}</td>
        </tr>
      `,
    )
    .join("");
}

function incomeStatementHtml(data, currency) {
  return `
    <section class="card" data-testid="report-income-statement">
      <div class="card-header">
        <div>
          <h2 class="card-title">Income statement</h2>
          <p class="card-subtitle">${escapeHtml(basisLabel(data.basis))} basis · ${escapeHtml(
            data.from,
          )} to ${escapeHtml(data.to)}. ${escapeHtml(basisHelp(data.basis))}</p>
        </div>
      </div>
      <div class="report-section">
        <h3 class="report-section-title">Revenue</h3>
        <div class="table-wrap">
          <table class="data-table responsive-table">
            <tbody>${incomeRows(data.revenueRows, currency)}</tbody>
            <tfoot><tr><td class="strong">Total revenue</td><td class="num strong">${escapeHtml(
              formatMoney(data.totalRevenueCents, currency),
            )}</td></tr></tfoot>
          </table>
        </div>
      </div>
      <div class="report-section">
        <h3 class="report-section-title">Expenses</h3>
        <div class="table-wrap">
          <table class="data-table responsive-table">
            <tbody>${incomeRows(data.expenseRows, currency)}</tbody>
            <tfoot><tr><td class="strong">Total expenses</td><td class="num strong">${escapeHtml(
              formatMoney(data.totalExpensesCents, currency),
            )}</td></tr></tfoot>
          </table>
        </div>
      </div>
      <div class="report-total">
        <span>Net income</span>
        <strong class="num" data-testid="report-net-income">${escapeHtml(
          formatMoney(data.netIncomeCents, currency),
        )}</strong>
      </div>
    </section>
  `;
}

function balanceSection(title, rows, currency, totalLabel, totalCents) {
  const body = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              <td data-label="Account">
                <span class="account-code">${escapeHtml(row.account.code)}</span>
                <span class="account-name">${escapeHtml(row.account.name)}</span>
              </td>
              <td class="num" data-label="Amount">${escapeHtml(formatMoney(row.amountCents, currency))}</td>
            </tr>
          `,
        )
        .join("")
    : emptyRows(2, "No balances in this section.");
  return `
    <div class="report-section">
      <h3 class="report-section-title">${escapeHtml(title)}</h3>
      <div class="table-wrap">
        <table class="data-table responsive-table">
          <tbody>${body}</tbody>
          <tfoot><tr><td class="strong">${escapeHtml(totalLabel)}</td><td class="num strong">${escapeHtml(
            formatMoney(totalCents, currency),
          )}</td></tr></tfoot>
        </table>
      </div>
    </div>
  `;
}

function balanceSheetHtml(data, currency) {
  const equityRows = [
    ...data.equityRows,
    {
      account: { code: "—", name: "Accumulated earnings (computed)" },
      amountCents: data.accumulatedEarningsCents,
    },
  ];
  return `
    <section class="card" data-testid="report-balance-sheet">
      <div class="card-header">
        <div>
          <h2 class="card-title">Balance sheet</h2>
          <p class="card-subtitle">${escapeHtml(basisLabel(data.basis))} basis · as of ${escapeHtml(
            data.asOf,
          )}. ${escapeHtml(basisHelp(data.basis))}</p>
        </div>
        ${balancedChip(data.balanced, "Assets = liabilities + equity")}
      </div>
      ${balanceSection("Assets", data.assetRows, currency, "Total assets", data.totalAssetsCents)}
      ${balanceSection(
        "Liabilities",
        data.liabilityRows,
        currency,
        "Total liabilities",
        data.totalLiabilitiesCents,
      )}
      ${balanceSection("Equity", equityRows, currency, "Total equity", data.totalEquityCents)}
      <div class="report-total">
        <span>Total liabilities + equity</span>
        <strong class="num" data-testid="report-total-liabilities-equity">${escapeHtml(
          formatMoney(data.totalLiabilitiesAndEquityCents, currency),
        )}</strong>
      </div>
      <div class="card-footer">
        <span class="help">Difference: <strong>${escapeHtml(
          formatMoney(data.differenceCents, currency),
        )}</strong></span>
      </div>
    </section>
  `;
}

async function fetchReport(filters) {
  if (filters.tab === "income-statement") {
    return api.incomeStatement({ from: filters.from, to: filters.to, basis: filters.basis });
  }
  if (filters.tab === "balance-sheet") {
    return api.balanceSheet({ asOf: filters.asOf, basis: filters.basis });
  }
  return api.trialBalance({ asOf: filters.asOf, basis: filters.basis });
}

function controlsHtml(filters) {
  const isIncome = filters.tab === "income-statement";
  return `
    <section class="card report-controls" aria-label="Report options">
      <div class="report-tabs" role="tablist" aria-label="Report">
        ${TABS.map(
          (tab) => `
            <button class="report-tab ${filters.tab === tab.id ? "is-active" : ""}" type="button"
              role="tab" aria-selected="${filters.tab === tab.id}" data-report-tab="${tab.id}">
              ${escapeHtml(tab.label)}
            </button>
          `,
        ).join("")}
      </div>
      <div class="report-filters">
        ${
          isIncome
            ? `
              <div class="field report-date">
                <label class="label" for="report-from">From</label>
                <input class="input" id="report-from" type="date" value="${escapeHtml(filters.from)}" data-report-from />
              </div>
              <div class="field report-date">
                <label class="label" for="report-to">To</label>
                <input class="input" id="report-to" type="date" value="${escapeHtml(filters.to)}" data-report-to />
              </div>
            `
            : `
              <div class="field report-date">
                <label class="label" for="report-asof">As of</label>
                <input class="input" id="report-asof" type="date" value="${escapeHtml(filters.asOf)}" data-report-asof />
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
        <button class="btn btn-secondary" type="button" data-refresh-report>${icon("refresh", 15)} Refresh</button>
      </div>
    </section>
  `;
}

export function renderReports(container, state) {
  const currency = state.workspace?.currency || "USD";
  const filters = { ...state.reports };

  container.innerHTML = `
    <div class="page reports-page" data-page="reports">
      ${pageHeader({
        eyebrow: "Reports",
        title: "Financial statements",
        description: `Unadjusted and adjusted statements for ${state.workspace?.name || "the active ledger"} in ${currency}. Reports use posted entries only and are calculated in your browser.`,
        actions: `<button class="btn btn-secondary" type="button" data-print-report>${icon(
          "save",
          16,
        )} Print</button>`,
      })}
      <div data-report-controls>${controlsHtml(filters)}</div>
      <div id="report-body" aria-live="polite">
        <div class="card report-loading">Loading report…</div>
      </div>
    </div>
  `;

  const controls = qs("[data-report-controls]", container);
  const body = qs("#report-body", container);

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
    body.innerHTML = `<div class="card report-loading">Loading report…</div>`;
    try {
      const data = await fetchReport(filters);
      if (!body.isConnected) return;
      if (filters.tab === "income-statement") {
        body.innerHTML = incomeStatementHtml(data, currency);
      } else if (filters.tab === "balance-sheet") {
        body.innerHTML = balanceSheetHtml(data, currency);
      } else {
        body.innerHTML = trialBalanceHtml(data, currency);
      }
    } catch (error) {
      if (!body.isConnected) return;
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
    controls.querySelectorAll("[data-report-asof], [data-report-from], [data-report-to]").forEach((input) => {
      input.addEventListener("change", load);
    });
    controls.querySelector("[data-refresh-report]")?.addEventListener("click", load);
  }

  wireControls();
  container.querySelector("[data-print-report]")?.addEventListener("click", () => window.print());
  load();
}
