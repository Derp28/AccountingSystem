import { openConfirm } from "./components/modal.js";
import { showToast } from "./components/toast.js";
import { brandMark } from "./icons.js";
import { loadState, markBooted, resetState } from "./state.js";
import { startRouter } from "./router.js";

function renderBootScreen() {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `
    <div class="boot-screen">
      <div class="boot-logo">${brandMark(28)}</div>
      <div class="boot-text">Connecting to your local ledger…</div>
    </div>
  `;
}

function renderBootError(error) {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = `
    <div class="boot-screen">
      <div class="boot-logo">${brandMark(28)}</div>
      <div class="boot-text">
        <strong>Could not reach the local server.</strong><br />
        ${String(error?.message || "Start the app with the documented command and try again.")}
      </div>
      <button class="btn btn-primary" type="button" data-retry-boot>Retry</button>
    </div>
  `;
  app.querySelector("[data-retry-boot]")?.addEventListener("click", () => {
    boot();
  });
}

async function boot() {
  renderBootScreen();
  try {
    await loadState();
    markBooted();
    startRouter();
  } catch (error) {
    console.error("Bootstrap failed", error);
    renderBootError(error);
  }
}

function mountGlobalActions() {
  document.addEventListener("click", (event) => {
    const resetButton = event.target.closest("[data-reset-prototype]");
    if (!resetButton) return;

    openConfirm({
      title: "Reload data from the database?",
      eyebrow: "Local database",
      description: "This re-reads the profile, workspace, accounts, and entries from the SQLite file.",
      message:
        "Nothing is deleted. Drafts, posted entries, and reversals stay exactly as they are stored on this machine.",
      confirmLabel: "Reload data",
      tone: "info",
      async onConfirm() {
        await resetState();
        window.location.hash = "#/dashboard";
        showToast("Reloaded", "The interface now mirrors the local database.", "info", 4200);
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled application rejection", event.reason);
    showToast(
      "Unexpected error",
      "The interface caught an error. Reload the page or restart the local server.",
      "error",
    );
  });
}

mountGlobalActions();
boot();
