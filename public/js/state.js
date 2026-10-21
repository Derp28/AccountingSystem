import { api, setCsrfToken } from "./api.js";
import { todayIso } from "./format.js";

const listeners = new Set();

function firstOfMonth() {
  return `${todayIso().slice(0, 7)}-01`;
}

function createInitialState() {
  return {
    auth: { claimed: false, authenticated: false, setupRequired: true },
    profile: null,
    workspace: null,
    accounts: [],
    entries: [],
    dashboard: null,
    trialBalance: null,
    error: null,
    onboarding: {
      step: "welcome",
      error: null,
    },
    ui: {
      route: "/dashboard",
      booted: false,
      accounts: { query: "", category: "ALL", status: "ALL" },
      transactions: { query: "", type: "ALL", status: "ALL" },
      journal: { query: "", status: "ALL", sourceType: "ALL" },
      adjustments: { query: "", type: "ALL" },
    },
    reports: {
      tab: "trial-balance",
      basis: "adjusted",
      asOf: todayIso(),
      from: firstOfMonth(),
      to: todayIso(),
    },
  };
}

let state = createInitialState();

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener(state);
}

function applyBootstrap(payload) {
  state.auth = payload.auth || { claimed: false, authenticated: false, setupRequired: true };
  setCsrfToken(state.auth.csrfToken || null);
  state.profile = payload.profile || null;
  state.workspace = payload.workspace || null;
  state.accounts = payload.accounts || [];
  state.entries = payload.entries || [];
  state.dashboard = payload.dashboard || null;
  state.trialBalance = payload.trialBalance || null;
  state.error = null;
}

export async function loadState() {
  const payload = await api.bootstrap();
  applyBootstrap(payload);
  emit();
  return payload;
}

export function markBooted() {
  state.ui.booted = true;
  emit();
}

export async function resetState() {
  state = createInitialState();
  state.ui.booted = true;
  emit();
  await loadState();
}

function toResult(error) {
  const errors =
    Array.isArray(error?.details) && error.details.length > 0
      ? error.details
      : [{ message: error?.message || "The request failed." }];
  return { ok: false, errors, error };
}

export async function claimAccount(input) {
  try {
    await api.claim(input);
    await loadState();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function loginUser(input) {
  try {
    await api.login(input);
    await loadState();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function logoutUser() {
  try {
    await api.logout();
  } catch {
    // Clearing the local screen still matters if the session already expired.
  }
  await refreshLockedState();
  return { ok: true };
}

export async function lockNow() {
  try {
    await api.lock();
  } catch {
    // Locking the screen remains available if the session is already gone.
  }
  await refreshLockedState();
  return { ok: true };
}

/**
 * After a lock or sign-out the installation is usually still claimed, so the
 * next screen is sign-in rather than first-run setup. Re-read bootstrap to find
 * out, and fall back to a locked-but-claimed state if that request fails.
 */
async function refreshLockedState() {
  const previousAuth = state.auth || {};
  setCsrfToken(null);
  try {
    await loadState();
  } catch {
    state = createInitialState();
    state.auth = {
      claimed: previousAuth.claimed ?? true,
      authenticated: false,
      setupRequired: false,
      displayName: previousAuth.displayName,
    };
    state.ui.booted = true;
    emit();
  }
}

export async function switchLedger(ledgerId) {
  try {
    await api.switchLedger(ledgerId);
    await loadState();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function createLedger(input) {
  try {
    await api.createLedger(input);
    await loadState();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function setProfile(name) {
  try {
    const payload = await api.saveProfile(name);
    await loadState();
    state.profile = payload.profile || state.profile;
    if (window.location.hash !== "#/dashboard") {
      window.location.hash = "#/dashboard";
    }
    emit();
    return { ok: true, profile: payload.profile };
  } catch (error) {
    return toResult(error);
  }
}

export async function setWorkspace(workspace) {
  try {
    const payload = await api.saveWorkspace(workspace);
    await loadState();
    return { ok: true, workspace: payload.workspace };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateSettings({ profileName, workspaceName, currency }) {
  try {
    await api.saveProfile(profileName);
  } catch (error) {
    return toResult(error);
  }
  try {
    await api.saveWorkspace({ name: workspaceName, currency });
  } catch (error) {
    return toResult(error);
  }
  await loadState();
  return { ok: true };
}

export async function addAccount(input) {
  try {
    const payload = await api.createAccount(input);
    await loadState();
    return { ok: true, account: payload.account };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateAccount(accountId, patch) {
  try {
    const payload = await api.updateAccount(accountId, patch);
    await loadState();
    return { ok: true, account: payload.account };
  } catch (error) {
    return toResult(error);
  }
}

export async function setAccountActive(accountId, active) {
  try {
    const payload = await api.setAccountActive(accountId, active);
    await loadState();
    return { ok: true, account: payload.account };
  } catch (error) {
    return toResult(error);
  }
}

export async function addEntry(input) {
  try {
    const payload = await api.createEntry(input, crypto.randomUUID());
    await loadState();
    return { ok: true, entry: payload.entry, idempotent: payload.idempotent };
  } catch (error) {
    return toResult(error);
  }
}

export async function updateEntry(entryId, input) {
  const existing = state.entries.find((entry) => entry.id === entryId);
  try {
    const payload = await api.updateEntry(entryId, {
      ...input,
      version: existing?.version,
    });
    await loadState();
    return { ok: true, entry: payload.entry };
  } catch (error) {
    return toResult(error);
  }
}

export async function deleteDraft(entryId) {
  try {
    await api.deleteEntry(entryId);
    await loadState();
    return { ok: true };
  } catch (error) {
    return toResult(error);
  }
}

export async function postEntry(entryId) {
  try {
    const payload = await api.postEntry(entryId);
    await loadState();
    return { ok: true, entry: payload.entry };
  } catch (error) {
    return toResult(error);
  }
}

export async function reverseEntry(entryId, reason) {
  try {
    const payload = await api.reverseEntry(entryId, reason, crypto.randomUUID());
    await loadState();
    return { ok: true, entry: payload.entry };
  } catch (error) {
    return toResult(error);
  }
}

export function setUiFilter(section, patch) {
  if (!state.ui[section]) state.ui[section] = {};
  Object.assign(state.ui[section], patch);
}

export function setReportFilter(patch) {
  Object.assign(state.reports, patch);
  emit();
}
