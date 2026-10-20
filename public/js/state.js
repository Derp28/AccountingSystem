import { api } from "./api.js";

const listeners = new Set();

function createInitialState() {
  return {
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
  state.profile = payload.profile;
  state.workspace = payload.workspace;
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
  const fresh = createInitialState();
  fresh.ui.booted = true;
  fresh.profile = state.profile;
  fresh.workspace = state.workspace;
  state = fresh;
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

function findEntry(entryId) {
  return state.entries.find((entry) => entry.id === entryId);
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
  const existing = findEntry(entryId);
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
