import {
  CATEGORIES,
  CATEGORY_MAP,
  accountDisplayBalance,
  getCategory,
  nextAccountCode,
  validateAccountInput,
} from "../accounting.js";
import { escapeHtml, qs, qsa, setFieldError, clearFieldErrors } from "../dom.js";
import { formatMoney } from "../format.js";
import { icon } from "../icons.js";
import { addAccount, getState, setAccountActive, setUiFilter, updateAccount } from "../state.js";
import { openConfirm, openModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { emptyState, pageHeader } from "../components/ui.js";

function categoryOptions(selected) {
  return CATEGORIES.map(
    (category) =>
      `<option value="${category.id}" ${category.id === selected ? "selected" : ""}>${category.label}</option>`,
  ).join("");
}

function displayBalance(account, state) {
  return typeof account.balanceCents === "number"
    ? account.balanceCents
    : accountDisplayBalance(account, state.entries);
}

function accountRowHtml(account, state, currency) {
  const balance = displayBalance(account, state);
  const category = getCategory(account.category);
  return `
    <tr
      data-account-row
      data-account-code="${escapeHtml(account.code)}"
      data-category="${account.category}"
      data-status="${account.active ? "active" : "inactive"}"
      data-search="${escapeHtml(`${account.code} ${account.name} ${account.description}`.toLowerCase())}"
      class="${account.active ? "" : "is-inactive"}"
    >
      <td data-label="Code"><span class="account-code">${escapeHtml(account.code)}</span></td>
      <td data-label="Account">
        <div class="account-name">${escapeHtml(account.name)}</div>
        <div class="account-description">${escapeHtml(account.description || "No description")}</div>
      </td>
      <td data-label="Normal balance"><span class="muted">${escapeHtml(
        category.normal === "debit" ? "Debit" : "Credit",
      )}</span></td>
      <td class="num" data-label="Balance">${escapeHtml(formatMoney(balance, currency))}</td>
      <td data-label="Status">
        <span class="badge ${account.active ? "badge-posted" : "badge-inactive"}">${
          account.active ? "Active" : "Inactive"
        }</span>
      </td>
      <td data-label="Actions">
        <div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm" type="button" data-edit-account="${escapeHtml(
            account.id,
          )}" aria-label="Edit ${escapeHtml(account.name)}">${icon("edit", 15)}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-toggle-account="${escapeHtml(
            account.id,
          )}" aria-label="${account.active ? "Deactivate" : "Activate"} ${escapeHtml(
            account.name,
          )}">${account.active ? "Deactivate" : "Activate"}</button>
        </div>
      </td>
    </tr>
  `;
}

export function renderAccounts(container, state) {
  const currency = state.workspace?.currency || "USD";
  const filters = state.ui.accounts;

  const groups = CATEGORIES.map((category) => {
    const accounts = state.accounts
      .filter((account) => account.category === category.id)
      .sort((left, right) =>
        left.code.localeCompare(right.code, undefined, { numeric: true }),
      );
    if (accounts.length === 0) return "";
    const total = accounts.reduce(
      (sum, account) => sum + displayBalance(account, state),
      0,
    );
    return `
      <section class="account-group" data-account-group="${category.id}" aria-labelledby="account-group-${category.id}">
        <div class="account-group-header">
          <div>
            <div class="account-group-title" id="account-group-${category.id}">
              ${escapeHtml(category.label)}
              <span class="badge badge-posted">${accounts.length}</span>
            </div>
            <div class="account-group-meta">${escapeHtml(category.description)}</div>
          </div>
          <div class="account-group-meta">Group balance <strong>${escapeHtml(
            formatMoney(total, currency),
          )}</strong></div>
        </div>
        <div class="table-wrap">
          <table class="data-table responsive-table">
            <caption class="sr-only">${escapeHtml(category.label)} accounts</caption>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Account</th>
                <th scope="col">Normal balance</th>
                <th scope="col" class="num">Balance</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              ${accounts.map((account) => accountRowHtml(account, state, currency)).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }).join("");

  container.innerHTML = `
    <div class="page accounts-page" data-page="accounts">
      ${pageHeader({
        eyebrow: "Chart of accounts",
        title: "Chart of Accounts",
        description:
          "Classify financial activity across assets, liabilities, equity, revenue, and expenses. Inactive accounts remain in historical entries but cannot be used for new postings.",
        actions: `<button class="btn btn-primary" type="button" data-add-account>${icon(
          "plus",
          16,
        )} Add account</button>`,
      })}

      <div class="toolbar">
        <div class="filter-bar">
          <div class="search-field">
            ${icon("search", 16)}
            <input class="input" type="search" placeholder="Search code, name, or description" aria-label="Search accounts" data-account-search value="${escapeHtml(
              filters.query,
            )}" />
          </div>
          <select class="select" style="width:auto" aria-label="Filter by category" data-account-category>
            <option value="ALL">All categories</option>
            ${CATEGORIES.map(
              (category) =>
                `<option value="${category.id}" ${
                  filters.category === category.id ? "selected" : ""
                }>${category.label}</option>`,
            ).join("")}
          </select>
          <select class="select" style="width:auto" aria-label="Filter by status" data-account-status>
            <option value="ALL" ${filters.status === "ALL" ? "selected" : ""}>All statuses</option>
            <option value="active" ${filters.status === "active" ? "selected" : ""}>Active</option>
            <option value="inactive" ${filters.status === "inactive" ? "selected" : ""}>Inactive</option>
          </select>
        </div>
        <div class="help" data-account-count>${state.accounts.length} accounts</div>
      </div>

      <div data-account-groups>${groups}</div>

      <div data-account-empty hidden>
        ${emptyState({
          iconName: "search",
          title: "No accounts match",
          text: "Try a different search term or clear the category and status filters.",
          action: `<button class="btn btn-secondary btn-sm" type="button" data-clear-account-filters>Clear filters</button>`,
        })}
      </div>

      ${
        state.accounts.length === 0
          ? emptyState({
              iconName: "accounts",
              title: "No accounts yet",
              text: "Add your first account to start classifying transactions.",
              action: `<button class="btn btn-primary btn-sm" type="button" data-add-account>Add account</button>`,
            })
          : ""
      }

      <div class="demo-note">
        ${icon("info", 17)}
        <span>Accounts are stored in the local database. Inactive accounts keep their posted history but cannot be used for new entries or postings.</span>
      </div>
    </div>
  `;

  function applyFilters() {
    const query = qs("[data-account-search]", container).value.trim().toLowerCase();
    const category = qs("[data-account-category]", container).value;
    const status = qs("[data-account-status]", container).value;
    setUiFilter("accounts", { query, category, status });

    let visibleCount = 0;
    qsa("[data-account-row]", container).forEach((row) => {
      const matchesQuery = !query || row.dataset.search.includes(query);
      const matchesCategory = category === "ALL" || row.dataset.category === category;
      const matchesStatus = status === "ALL" || row.dataset.status === status;
      const visible = matchesQuery && matchesCategory && matchesStatus;
      row.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    qsa("[data-account-group]", container).forEach((group) => {
      const hasVisible = Boolean(qs("[data-account-row]:not([hidden])", group));
      group.hidden = !hasVisible;
    });

    const empty = qs("[data-account-empty]", container);
    if (empty) empty.hidden = visibleCount > 0 || state.accounts.length === 0;

    const count = qs("[data-account-count]", container);
    if (count) {
      count.textContent = `${visibleCount} of ${state.accounts.length} accounts`;
    }
  }

  qs("[data-account-search]", container).addEventListener("input", applyFilters);
  qs("[data-account-category]", container).addEventListener("change", applyFilters);
  qs("[data-account-status]", container).addEventListener("change", applyFilters);

  qs("[data-clear-account-filters]", container)?.addEventListener("click", () => {
    qs("[data-account-search]", container).value = "";
    qs("[data-account-category]", container).value = "ALL";
    qs("[data-account-status]", container).value = "ALL";
    applyFilters();
    qs("[data-account-search]", container).focus();
  });

  container.querySelectorAll("[data-add-account]").forEach((button) => {
    button.addEventListener("click", () => openAccountEditor());
  });

  container.querySelectorAll("[data-edit-account]").forEach((button) => {
    button.addEventListener("click", () => {
      const account = state.accounts.find((candidate) => candidate.id === button.dataset.editAccount);
      if (account) openAccountEditor(account);
    });
  });

  container.querySelectorAll("[data-toggle-account]").forEach((button) => {
    button.addEventListener("click", async () => {
      const account = state.accounts.find(
        (candidate) => candidate.id === button.dataset.toggleAccount,
      );
      if (!account) return;

      if (account.active) {
        openConfirm({
          title: `Deactivate ${account.code}?`,
          description: `${account.name} will remain in historical entries.`,
          message:
            "Inactive accounts cannot be used for new drafts or postings. You can reactivate the account at any time. Existing posted balances are preserved.",
          confirmLabel: "Deactivate account",
          tone: "danger",
          async onConfirm() {
            const result = await setAccountActive(account.id, false);
            if (!result.ok) throw new Error(result.errors.map((error) => error.message).join(" "));
            showToast("Account deactivated", "The account is no longer available for new entries.", "info");
          },
        });
      } else {
        const result = await setAccountActive(account.id, true);
        if (!result.ok) {
          showToast("Could not reactivate account", result.errors[0]?.message, "error");
          return;
        }
        showToast("Account reactivated", "The account is available for new entries.", "success");
      }
    });
  });

  applyFilters();
}

function openAccountEditor(account = null) {
  const state = getState();
  const isEdit = Boolean(account);
  const initialCategory = account?.category || "ASSET";
  const initialCode = account?.code || nextAccountCode(state.accounts, initialCategory);
  const content = `
    <form class="modal-form" data-account-form novalidate>
      <div class="field-row">
        <div class="field">
          <label class="label" for="account-code">Account code <span class="required" aria-hidden="true">*</span></label>
          <input class="input" id="account-code" data-account-code-input type="text" maxlength="3" inputmode="numeric" value="${escapeHtml(
            initialCode,
          )}" placeholder="e.g. 104" data-autofocus />
          <p class="field-error" id="account-code-error" hidden></p>
          <p class="help">Prefilled with the next code. Assets 100–199 · Liabilities 200–299 · Equity 300–399 · Revenue 400–499 · Expenses 500–599.</p>
        </div>
        <div class="field">
          <label class="label" for="account-category-input">Category <span class="required" aria-hidden="true">*</span></label>
          <select class="select" id="account-category-input" data-account-category-input>
            ${categoryOptions(account?.category || "ASSET")}
          </select>
          <p class="field-error" id="account-category-error" hidden></p>
        </div>
      </div>

      <div class="field">
        <label class="label" for="account-name">Account name <span class="required" aria-hidden="true">*</span></label>
        <input class="input" id="account-name" data-account-name type="text" maxlength="80" value="${escapeHtml(
          account?.name || "",
        )}" placeholder="e.g. Software subscriptions" />
        <p class="field-error" id="account-name-error" hidden></p>
      </div>

      <div class="field">
        <label class="label" for="account-description">Description <span class="muted">(optional)</span></label>
        <textarea class="textarea" id="account-description" data-account-description maxlength="200" placeholder="What belongs in this account?">${escapeHtml(
          account?.description || "",
        )}</textarea>
        <p class="field-error" id="account-description-error" hidden></p>
        <p class="help">Normal balance is derived from the category: assets and expenses are debit-normal; liabilities, equity, and revenue are credit-normal.</p>
      </div>

      <label class="cluster" style="display:flex; align-items:center; gap:9px; font-size:12.5px">
        <input type="checkbox" data-account-active ${account?.active !== false ? "checked" : ""} />
        <span>Account is active and available for new entries</span>
      </label>

      <div class="demo-note">
        ${icon("info", 17)}
        <span>Changes are saved to the local database. Existing posted lines keep their account reference.</span>
      </div>
    </form>
  `;

  openModal({
    title: isEdit ? `Edit ${account.code}` : "Add account",
    eyebrow: "Chart of accounts",
    description: isEdit
      ? "Update the account label, classification, or availability."
      : "Create a new account for classifying financial activity.",
    size: "modal-narrow",
    content,
    footer: `
      <button class="btn btn-secondary" type="button" data-cancel>Cancel</button>
      <button class="btn btn-primary" type="button" data-save-account>${isEdit ? "Save changes" : "Add account"}</button>
    `,
    onMount(dialog, close) {
      const codeInput = qs("[data-account-code-input]", dialog);
      const nameInput = qs("[data-account-name]", dialog);
      const categoryInput = qs("[data-account-category-input]", dialog);
      const descriptionInput = qs("[data-account-description]", dialog);
      const activeInput = qs("[data-account-active]", dialog);
      const errors = {
        code: qs("#account-code-error", dialog),
        name: qs("#account-name-error", dialog),
        category: qs("#account-category-error", dialog),
        description: qs("#account-description-error", dialog),
      };
      const saveButton = qs("[data-save-account]", dialog);

      qs("[data-cancel]", dialog).addEventListener("click", close);
      codeInput.focus();
      if (!isEdit) {
        codeInput.value = nextAccountCode(state.accounts, categoryInput.value);
        codeInput.select();
      }

      let codeEdited = false;
      codeInput.addEventListener("input", () => {
        codeEdited = true;
        codeInput.classList.remove("is-invalid");
        codeInput.removeAttribute("aria-invalid");
        errors.code.hidden = true;
      });
      categoryInput.addEventListener("change", () => {
        if (isEdit || codeEdited) return;
        codeInput.value = nextAccountCode(state.accounts, categoryInput.value);
        codeInput.classList.remove("is-invalid");
        codeInput.removeAttribute("aria-invalid");
        errors.code.hidden = true;
      });

      saveButton.addEventListener("click", async () => {
        clearFieldErrors(dialog);
        const payload = {
          code: codeInput.value,
          name: nameInput.value,
          category: categoryInput.value,
          description: descriptionInput.value,
          active: activeInput.checked,
        };
        const validation = validateAccountInput(payload, state.accounts, {
          excludeId: account?.id || null,
        });

        if (!validation.valid) {
          setFieldError(codeInput, errors.code, validation.errors.code);
          setFieldError(nameInput, errors.name, validation.errors.name);
          setFieldError(categoryInput, errors.category, validation.errors.category);
          setFieldError(descriptionInput, errors.description, validation.errors.description);
          (validation.errors.code
            ? codeInput
            : validation.errors.name
              ? nameInput
              : categoryInput
          ).focus();
          return;
        }

        saveButton.disabled = true;
        saveButton.innerHTML = `<span class="spinner" aria-hidden="true"></span> Saving…`;
        const result = isEdit
          ? await updateAccount(account.id, payload)
          : await addAccount(payload);

        if (!result.ok) {
          saveButton.disabled = false;
          saveButton.textContent = isEdit ? "Save changes" : "Add account";
          const byField = Object.fromEntries(result.errors.map((error) => [error.field, error.message]));
          setFieldError(codeInput, errors.code, byField.code);
          setFieldError(nameInput, errors.name, byField.name);
          setFieldError(categoryInput, errors.category, byField.category);
          setFieldError(descriptionInput, errors.description, byField.description);
          if (!byField.code && !byField.name && !byField.category && !byField.description) {
            showToast("Could not save account", result.errors[0]?.message, "error");
          }
          (byField.code ? codeInput : byField.name ? nameInput : codeInput).focus();
          return;
        }

        close();
        showToast(
          isEdit ? "Account updated" : "Account added",
          "The chart of accounts was updated in the local database.",
          "success",
        );
      });
    },
  });
}
