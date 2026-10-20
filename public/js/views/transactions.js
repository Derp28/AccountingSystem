import {
  TRANSACTION_SOURCE_TYPES,
  entryTotalDebit,
  getSourceMeta,
  sortEntries,
} from "../accounting.js";
import { escapeHtml, qs, qsa } from "../dom.js";
import { formatDate, formatMoney } from "../format.js";
import { icon } from "../icons.js";
import { getState, setUiFilter } from "../state.js";
import { openEntryDetail } from "../components/entry-detail.js";
import { openEntryEditor } from "../components/entry-form.js";
import { emptyState, pageHeader, sourceBadge, statusBadge } from "../components/ui.js";

const TYPE_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "SALES_INVOICE", label: "Sales" },
  { id: "PURCHASE_BILL", label: "Purchases" },
  { id: "CASH_RECEIPT", label: "Receipts" },
  { id: "CASH_PAYMENT", label: "Payments" },
  { id: "GENERAL_JOURNAL", label: "Journal" },
];

export function renderTransactions(container, state) {
  const currency = state.workspace?.currency || "USD";
  const filters = state.ui.transactions;
  const entries = sortEntries(
    state.entries.filter((entry) => entry.sourceType !== "ADJUSTMENT"),
  );

  const typeCount = (type) =>
    entries.filter((entry) => type === "ALL" || entry.sourceType === type).length;

  const rows = entries
    .map((entry) => {
      const meta = getSourceMeta(entry.sourceType);
      const amount = entryTotalDebit(entry);
      return `
        <tr
          data-transaction-row
          data-entry-id="${escapeHtml(entry.id)}"
          data-type="${entry.sourceType}"
          data-status="${entry.status === "DRAFT" ? "draft" : entry.reversedBy ? "reversed" : "posted"}"
          data-search="${escapeHtml(
            `${entry.entryNo} ${entry.memo} ${entry.reference || ""} ${meta.label}`.toLowerCase(),
          )}"
        >
          <td data-label="Date" class="nowrap">${escapeHtml(formatDate(entry.date, { short: true }))}</td>
          <td data-label="Type">${sourceBadge(entry.sourceType)}</td>
          <td data-label="Reference"><span class="muted">${escapeHtml(entry.reference || "—")}</span></td>
          <td data-label="Description">
            <span class="strong">${escapeHtml(entry.memo)}</span>
            <div class="account-description">${escapeHtml(entry.entryNo)}</div>
          </td>
          <td class="num" data-label="Amount">${escapeHtml(formatMoney(amount, currency))}</td>
          <td data-label="Status">${statusBadge(entry)}</td>
          <td data-label="Actions">
            <div class="row-actions">
              <button class="btn btn-ghost btn-icon btn-sm" type="button" data-open-entry="${escapeHtml(
                entry.id,
              )}" aria-label="Open ${escapeHtml(entry.entryNo)}">${icon("eye", 15)}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="page transactions-page" data-page="transactions">
      ${pageHeader({
        eyebrow: "Business transactions",
        title: "Business Transactions",
        description:
          "Sales, purchases, receipts, payments, and manual journal entries. Drafts are editable; posted entries are immutable and corrections use reversals.",
        actions: `<button class="btn btn-primary" type="button" data-new-transaction>${icon(
          "plus",
          16,
        )} New transaction</button>`,
      })}

      <div class="toolbar">
        <div class="filter-chips" role="group" aria-label="Filter by transaction type">
          ${TYPE_FILTERS.map(
            (filter) => `
              <button
                class="chip ${filters.type === filter.id ? "is-active" : ""}"
                type="button"
                data-type-filter="${filter.id}"
                aria-pressed="${filters.type === filter.id}"
              >
                ${filter.label}<span class="chip-count">${typeCount(filter.id)}</span>
              </button>
            `,
          ).join("")}
        </div>
        <div class="filter-bar">
          <div class="search-field">
            ${icon("search", 16)}
            <input class="input" type="search" placeholder="Search entries or references" aria-label="Search transactions" data-transaction-search value="${escapeHtml(
              filters.query,
            )}" />
          </div>
          <select class="select" style="width:auto" aria-label="Filter by status" data-transaction-status>
            <option value="ALL" ${filters.status === "ALL" ? "selected" : ""}>All statuses</option>
            <option value="draft" ${filters.status === "draft" ? "selected" : ""}>Drafts</option>
            <option value="posted" ${filters.status === "posted" ? "selected" : ""}>Posted</option>
            <option value="reversed" ${filters.status === "reversed" ? "selected" : ""}>Reversed</option>
          </select>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="data-table responsive-table" data-testid="transactions-table">
            <caption class="sr-only">Business transactions</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Reference</th>
                <th scope="col">Description</th>
                <th scope="col" class="num">Amount</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody data-transaction-body>
              ${rows || `<tr><td colspan="7" class="table-empty">No transactions yet. Create your first draft.</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="card-footer">
          <span class="help" data-transaction-count>${entries.length} transactions</span>
          <span class="help">Amounts show total debits; every entry uses double-entry lines.</span>
        </div>
      </div>

      <div data-transaction-empty hidden>
        ${emptyState({
          iconName: "search",
          title: "No transactions match",
          text: "Try another search term, transaction type, or status.",
          action: `<button class="btn btn-secondary btn-sm" type="button" data-clear-transaction-filters>Clear filters</button>`,
        })}
      </div>

      <div class="demo-note">
        ${icon("info", 17)}
        <span>Creating and editing writes a draft to the local database. Posting validates and permanently records the journal entry.</span>
      </div>
    </div>
  `;

  function applyFilters() {
    const query = qs("[data-transaction-search]", container).value.trim().toLowerCase();
    const status = qs("[data-transaction-status]", container).value;
    const type = container.querySelector(".chip.is-active")?.dataset.typeFilter || "ALL";
    setUiFilter("transactions", { query, status, type });

    let visible = 0;
    qsa("[data-transaction-row]", container).forEach((row) => {
      const matchesQuery = !query || row.dataset.search.includes(query);
      const matchesStatus = status === "ALL" || row.dataset.status === status;
      const matchesType = type === "ALL" || row.dataset.type === type;
      const show = matchesQuery && matchesStatus && matchesType;
      row.hidden = !show;
      if (show) visible += 1;
    });

    const empty = qs("[data-transaction-empty]", container);
    if (empty) empty.hidden = visible > 0 || entries.length === 0;
    const count = qs("[data-transaction-count]", container);
    if (count) count.textContent = `${visible} of ${entries.length} transactions`;
  }

  qs("[data-transaction-search]", container).addEventListener("input", applyFilters);
  qs("[data-transaction-status]", container).addEventListener("change", applyFilters);

  container.querySelectorAll("[data-type-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      container.querySelectorAll("[data-type-filter]").forEach((chip) => {
        const active = chip === button;
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });
      applyFilters();
    });
  });

  qs("[data-clear-transaction-filters]", container)?.addEventListener("click", () => {
    qs("[data-transaction-search]", container).value = "";
    qs("[data-transaction-status]", container).value = "ALL";
    container.querySelectorAll("[data-type-filter]").forEach((chip) => {
      const active = chip.dataset.typeFilter === "ALL";
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    applyFilters();
  });

  qs("[data-new-transaction]", container).addEventListener("click", () => {
    openEntryEditor({
      sourceType: "SALES_INVOICE",
      allowedTypes: TRANSACTION_SOURCE_TYPES,
    });
  });

  container.querySelectorAll("[data-open-entry]").forEach((button) => {
    button.addEventListener("click", () => openEntryDetail(button.dataset.openEntry));
  });

  applyFilters();
}
