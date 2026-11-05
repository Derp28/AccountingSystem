import {
  currencyDatalist,
  currencyError,
  normalizeCurrency,
  workspaceNameError,
} from "../components/setup.js";
import { showToast } from "../components/toast.js";
import { clearFieldErrors, escapeHtml, qs, setFieldError } from "../dom.js";
import { brandMark, icon } from "../icons.js";
import { setWorkspace } from "../state.js";

function firstMessage(result, field) {
  const match = result.errors?.find((error) => error.field === field);
  return match?.message || result.errors?.[0]?.message || "The request failed.";
}

function brandCard() {
  return `
    <div class="onboarding-card-brand">
      <span class="brand-mark">${brandMark(24)}</span>
      <div>
        <div class="brand-name">Ledgerline</div>
        <div class="brand-sub">Accounting workspace</div>
      </div>
    </div>
  `;
}

export function renderWorkspaceSetup(state) {
  const profileName = state.profile?.name || "there";

  return `
    <div class="onboarding onboarding--workspace">
      <section class="onboarding-visual" aria-label="Workspace introduction">
        <div class="onboarding-brand">
          <span class="brand-mark">${brandMark(24)}</span>
          <div>
            <div class="brand-name">Ledgerline</div>
            <div class="brand-sub">Accounting workspace</div>
          </div>
        </div>

        <div class="onboarding-copy">
          <div class="onboarding-kicker">One last setup step</div>
          <h2 class="onboarding-title">Your books need a name.</h2>
          <p class="onboarding-sub">
            Choose the workspace label and display currency. This is a report name,
            not an accounting period, and you can rename it later in settings.
          </p>
        </div>

        <div class="onboarding-features">
          <div class="feature">${icon("journal", 16)}<span>One local workspace backed by SQLite</span></div>
          <div class="feature">${icon("scale", 16)}<span>Balances update only when entries are posted</span></div>
          <div class="feature">${icon("lock", 16)}<span>Posted entries stay put; corrections use reversals</span></div>
        </div>
      </section>

      <section class="onboarding-content" aria-label="Workspace setup">
        <div class="onboarding-form-card">
          ${brandCard()}
          <div class="onboarding-step">Step 2 of 2 · Your workspace</div>
          <h1 class="welcome-title">Name your workspace</h1>
          <p class="welcome-sub">
            Welcome, ${escapeHtml(profileName)}. Name the report or workspace you want to
            open. This is a workspace label, not an accounting period.
          </p>

          <form class="onboarding-form" data-workspace-form novalidate>
            <div class="field">
              <label class="label" for="setup-workspace-name">Report / workspace name <span class="required" aria-hidden="true">*</span></label>
              <input
                class="input"
                id="setup-workspace-name"
                data-workspace-name
                type="text"
                maxlength="80"
                placeholder="e.g. Studio books 2026"
                autocomplete="organization"
                required
                data-autofocus
              />
              <p class="field-error" id="setup-workspace-error" hidden></p>
              <p class="help">You can rename this later from workspace settings.</p>
            </div>

            <div class="field">
              <label class="label" for="setup-currency">Currency <span class="required" aria-hidden="true">*</span></label>
              <input
                class="input"
                id="setup-currency"
                data-currency
                type="text"
                list="currency-options"
                maxlength="3"
                placeholder="e.g. USD"
                autocomplete="off"
                required
              />
              ${currencyDatalist()}
              <p class="field-error" id="setup-currency-error" hidden></p>
              <p class="help">Used for display only. This app does not convert currencies.</p>
            </div>

            <button class="btn btn-primary" type="submit">Open workspace</button>
          </form>

          <div class="onboarding-footnote">
            <strong>Saved on this machine.</strong> Your workspace is written to the local
            SQLite database and kept after restart.
          </div>
        </div>
      </section>
    </div>
  `;
}

export function mountWorkspaceSetup(root) {
  const form = qs("[data-workspace-form]", root);
  if (!form) return;

  const nameInput = qs("[data-workspace-name]", root);
  const currencyInput = qs("[data-currency]", root);
  const nameError = qs("#setup-workspace-error", root);
  const currencyErrorElement = qs("#setup-currency-error", root);
  const submitButton = form.querySelector("button[type=submit]");

  nameInput?.focus({ preventScroll: true });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors(form);

    const nameMessage = workspaceNameError(nameInput.value);
    const currencyMessage = currencyError(currencyInput.value);
    setFieldError(nameInput, nameError, nameMessage);
    setFieldError(currencyInput, currencyErrorElement, currencyMessage);

    if (nameMessage || currencyMessage) {
      (nameMessage ? nameInput : currencyInput).focus({ preventScroll: true });
      return;
    }

    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner" aria-hidden="true"></span> Saving…`;

    const result = await setWorkspace({
      name: nameInput.value,
      currency: normalizeCurrency(currencyInput.value),
    });

    if (!result.ok) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
      const nameFailure = result.errors.find((error) => error.field === "name");
      const currencyFailure = result.errors.find((error) => error.field === "currency");
      if (nameFailure) setFieldError(nameInput, nameError, nameFailure.message);
      if (currencyFailure) {
        setFieldError(currencyInput, currencyErrorElement, currencyFailure.message);
      }
      if (!nameFailure && !currencyFailure) {
        showToast("Could not save workspace", firstMessage(result), "error");
      }
      (nameFailure ? nameInput : currencyInput).focus({ preventScroll: true });
      return;
    }

    showToast("Workspace saved", "Your workspace is ready.", "success");
  });

  [nameInput, currencyInput].forEach((input) => {
    input.addEventListener("input", () => {
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
      const targetError = input === nameInput ? nameError : currencyErrorElement;
      if (targetError) targetError.hidden = true;
    });
  });
}
