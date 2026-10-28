import { entryStatus, getCategory, getSourceMeta } from "../accounting.js";
import { escapeHtml } from "../dom.js";
import { formatMoney } from "../format.js";
import { icon } from "../icons.js";

export function pageHeader({ eyebrow, title, description = "", actions = "" }) {
  return `
    <header class="page-header">
      <div class="page-header-copy">
        <div class="eyebrow">${escapeHtml(eyebrow)}</div>
        <h1 class="page-title">${escapeHtml(title)}</h1>
        ${description ? `<p class="page-description">${escapeHtml(description)}</p>` : ""}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ""}
    </header>
  `;
}

export function statusBadge(entry) {
  const status = entryStatus(entry);
  return `<span class="badge ${status.className}">${status.label}</span>`;
}

export function sourceBadge(sourceType) {
  const meta = getSourceMeta(sourceType);
  return `<span class="type-badge type-${meta.tone}">${escapeHtml(meta.label)}</span>`;
}

export function categoryLabel(categoryId) {
  return getCategory(categoryId).label;
}

export function emptyState({ iconName = "info", title, text, action = "" }) {
  return `
    <div class="empty-state">
      <span class="empty-icon">${icon(iconName, 20)}</span>
      <div class="empty-title">${escapeHtml(title)}</div>
      <p class="empty-text">${escapeHtml(text)}</p>
      ${action}
    </div>
  `;
}

export function accountOptions(accounts, selectedId = "", { includeInactive = true } = {}) {
  return accounts
    .filter((account) => includeInactive || account.active)
    .map(
      (account) => `
        <option value="${escapeHtml(account.id)}" ${account.id === selectedId ? "selected" : ""}>
          ${escapeHtml(account.code)} · ${escapeHtml(account.name)}${account.active ? "" : " (inactive)"}
        </option>
      `,
    )
    .join("");
}

export function currencyOf(state) {
  return state.workspace?.currency || "USD";
}

export function displayMoney(cents, state) {
  return formatMoney(cents, currencyOf(state));
}

export function entryAmount(entry) {
  return (entry.lines || []).reduce((total, line) => total + (line.debitCents || 0), 0);
}

export function moneyCell(cents, state, className = "num") {
  return `<td class="${className}" data-label="Amount">${escapeHtml(displayMoney(cents, state))}</td>`;
}

export function selectOptions(items, selectedValue, { valueKey = "id", labelKey = "label" } = {}) {
  return items
    .map(
      (item) =>
        `<option value="${escapeHtml(item[valueKey])}" ${
          item[valueKey] === selectedValue ? "selected" : ""
        }>${escapeHtml(item[labelKey])}</option>`,
    )
    .join("");
}
