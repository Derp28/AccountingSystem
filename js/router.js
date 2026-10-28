import { renderMobileBar, mountNav, renderSidebar } from "./components/nav.js";
import { openNewLedgerModal, openSettingsModal } from "./components/setup.js";
import { showToast } from "./components/toast.js";
import { getState, lockNow, subscribe, switchLedger } from "./state.js";
import { renderAccounts } from "./views/accounts.js";
import { renderAdjustments } from "./views/adjustments.js";
import { mountClaim, mountLogin, renderClaim, renderLogin } from "./views/auth.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderJournal } from "./views/journal.js";
import { renderReports } from "./views/reports.js";
import { renderTransactions } from "./views/transactions.js";

const ROUTES = {
  "/dashboard": { title: "Dashboard", render: renderDashboard },
  "/accounts": { title: "Chart of Accounts", render: renderAccounts },
  "/transactions": { title: "Business Transactions", render: renderTransactions },
  "/journal": { title: "General Journal", render: renderJournal },
  "/adjustments": { title: "Adjustments", render: renderAdjustments },
  "/reports": { title: "Reports", render: renderReports },
};

let lastRoute = null;

export function getRoute() {
  const raw = window.location.hash.replace(/^#/, "");
  const path = raw.split("?")[0] || "/dashboard";
  return ROUTES[path] ? path : "/dashboard";
}

export function navigate(route) {
  const next = `#${route}`;
  if (window.location.hash === next) {
    renderApp();
    return;
  }
  window.location.hash = next;
}

function bannerHtml() {
  return `
    <div class="prototype-banner">
      <div class="banner-inner">
        <span class="prototype-pill">Local</span>
        <p><strong>Interactive demo.</strong> Changes stay in this browser tab and disappear on reload. The shipped app writes to <code>data/accounting.sqlite</code> on your machine and locks the session after 30 idle minutes.</p>
        <button class="banner-reset" type="button" data-reset-prototype>Reload data</button>
      </div>
    </div>
  `;
}

function shellHtml(state, route) {
  return `
    <div class="app-frame">
      ${bannerHtml()}
      ${renderMobileBar(state)}
      <div class="app-layout">
        ${renderSidebar(state, route)}
        <div class="main-column">
          <main class="main-content" id="main-content" tabindex="-1"></main>
        </div>
      </div>
    </div>
  `;
}

function authFrameHtml() {
  return `
    <div class="app-frame">
      <main id="main-content" class="auth-main"></main>
    </div>
  `;
}

async function handleSwitchLedger(ledgerId) {
  const result = await switchLedger(ledgerId);
  if (result.ok) {
    showToast("Ledger switched", "Reports and entries now use the selected ledger.", "info");
  } else {
    showToast("Could not switch ledger", result.errors?.[0]?.message || "Try again.", "error");
  }
}

export function renderApp() {
  const state = getState();
  const route = getRoute();
  const app = document.getElementById("app");
  if (!app) return;

  document.body.style.overflow = "";
  const auth = state.auth || {};

  if (!auth.claimed) {
    window.scrollTo({ top: 0, behavior: "auto" });
    app.innerHTML = authFrameHtml();
    document.title = "Set up local account · Ledgerline";
    const main = app.querySelector("#main-content");
    main.innerHTML = renderClaim(state);
    mountClaim(main);
    lastRoute = null;
    return;
  }

  if (!auth.authenticated) {
    window.scrollTo({ top: 0, behavior: "auto" });
    app.innerHTML = authFrameHtml();
    document.title = "Sign in · Ledgerline";
    const main = app.querySelector("#main-content");
    main.innerHTML = renderLogin(state);
    mountLogin(main);
    lastRoute = null;
    return;
  }

  app.innerHTML = shellHtml(state, route);
  document.title = `${ROUTES[route].title} · Ledgerline`;
  mountNav(app, {
    onSettings: openSettingsModal,
    onSwitchLedger: handleSwitchLedger,
    onNewLedger: openNewLedgerModal,
    onLock: lockNow,
  });
  const main = app.querySelector("#main-content");
  ROUTES[route].render(main, state);

  if (route !== lastRoute && state.workspace) {
    const heading = main.querySelector(".page-title");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }
  lastRoute = route;
}

export function startRouter() {
  subscribe(() => renderApp());
  window.addEventListener("hashchange", () => {
    renderApp();
    window.scrollTo({ top: 0, behavior: "auto" });
  });
  renderApp();
}
