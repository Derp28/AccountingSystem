async function request(path, options = {}) {
  const { method = "GET", body, headers = {}, idempotencyKey } = options;
  const requestHeaders = { Accept: "application/json", ...headers };
  const requestOptions = { method, headers: requestHeaders };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(body);
  }
  if (idempotencyKey) {
    requestHeaders["Idempotency-Key"] = idempotencyKey;
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
    throw error;
  }
  return payload;
}

export const api = {
  bootstrap: () => request("/api/bootstrap"),
  health: () => request("/api/health"),

  saveProfile: (name) => request("/api/profile", { method: "PUT", body: { name } }),
  saveWorkspace: (workspace) => request("/api/workspace", { method: "PUT", body: workspace }),

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
  postEntry: (id) => request(`/api/entries/${encodeURIComponent(id)}/post`, { method: "POST", body: {} }),
  reverseEntry: (id, reason, idempotencyKey) =>
    request(`/api/entries/${encodeURIComponent(id)}/reverse`, {
      method: "POST",
      body: { reason },
      idempotencyKey,
    }),

  dashboard: () => request("/api/dashboard"),
  trialBalance: () => request("/api/dashboard/trial-balance"),
};
