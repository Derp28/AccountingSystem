import { renderMobileBar, mountNav, renderSidebar } from "./components/nav.js";
import { openSettingsModal } from "./components/setup.js";
import { getState, subscribe } from "./state.js";
import { renderAccounts } from "./views/accounts.js";
import { renderAdjustments } from "./views/adjustments.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderJournal } from "./views/journal.js";
import { mountOnboarding, renderOnboarding } from "./views/onboarding.js";
import { renderTransactions } from "./views/transactions.js";
import { mountWorkspaceSetup, renderWorkspaceSetup } from "./views/workspace-setup.js";

const ROUTES = {
  "/dashboard": { title: "Dashboard", render: renderDashboard },
  "/accounts": { title: "Chart of Accounts", render: renderAccounts },
  "/transactions": { title: "Business Transactions", render: renderTransactions },
  "/journal": { title: "General Journal", render: renderJournal },
  "/adjustments": { title: "Adjustments", render: renderAdjustments },
};

let lastRoute = null;
let lastHadProfile = false;
let lastHadWorkspace = false;

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
        <p><strong>Saved locally.</strong> Changes are written to <code>data/accounting.sqlite</code> on this machine. Posted entries are immutable; corrections use reversals.</p>
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

function onboardingHtml() {
  return `
    <div class="app-frame">
      ${bannerHtml()}
      <main id="main-content"></main>
    </div>
  `;
}

export function renderApp() {
  const state = getState();
  const route = getRoute();
  const app = document.getElementById("app");
  if (!app) return;

  document.body.style.overflow = "";
  const hadProfile = lastHadProfile;
  const hadWorkspace = lastHadWorkspace;
  const onboarding = !state.profile;
  const workspaceSetup = Boolean(state.profile) && !state.workspace;

  if (onboarding || workspaceSetup) {
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  app.innerHTML = onboarding || workspaceSetup ? onboardingHtml() : shellHtml(state, route);

  if (onboarding) {
    document.title = "Welcome · Ledgerline";
    const main = app.querySelector("#main-content");
    main.innerHTML = renderOnboarding(state);
    mountOnboarding(app);
  } else if (workspaceSetup) {
    document.title = "Workspace setup · Ledgerline";
    const main = app.querySelector("#main-content");
    main.innerHTML = renderWorkspaceSetup(state);
    mountWorkspaceSetup(app);
  } else {
    document.title = `${ROUTES[route].title} · Ledgerline`;
    mountNav(app, { onSettings: openSettingsModal });
    const main = app.querySelector("#main-content");
    ROUTES[route].render(main, state);

    const routeChanged = route !== lastRoute;
    const justOnboarded = !hadProfile && Boolean(state.profile);
    const justNamedWorkspace = !hadWorkspace && Boolean(state.workspace);
    if ((routeChanged || justOnboarded || justNamedWorkspace) && state.workspace) {
      const heading = main.querySelector(".page-title");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
  }

  lastRoute = route;
  lastHadProfile = Boolean(state.profile);
  lastHadWorkspace = Boolean(state.workspace);
}

export function startRouter() {
  subscribe(() => renderApp());
  window.addEventListener("hashchange", () => {
    renderApp();
    window.scrollTo({ top: 0, behavior: "auto" });
  });
  renderApp();
}
