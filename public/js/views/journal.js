import {
  ALL_SOURCE_TYPES,
  getAccount,
  getSourceMeta,
  entryTotalCredit,
  entryTotalDebit,
  sortEntries,
} from "../accounting.js";
import { escapeHtml, qs, qsa } from "../dom.js";
import { formatDate, formatMoney } from "../format.js";
import { icon } from "../icons.js";
import { getState, setUiFilter } from "../state.js";
import { openEntryDetail } from "../components/entry-detail.js";
import { openEntryEditor } from "../components/entry-form.js";
import { emptyState, pageHeader, sourceBadge, statusBadge } from "../components/ui.js";

export function renderJournal(container, state) {
  const currency = state.workspace?.currency || "USD";
  const filters = state.ui.journal;
  const entries = sortEntries(state.entries);

  const rows = entries
    .map((entry) => {
      const debit = entryTotalDebit(entry);
      const credit = entryTotalCredit(entry);
      const lines = (entry.lines || [])
        .map((line) => {
          const account = getAccount(state.accounts, line.accountId);
          return `
            <tr>
              <td>${account ? `<span class="account-code">${escapeHtml(account.code)}</span> ${escapeHtml(account.name)}` : `<span class="muted">Unassigned account</span>`}</td>
              <td>${escapeHtml(line.description || "—")}</td>
              <td class="num">${line.debitCents ? escapeHtml(formatMoney(line.debitCents, currency)) : "—"}</td>
              <td class="num">${line.creditCents ? escapeHtml(formatMoney(line.creditCents, currency)) : "—"}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <tr
          data-journal-row
          data-entry-id="${escapeHtml(entry.id)}"
          data-type="${entry.sourceType}"
          data-status="${entry.status === "DRAFT" ? "draft" : entry.reversedBy ? "reversed" : "posted"}"
          data-search="${escapeHtml(
            `${entry.entryNo} ${entry.memo} ${entry.reference || ""} ${getSourceMeta(entry.sourceType).label}`.toLowerCase(),
          )}"
        >
          <td data-label="Date" class="nowrap">${escapeHtml(formatDate(entry.date, { short: true }))}</td>
          <td data-label="Entry">
            <button class="entry-toggle" type="button" data-toggle-lines aria-expanded="false" aria-controls="entry-lines-${escapeHtml(
              entry.id,
            )}">
              ${icon("chevron-right", 14)}
              ${escapeHtml(entry.entryNo)}
            </button>
          </td>
          <td data-label="Type">${sourceBadge(entry.sourceType)}</td>
          <td data-label="Memo">
            <span class="strong">${escapeHtml(entry.memo)}</span>
            <div class="account-description">${escapeHtml(entry.reference || "No reference")}</div>
          </td>
          <td class="num" data-label="Debit">${escapeHtml(formatMoney(debit, currency))}</td>
          <td class="num" data-label="Credit">${escapeHtml(formatMoney(credit, currency))}</td>
          <td data-label="Status">${statusBadge(entry)}</td>
          <td data-label="Actions">
            <div class="row-actions">
              <button class="btn btn-ghost btn-icon btn-sm" type="button" data-open-entry="${escapeHtml(
                entry.id,
              )}" aria-label="Open ${escapeHtml(entry.entryNo)}">${icon("eye", 15)}</button>
            </div>
          </td>
        </tr>
        <tr class="entry-lines-row" id="entry-lines-${escapeHtml(entry.id)}" data-lines-row hidden>
          <td colspan="8">
            <div class="entry-lines-inner">
              <table class="entry-lines-table">
                <caption class="sr-only">Lines for ${escapeHtml(entry.entryNo)}</caption>
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Description</th>
                    <th scope="col" class="num">Debit</th>
                    <th scope="col" class="num">Credit</th>
                  </tr>
                </thead>
                <tbody>${lines}</tbody>
              </table>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="page journal-page" data-page="journal">
      ${pageHeader({
        eyebrow: "General journal",
        title: "General Journal",
        description:
          "Chronological record of every entry, including drafts and adjustments. Expand an entry to inspect its debit and credit lines.",
        actions: `<button class="btn btn-primary" type="button" data-new-journal-entry>${icon(
          "plus",
          16,
        )} New journal entry</button>`,
      })}

      <div class="toolbar">
        <div class="filter-bar">
          <div class="search-field">
            ${icon("search", 16)}
            <input class="input" type="search" placeholder="Search entry numbers or memos" aria-label="Search journal entries" data-journal-search value="${escapeHtml(
              filters.query,
            )}" />
          </div>
          <select class="select" style="width:auto" aria-label="Filter by entry type" data-journal-type>
            <option value="ALL" ${filters.sourceType === "ALL" ? "selected" : ""}>All types</option>
            ${ALL_SOURCE_TYPES.map(
              (type) =>
                `<option value="${type}" ${
                  filters.sourceType === type ? "selected" : ""
                }>${escapeHtml(getSourceMeta(type).label)}</option>`,
            ).join("")}
          </select>
          <select class="select" style="width:auto" aria-label="Filter by status" data-journal-status>
            <option value="ALL" ${filters.status === "ALL" ? "selected" : ""}>All statuses</option>
            <option value="draft" ${filters.status === "draft" ? "selected" : ""}>Drafts</option>
            <option value="posted" ${filters.status === "posted" ? "selected" : ""}>Posted</option>
            <option value="reversed" ${filters.status === "reversed" ? "selected" : ""}>Reversed</option>
          </select>
        </div>
        <div class="help" data-journal-count>${entries.length} entries</div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="data-table responsive-table" data-testid="journal-table">
            <caption class="sr-only">General journal entries</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Entry</th>
                <th scope="col">Type</th>
                <th scope="col">Memo</th>
                <th scope="col" class="num">Debit</th>
                <th scope="col" class="num">Credit</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="8" class="table-empty">No journal entries yet.</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="card-footer">
          <span class="help" data-journal-footer-count>${entries.length} entries</span>
          <span class="help">Drafts are excluded from balances. Posted entries are never edited.</span>
        </div>
      </div>

      <div data-journal-empty hidden>
        ${emptyState({
          iconName: "journal",
          title: "No entries match",
          text: "Try another memo search, entry type, or status.",
          action: `<button class="btn btn-secondary btn-sm" type="button" data-clear-journal-filters>Clear filters</button>`,
        })}
      </div>

      <div class="demo-note">
        ${icon("info", 17)}
        <span>Journal entries are read from the local database. Posted entries are immutable; drafts are excluded from balances.</span>
      </div>
    </div>
  `;

  function applyFilters() {
    const query = qs("[data-journal-search]", container).value.trim().toLowerCase();
    const sourceType = qs("[data-journal-type]", container).value;
    const status = qs("[data-journal-status]", container).value;
    setUiFilter("journal", { query, status, sourceType });

    let visible = 0;
    qsa("[data-journal-row]", container).forEach((row) => {
      const matchesQuery = !query || row.dataset.search.includes(query);
      const matchesType = sourceType === "ALL" || row.dataset.type === sourceType;
      const matchesStatus = status === "ALL" || row.dataset.status === status;
      const show = matchesQuery && matchesType && matchesStatus;
      row.hidden = !show;
      if (show) visible += 1;
      const linesRow = row.nextElementSibling;
      if (linesRow?.hasAttribute("data-lines-row")) {
        if (!show) linesRow.hidden = true;
      }
    });

    const empty = qs("[data-journal-empty]", container);
    if (empty) empty.hidden = visible > 0 || entries.length === 0;
    const count = qs("[data-journal-count]", container);
    if (count) count.textContent = `${visible} of ${entries.length} entries`;
    const footerCount = qs("[data-journal-footer-count]", container);
    if (footerCount) footerCount.textContent = `${visible} of ${entries.length} entries`;
  }

  qs("[data-journal-search]", container).addEventListener("input", applyFilters);
  qs("[data-journal-type]", container).addEventListener("change", applyFilters);
  qs("[data-journal-status]", container).addEventListener("change", applyFilters);

  qs("[data-clear-journal-filters]", container)?.addEventListener("click", () => {
    qs("[data-journal-search]", container).value = "";
    qs("[data-journal-type]", container).value = "ALL";
    qs("[data-journal-status]", container).value = "ALL";
    applyFilters();
  });

  qs("[data-new-journal-entry]", container).addEventListener("click", () => {
    openEntryEditor({
      sourceType: "GENERAL_JOURNAL",
      allowedTypes: ["GENERAL_JOURNAL"],
    });
  });

  container.querySelectorAll("[data-toggle-lines]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest("[data-journal-row]");
      const linesRow = row?.nextElementSibling;
      if (!linesRow) return;
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      linesRow.hidden = expanded;
    });
  });

  container.querySelectorAll("[data-open-entry]").forEach((button) => {
    button.addEventListener("click", () => openEntryDetail(button.dataset.openEntry));
  });

  applyFilters();
}
