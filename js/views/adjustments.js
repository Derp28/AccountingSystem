import {
  ADJUSTMENT_TYPE_MAP,
  ADJUSTMENT_TYPES,
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
import { emptyState, pageHeader, statusBadge } from "../components/ui.js";

export function renderAdjustments(container, state) {
  const currency = state.workspace?.currency || "USD";
  const filters = state.ui.adjustments;
  const entries = sortEntries(
    state.entries.filter((entry) => entry.sourceType === "ADJUSTMENT"),
  );

  const typeCount = (type) =>
    entries.filter((entry) => type === "ALL" || entry.adjustmentType === type).length;

  const cards = entries
    .map((entry) => {
      const type = ADJUSTMENT_TYPE_MAP[entry.adjustmentType];
      const amount = entryTotalDebit(entry);
      const isReversed = Boolean(entry.reversedBy);
      return `
        <article
          class="adjustment-card"
          data-adjustment-card
          data-type="${escapeHtml(entry.adjustmentType || "")}"
          data-search="${escapeHtml(
            `${entry.entryNo} ${entry.memo} ${entry.adjustmentReason || ""} ${type?.label || ""}`.toLowerCase(),
          )}"
        >
          <div class="adjustment-top">
            <div>
              <div class="adjustment-type">${escapeHtml(type?.label || "Adjustment")}</div>
              <span class="account-description">${escapeHtml(entry.entryNo)} · ${escapeHtml(
                formatDate(entry.date, { short: true }),
              )}</span>
            </div>
            ${statusBadge(entry)}
          </div>

          <div class="adjustment-memo">${escapeHtml(entry.memo)}</div>
          <div class="adjustment-reason">${escapeHtml(entry.adjustmentReason || "No reason recorded.")}</div>

          ${
            isReversed
              ? `<div class="reversal-note">${icon("reverse", 15)}<span>This adjustment has a linked reversal.</span></div>`
              : ""
          }

          <div class="adjustment-footer">
            <div>
              <div class="adjustment-amount">${escapeHtml(formatMoney(amount, currency))}</div>
              <div class="adjustment-meta">Manual double-entry adjustment</div>
            </div>
            <button class="btn btn-secondary btn-sm" type="button" data-open-entry="${escapeHtml(
              entry.id,
            )}">Open ${icon("arrow-right", 14)}</button>
          </div>
        </article>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="page adjustments-page" data-page="adjustments" data-testid="adjustments-page">
      ${pageHeader({
        eyebrow: "Adjustments",
        title: "Adjustments",
        description:
          "Authorized manual entries for accruals, prepaid allocations, depreciation, or other corrections. No adjustment is calculated automatically.",
        actions: `<button class="btn btn-primary" type="button" data-new-adjustment>${icon(
          "plus",
          16,
        )} New adjustment</button>`,
      })}

      <div class="warning-panel">
        ${icon("alert", 17)}
        <span><strong>Manual adjustments only.</strong> The app does not generate accrual schedules, depreciation calculations, or period-close entries. Every adjustment requires a type and a written reason before it can be posted.</span>
      </div>

      <div class="toolbar">
        <div class="filter-chips" role="group" aria-label="Filter adjustments by type">
          <button class="chip ${filters.type === "ALL" ? "is-active" : ""}" type="button" data-adjustment-filter="ALL" aria-pressed="${
            filters.type === "ALL"
          }">All<span class="chip-count">${typeCount("ALL")}</span></button>
          ${ADJUSTMENT_TYPES.map(
            (type) => `
              <button class="chip ${filters.type === type.id ? "is-active" : ""}" type="button" data-adjustment-filter="${type.id}" aria-pressed="${
                filters.type === type.id
              }">${escapeHtml(type.label)}<span class="chip-count">${typeCount(type.id)}</span></button>
            `,
          ).join("")}
        </div>
        <div class="search-field">
          ${icon("search", 16)}
          <input class="input" type="search" placeholder="Search adjustments" aria-label="Search adjustments" data-adjustment-search value="${escapeHtml(
            filters.query,
          )}" />
        </div>
      </div>

      <div class="adjustment-grid" data-adjustment-grid>
        ${cards || emptyState({
          iconName: "adjustments",
          title: "No adjustments yet",
          text: "Create a manual adjustment when an authorized entry is needed. Every adjustment stays linked to its reason.",
          action: `<button class="btn btn-primary btn-sm" type="button" data-new-adjustment>New adjustment</button>`,
        })}
      </div>

      <div data-adjustment-empty hidden>
        ${emptyState({
          iconName: "search",
          title: "No adjustments match",
          text: "Try another adjustment type or search term.",
          action: `<button class="btn btn-secondary btn-sm" type="button" data-clear-adjustment-filters>Clear filters</button>`,
        })}
      </div>

      <div class="demo-note">
        ${icon("info", 17)}
        <span>Adjustment types are labels for the interface. No calculations or statutory rules are applied; drafts and postings are stored in this demo tab.</span>
      </div>
    </div>
  `;

  function applyFilters() {
    const query = qs("[data-adjustment-search]", container).value.trim().toLowerCase();
    const type = container.querySelector("[data-adjustment-filter].is-active")?.dataset.adjustmentFilter || "ALL";
    setUiFilter("adjustments", { query, type });

    let visible = 0;
    qsa("[data-adjustment-card]", container).forEach((card) => {
      const matchesQuery = !query || card.dataset.search.includes(query);
      const matchesType = type === "ALL" || card.dataset.type === type;
      const show = matchesQuery && matchesType;
      card.hidden = !show;
      if (show) visible += 1;
    });

    const empty = qs("[data-adjustment-empty]", container);
    if (empty) empty.hidden = visible > 0 || entries.length === 0;
  }

  qs("[data-adjustment-search]", container).addEventListener("input", applyFilters);

  container.querySelectorAll("[data-adjustment-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      container.querySelectorAll("[data-adjustment-filter]").forEach((chip) => {
        const active = chip === button;
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });
      applyFilters();
    });
  });

  qs("[data-clear-adjustment-filters]", container)?.addEventListener("click", () => {
    qs("[data-adjustment-search]", container).value = "";
    container.querySelectorAll("[data-adjustment-filter]").forEach((chip) => {
      const active = chip.dataset.adjustmentFilter === "ALL";
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    applyFilters();
  });

  container.querySelectorAll("[data-new-adjustment]").forEach((button) => {
    button.addEventListener("click", () => {
      openEntryEditor({
        sourceType: "ADJUSTMENT",
        allowedTypes: ["ADJUSTMENT"],
      });
    });
  });

  container.querySelectorAll("[data-open-entry]").forEach((button) => {
    button.addEventListener("click", () => openEntryDetail(button.dataset.openEntry));
  });

  applyFilters();
}
