import { escapeHtml } from "../dom.js";
import { formatInitials } from "../format.js";
import { brandMark, icon } from "../icons.js";

const NAV_ITEMS = [
  { route: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { route: "/accounts", label: "Chart of Accounts", icon: "accounts" },
  { route: "/transactions", label: "Business Transactions", icon: "transactions" },
  { route: "/journal", label: "General Journal", icon: "journal" },
  { route: "/adjustments", label: "Adjustments", icon: "adjustments" },
  { route: "/reports", label: "Reports", icon: "chart" },
];

function ledgerSwitcher(state) {
  const ledgers = state.auth?.ledgers || [];
  const active = state.auth?.activeLedger;
  if (ledgers.length === 0) return "";
  return `
    <div class="ledger-switcher">
      <label class="ledger-switcher-label" for="ledger-switcher">Ledger</label>
      <select class="ledger-switcher-select" id="ledger-switcher" data-ledger-switcher aria-label="Switch ledger">
        ${ledgers
          .map(
            (ledger) => `
              <option value="${escapeHtml(ledger.id)}" ${ledger.id === active?.id ? "selected" : ""}>
                ${escapeHtml(ledger.name)} · ${escapeHtml(ledger.currency)}
              </option>
            `,
          )
          .join("")}
      </select>
      <button class="btn btn-ghost btn-sm ledger-switcher-new" type="button" data-new-ledger>
        ${icon("plus", 14)} New ledger
      </button>
    </div>
  `;
}

export function renderSidebar(state, activeRoute) {
  const profileName = state.profile?.name || state.auth?.user?.displayName || "Local user";
  const workspaceName = state.workspace?.name || "Ledger not named";

  return `
    <aside class="sidebar" id="sidebar" aria-label="Main navigation">
      <div class="sidebar-brand">
        <span class="brand-mark">${brandMark(22)}</span>
        <div>
          <div class="brand-name">Ledgerline</div>
          <div class="brand-sub">Accounting workspace</div>
        </div>
        <button class="btn btn-ghost btn-icon sidebar-close" type="button" data-nav-close aria-label="Close navigation">
          ${icon("close", 19)}
        </button>
      </div>

      ${ledgerSwitcher(state)}

      <div class="nav-group">
        <div class="nav-label">Workspace</div>
        <ul class="nav-list">
          ${NAV_ITEMS.map(
            (item) => `
              <li>
                <a class="nav-link ${activeRoute === item.route ? "is-active" : ""}" href="#${item.route}" ${
                  activeRoute === item.route ? 'aria-current="page"' : ""
                }>
                  ${icon(item.icon, 18)}
                  <span class="nav-text">${item.label}</span>
                </a>
              </li>
            `,
          ).join("")}
        </ul>
      </div>

      <div class="sidebar-spacer"></div>

      <div class="sidebar-footer">
        <button class="user-card" type="button" data-open-settings aria-label="Open profile and ledger settings">
          <span class="user-avatar" aria-hidden="true">${escapeHtml(formatInitials(profileName))}</span>
          <span class="user-meta">
            <span class="user-name">${escapeHtml(profileName)}</span>
            <span class="user-workspace">${escapeHtml(workspaceName)}</span>
          </span>
          ${icon("settings", 15)}
        </button>
        <button class="btn btn-ghost btn-sm sidebar-lock" type="button" data-lock-now>
          ${icon("lock", 14)} Lock now
        </button>
        <p class="sidebar-note">Local mode. Data is stored in SQLite, posted entries are immutable, and the session locks after 30 idle minutes.</p>
      </div>
    </aside>

    <button class="nav-overlay" type="button" data-nav-close tabindex="-1" aria-label="Close navigation"></button>
  `;
}

export function renderMobileBar(state) {
  return `
    <header class="mobile-bar">
      <button class="btn btn-secondary btn-icon menu-button" type="button" data-nav-open aria-expanded="false" aria-controls="sidebar" aria-label="Open navigation">
        ${icon("menu", 19)}
      </button>
      <div class="mobile-brand">
        <strong>Ledgerline</strong>
        <span>${escapeHtml(state.workspace?.name || "Ledger not named")}</span>
      </div>
      <span class="badge badge-posted">Local</span>
    </header>
  `;
}

export function mountNav(root, { onSettings, onSwitchLedger, onNewLedger, onLock } = {}) {
  const frame = root.querySelector(".app-frame") || root.closest(".app-frame") || root;
  const openButton = root.querySelector("[data-nav-open]");
  const closeButtons = root.querySelectorAll("[data-nav-close]");
  const firstNavLink = root.querySelector(".nav-link");
  let isOpen = false;

  function setOpen(open) {
    isOpen = open;
    frame.classList.toggle("nav-open", open);
    openButton?.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      window.requestAnimationFrame(() => firstNavLink?.focus());
    } else {
      openButton?.focus();
    }
  }

  openButton?.addEventListener("click", () => setOpen(true));
  closeButtons.forEach((button) => button.addEventListener("click", () => setOpen(false)));

  const overlay = root.querySelector(".nav-overlay");
  overlay?.addEventListener("click", () => setOpen(false));

  const onKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setOpen(false);
    }
  };
  document.addEventListener("keydown", onKeyDown);

  root.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (isOpen) setOpen(false);
    });
  });

  root.querySelector("[data-open-settings]")?.addEventListener("click", () => {
    if (isOpen) setOpen(false);
    onSettings?.();
  });

  root.querySelector("[data-lock-now]")?.addEventListener("click", () => {
    if (isOpen) setOpen(false);
    onLock?.();
  });

  root.querySelector("[data-new-ledger]")?.addEventListener("click", () => {
    if (isOpen) setOpen(false);
    onNewLedger?.();
  });

  root.querySelector("[data-ledger-switcher]")?.addEventListener("change", (event) => {
    onSwitchLedger?.(event.target.value);
  });

  // If the viewport grows while the drawer is open, return to the desktop layout.
  const media = window.matchMedia("(min-width: 1001px)");
  const onChange = (event) => {
    if (event.matches && isOpen) {
      isOpen = false;
      frame.classList.remove("nav-open");
      document.body.style.overflow = "";
    }
  };
  media.addEventListener?.("change", onChange);
}
