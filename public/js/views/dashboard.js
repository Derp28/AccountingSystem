import { escapeHtml } from "../dom.js";
import { formatMoney } from "../format.js";
import { icon } from "../icons.js";
import { getState } from "../state.js";
import { openEntryDetail } from "../components/entry-detail.js";
import { openEntryEditor } from "../components/entry-form.js";
import { pageHeader, statusBadge } from "../components/ui.js";

function emptyDashboard() {
  return {
    assetsCents: 0,
    liabilitiesCents: 0,
    equityCents: 0,
    revenueCents: 0,
    expensesCents: 0,
    netIncomeCents: 0,
    equationDifferenceCents: 0,
    counts: { postedEntries: 0, draftEntries: 0 },
    recentEntries: [],
  };
}

export function renderDashboard(container, state) {
  const currency = state.workspace?.currency || "USD";
  const profileName = state.profile?.name || "there";
  const workspaceName = state.workspace?.name || "Workspace";
  const metrics = state.dashboard || emptyDashboard();
  const trial = state.trialBalance || { rows: [], totalDebitCents: 0, totalCreditCents: 0, balanced: true };
  const recent = metrics.recentEntries || [];
  const postedCount = metrics.counts?.postedEntries ?? 0;
  const drafts = metrics.counts?.draftEntries ?? 0;
  const balanced =
    trial.balanced !== false && Math.abs(metrics.equationDifferenceCents || 0) === 0;

  const metricCards = [
    {
      label: "Total assets",
      value: metrics.assetsCents,
      meta: "Asset accounts, posted entries only",
      icon: "wallet",
      tone: "is-positive",
    },
    {
      label: "Total liabilities",
      value: metrics.liabilitiesCents,
      meta: "Amounts owed to suppliers and others",
      icon: "scale",
      tone: metrics.liabilitiesCents > 0 ? "is-warning" : "is-positive",
    },
    {
      label: "Revenue",
      value: metrics.revenueCents,
      meta: "Posted income accounts",
      icon: "arrow-up-right",
      tone: "is-positive",
    },
    {
      label: "Expenses",
      value: metrics.expensesCents,
      meta: "Posted expense accounts",
      icon: "arrow-down-left",
      tone: "is-negative",
    },
  ];

  const trialRows = (trial.rows || [])
    .map(
      (row) => `
        <tr>
          <td data-label="Account">
            <span class="account-code">${escapeHtml(row.account.code)}</span>
            <span class="account-name">${escapeHtml(row.account.name)}</span>
            <div class="account-description">${escapeHtml(row.account.category.toLowerCase())}</div>
          </td>
          <td class="num" data-label="Debit">${row.debitCents ? escapeHtml(formatMoney(row.debitCents, currency)) : "—"}</td>
          <td class="num" data-label="Credit">${row.creditCents ? escapeHtml(formatMoney(row.creditCents, currency)) : "—"}</td>
        </tr>
      `,
    )
    .join("");

  const recentMarkup =
    recent.length === 0
      ? `<div class="table-empty">No posted entries yet. Post a draft to see activity here.</div>`
      : `<ul class="activity-list">
          ${recent
            .map(
              (entry) => `
                <li>
                  <button class="activity-item" type="button" data-entry-id="${escapeHtml(entry.id)}">
                    <span class="activity-icon">${icon(
                      entry.sourceType === "ADJUSTMENT" ? "adjustments" : "transactions",
                      16,
                    )}</span>
                    <span class="activity-main">
                      <span class="activity-title">${escapeHtml(entry.memo)}</span>
                      <span class="activity-meta">
                        ${statusBadge(entry)}
                        <span>${escapeHtml(entry.entryNo)}</span>
                        <span>·</span>
                        <span>${escapeHtml(entry.date)}</span>
                      </span>
                    </span>
                    <span class="activity-amount">${escapeHtml(formatMoney(
                      (entry.lines || []).reduce((total, line) => total + (line.debitCents || 0), 0),
                      currency,
                    ))}</span>
                  </button>
                </li>
              `,
            )
            .join("")}
        </ul>`;

  container.innerHTML = `
    <div class="page dashboard-page" data-page="dashboard">
      ${pageHeader({
        eyebrow: "Dashboard",
        title: `Welcome back, ${profileName}`,
        description: `${workspaceName} · ${currency} workspace. Figures below are derived from ${postedCount} posted ${
          postedCount === 1 ? "entry" : "entries"
        } in your local database.`,
        actions: `
          <button class="btn btn-secondary" type="button" data-quick-action="GENERAL_JOURNAL">${icon(
            "journal",
            16,
          )} New journal entry</button>
          <button class="btn btn-primary" type="button" data-quick-action="SALES_INVOICE">${icon(
            "plus",
            16,
          )} New transaction</button>
        `,
      })}

      <section class="hero" aria-labelledby="net-income-heading">
        <div class="hero-main">
          <div class="hero-kicker">Net income · posted entries</div>
          <div class="hero-value" id="net-income-heading" data-testid="net-income">${escapeHtml(
            formatMoney(metrics.netIncomeCents, currency),
          )}</div>
          <p class="hero-caption">
            Revenue minus expenses, calculated on the server from posted journal lines.
          </p>
        </div>
        <div class="hero-side">
          <div class="equation" aria-label="Accounting equation">
            <span class="equation-term">Assets<strong>${escapeHtml(
              formatMoney(metrics.assetsCents, currency),
            )}</strong></span>
            <span class="equation-equals">=</span>
            <span class="equation-term">Liabilities<strong>${escapeHtml(
              formatMoney(metrics.liabilitiesCents, currency),
            )}</strong></span>
            <span class="equation-equals">+</span>
            <span class="equation-term">Equity<strong>${escapeHtml(
              formatMoney(metrics.equityCents, currency),
            )}</strong></span>
            <span class="equation-equals">+</span>
            <span class="equation-term">Net income<strong>${escapeHtml(
              formatMoney(metrics.netIncomeCents, currency),
            )}</strong></span>
          </div>
          <span class="check-chip ${balanced ? "" : "is-bad"}">
            ${icon(balanced ? "check-circle" : "alert-circle", 15)}
            ${balanced ? "Accounting equation balances" : "Equation needs review"}
          </span>
          <p class="hero-caption">
            ${drafts > 0 ? `${drafts} draft ${drafts === 1 ? "entry is" : "entries are"} excluded from these figures.` : "No drafts are waiting."}
          </p>
        </div>
      </section>

      <section class="metric-grid" aria-label="Financial summary">
        ${metricCards
          .map(
            (card) => `
              <article class="metric-card ${card.tone}" data-testid="metric-${card.label
                .toLowerCase()
                .replaceAll(" ", "-")}">
                <div class="metric-top">
                  <span class="metric-label">${escapeHtml(card.label)}</span>
                  <span class="metric-icon">${icon(card.icon, 15)}</span>
                </div>
                <div class="metric-value">${escapeHtml(formatMoney(card.value, currency))}</div>
                <div class="metric-meta">${escapeHtml(card.meta)}</div>
              </article>
            `,
          )
          .join("")}
      </section>

      <div class="two-column">
        <section class="card" aria-labelledby="trial-balance-title">
          <div class="card-header">
            <div>
              <h2 class="card-title" id="trial-balance-title">Trial balance</h2>
              <p class="card-subtitle">Posted activity by account. Debits and credits must agree.</p>
            </div>
            <span class="check-chip ${trial.balanced ? "" : "is-bad"}" style="background:${
              trial.balanced ? "var(--green-100)" : "var(--red-soft)"
            }; color:${trial.balanced ? "var(--green-800)" : "var(--red)"}">
              ${icon(trial.balanced ? "check" : "alert", 14)}
              ${trial.balanced ? "Balanced" : "Out of balance"}
            </span>
          </div>
          <div class="table-wrap">
            <table class="data-table responsive-table" data-testid="trial-balance">
              <caption class="sr-only">Trial balance from posted entries</caption>
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col" class="num">Debit</th>
                  <th scope="col" class="num">Credit</th>
                </tr>
              </thead>
              <tbody>
                ${
                  trialRows ||
                  `<tr><td colspan="3" class="table-empty">No posted entries yet.</td></tr>`
                }
              </tbody>
              <tfoot>
                <tr>
                  <td class="strong">Totals</td>
                  <td class="num strong" data-label="Debit">${escapeHtml(formatMoney(trial.totalDebitCents, currency))}</td>
                  <td class="num strong" data-label="Credit">${escapeHtml(formatMoney(trial.totalCreditCents, currency))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="card-footer">
            <span class="help">Trial balance difference: <strong>${escapeHtml(
              formatMoney((trial.totalDebitCents || 0) - (trial.totalCreditCents || 0), currency),
            )}</strong></span>
            <a class="btn btn-ghost btn-sm" href="#/reports">Open reports ${icon(
              "arrow-right",
              14,
            )}</a>
          </div>
        </section>

        <div class="grid" style="gap:18px">
          <section class="card" aria-labelledby="quick-actions-title">
            <div class="card-header">
              <div>
                <h2 class="card-title" id="quick-actions-title">Quick actions</h2>
                <p class="card-subtitle">Start a draft in the local database.</p>
              </div>
            </div>
            <div class="card-body">
              <div class="quick-grid">
                <button class="quick-action" type="button" data-quick-action="SALES_INVOICE">
                  ${icon("arrow-up-right", 16)} Record a sale
                </button>
                <button class="quick-action" type="button" data-quick-action="PURCHASE_BILL">
                  ${icon("arrow-down-left", 16)} Record a purchase
                </button>
                <button class="quick-action" type="button" data-quick-action="GENERAL_JOURNAL">
                  ${icon("journal", 16)} New journal entry
                </button>
                <button class="quick-action" type="button" data-quick-action="ADJUSTMENT">
                  ${icon("adjustments", 16)} Make an adjustment
                </button>
              </div>
            </div>
          </section>

          <section class="card" aria-labelledby="recent-title">
            <div class="card-header">
              <div>
                <h2 class="card-title" id="recent-title">Recent activity</h2>
                <p class="card-subtitle">Latest posted entries.</p>
              </div>
              <a class="btn btn-ghost btn-sm" href="#/journal">Open journal</a>
            </div>
            <div data-testid="recent-activity">${recentMarkup}</div>
          </section>
        </div>
      </div>
    </div>
  `;

  function openQuickAction(sourceType) {
    openEntryEditor({
      sourceType,
      allowedTypes:
        sourceType === "ADJUSTMENT"
          ? ["ADJUSTMENT"]
          : sourceType === "GENERAL_JOURNAL"
            ? ["GENERAL_JOURNAL"]
            : ["SALES_INVOICE", "PURCHASE_BILL", "CASH_RECEIPT", "CASH_PAYMENT", "GENERAL_JOURNAL"],
    });
  }

  container.querySelectorAll("[data-quick-action]").forEach((button) => {
    button.addEventListener("click", () => openQuickAction(button.dataset.quickAction));
  });

  container.querySelectorAll("[data-entry-id]").forEach((button) => {
    button.addEventListener("click", () => openEntryDetail(button.dataset.entryId));
  });
}
