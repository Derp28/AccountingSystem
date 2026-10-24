let csrfToken = null;
let authFailureNotified = false;

export function setCsrfToken(token) {
  csrfToken = token || null;
  if (csrfToken) authFailureNotified = false;
}

function queryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, value);
  }
  const result = search.toString();
  return result ? `?${result}` : "";
}

async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    idempotencyKey,
    skipAuthEvent = false,
  } = options;
  const requestHeaders = { Accept: "application/json", ...headers };
  const requestOptions = {
    method,
    headers: requestHeaders,
    credentials: "same-origin",
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(body);
  }
  if (idempotencyKey) {
    requestHeaders["Idempotency-Key"] = idempotencyKey;
  }
  if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    requestHeaders["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(path, requestOptions);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Request failed (${response.status}).`);
    error.status = response.status;
    error.code = payload?.error?.code;
    error.details = Array.isArray(payload?.error?.details) ? payload.error.details : [];
    if (response.status === 401 && !skipAuthEvent && !authFailureNotified) {
      authFailureNotified = true;
      window.dispatchEvent(new CustomEvent("ledgerline:unauthorized"));
    }
    throw error;
  }

  authFailureNotified = false;
  return payload;
}

export const api = {
  bootstrap: () => request("/api/bootstrap"),
  health: () => request("/api/health"),

  claim: (input) =>
    request("/api/auth/claim", { method: "POST", body: input, skipAuthEvent: true }),
  login: (input) =>
    request("/api/auth/login", { method: "POST", body: input, skipAuthEvent: true }),
  logout: () => request("/api/auth/logout", { method: "POST", body: {} }),
  lock: () => request("/api/auth/lock", { method: "POST", body: {} }),

  saveProfile: (name) => request("/api/profile", { method: "PUT", body: { name } }),
  saveWorkspace: (workspace) => request("/api/workspace", { method: "PUT", body: workspace }),

  listLedgers: () => request("/api/ledgers"),
  createLedger: (ledger) => request("/api/ledgers", { method: "POST", body: ledger }),
  switchLedger: (id) =>
    request(`/api/ledgers/${encodeURIComponent(id)}/switch`, { method: "POST", body: {} }),

  listAccounts: () => request("/api/accounts"),
  createAccount: (account) => request("/api/accounts", { method: "POST", body: account }),
  updateAccount: (id, account) =>
    request(`/api/accounts/${encodeURIComponent(id)}`, { method: "PUT", body: account }),
  setAccountActive: (id, active) =>
    request(`/api/accounts/${encodeURIComponent(id)}/active`, { method: "POST", body: { active } }),

  listEntries: () => request("/api/entries"),
  createEntry: (entry, idempotencyKey) =>
    request("/api/entries", { method: "POST", body: entry, idempotencyKey }),
  updateEntry: (id, entry) =>
    request(`/api/entries/${encodeURIComponent(id)}`, { method: "PUT", body: entry }),
  deleteEntry: (id) => request(`/api/entries/${encodeURIComponent(id)}`, { method: "DELETE" }),
  postEntry: (id) =>
    request(`/api/entries/${encodeURIComponent(id)}/post`, { method: "POST", body: {} }),
  reverseEntry: (id, reason, idempotencyKey) =>
    request(`/api/entries/${encodeURIComponent(id)}/reverse`, {
      method: "POST",
      body: { reason },
      idempotencyKey,
    }),

  dashboard: () => request("/api/dashboard"),
  trialBalance: (params) => request(`/api/reports/trial-balance${queryString(params)}`),
  incomeStatement: (params) => request(`/api/reports/income-statement${queryString(params)}`),
  balanceSheet: (params) => request(`/api/reports/balance-sheet${queryString(params)}`),
};
