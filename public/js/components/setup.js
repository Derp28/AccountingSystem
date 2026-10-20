import { clearFieldErrors, escapeHtml, qs, setFieldError } from "../dom.js";
import { icon } from "../icons.js";
import { CURRENCY_OPTIONS } from "../mock-data.js";
import { getState, updateSettings } from "../state.js";
import { openModal } from "./modal.js";
import { showToast } from "./toast.js";

export function currencyDatalist() {
  return `
    <datalist id="currency-options">
      ${CURRENCY_OPTIONS.map(
        (currency) =>
          `<option value="${currency.code}">${escapeHtml(currency.label)}</option>`,
      ).join("")}
    </datalist>
  `;
}

export function normalizeCurrency(value) {
  return String(value || "").trim().toUpperCase();
}

export function currencyError(value) {
  const code = normalizeCurrency(value);
  if (!/^[A-Z]{3}$/.test(code)) return "Enter a three-letter currency code.";
  try {
    const supported = Intl.supportedValuesOf?.("currency");
    if (supported && !supported.includes(code)) {
      return "Choose a supported currency code.";
    }
    new Intl.NumberFormat("en-US", { style: "currency", currency: code });
    return "";
  } catch {
    return "Choose a supported currency code.";
  }
}

export function workspaceNameError(value) {
  const name = String(value || "").trim();
  if (!name) return "Give your report or workspace a name.";
  if (name.length > 80) return "Keep the workspace name to 80 characters or fewer.";
  return "";
}

function profileNameError(value) {
  const name = String(value || "").trim();
  if (!name) return "Enter your name or business name.";
  if (name.length > 100) return "Keep the name to 100 characters or fewer.";
  return "";
}

function fieldErrorHtml(id) {
  return `<p class="field-error" id="${id}" hidden></p>`;
}

function firstMessage(result, field) {
  const match = result.errors?.find((error) => error.field === field);
  return match?.message || result.errors?.[0]?.message || "The request failed.";
}

export function openSettingsModal() {
  const state = getState();
  if (!state.profile || !state.workspace) {
    showToast("Setup not complete", "Finish onboarding before opening settings.", "info");
    return;
  }

  const content = `
    <div class="modal-form">
      <div class="field">
        <label class="label" for="settings-profile-name">Your name or business name <span class="required" aria-hidden="true">*</span></label>
        <input class="input" id="settings-profile-name" data-profile-name type="text" maxlength="100" value="${escapeHtml(
          state.profile.name,
        )}" data-autofocus />
        ${fieldErrorHtml("settings-profile-error")}
      </div>

      <div class="field">
        <label class="label" for="settings-workspace-name">Report / workspace name <span class="required" aria-hidden="true">*</span></label>
        <input class="input" id="settings-workspace-name" data-workspace-name type="text" maxlength="80" value="${escapeHtml(
          state.workspace.name,
        )}" />
        ${fieldErrorHtml("settings-workspace-error")}
      </div>

      <div class="field">
        <label class="label" for="settings-currency">Currency <span class="required" aria-hidden="true">*</span></label>
        <input class="input" id="settings-currency" data-currency type="text" list="currency-options" maxlength="3" value="${escapeHtml(
          state.workspace.currency,
        )}" autocomplete="off" />
        ${currencyDatalist()}
        ${fieldErrorHtml("settings-currency-error")}
      </div>

      <div class="demo-note">
        ${icon("info", 17)}
        <span><strong>Saved locally.</strong> Changes are written to the SQLite database and kept after restart.</span>
      </div>
    </div>
  `;

  openModal({
    title: "Workspace settings",
    eyebrow: "Profile and report",
    description: "Rename the profile or workspace and change the display currency.",
    size: "modal-narrow",
    content,
    footer: `
      <button class="btn btn-secondary" type="button" data-cancel>Cancel</button>
      <button class="btn btn-primary" type="button" data-save-settings>Save changes</button>
    `,
    onMount(dialog, close) {
      const profileInput = qs("[data-profile-name]", dialog);
      const workspaceInput = qs("[data-workspace-name]", dialog);
      const currencyInput = qs("[data-currency]", dialog);
      const profileError = qs("#settings-profile-error", dialog);
      const workspaceErrorElement = qs("#settings-workspace-error", dialog);
      const currencyErrorElement = qs("#settings-currency-error", dialog);
      const saveButton = qs("[data-save-settings]", dialog);

      qs("[data-cancel]", dialog).addEventListener("click", close);

      saveButton.addEventListener("click", async () => {
        clearFieldErrors(dialog);
        const profileMessage = profileNameError(profileInput.value);
        const workspaceMessage = workspaceNameError(workspaceInput.value);
        const currencyMessage = currencyError(currencyInput.value);

        setFieldError(profileInput, profileError, profileMessage);
        setFieldError(workspaceInput, workspaceErrorElement, workspaceMessage);
        setFieldError(currencyInput, currencyErrorElement, currencyMessage);

        if (profileMessage || workspaceMessage || currencyMessage) {
          (profileMessage ? profileInput : workspaceMessage ? workspaceInput : currencyInput).focus();
          return;
        }

        saveButton.disabled = true;
        saveButton.innerHTML = `<span class="spinner" aria-hidden="true"></span> Saving…`;
        const result = await updateSettings({
          profileName: profileInput.value,
          workspaceName: workspaceInput.value,
          currency: normalizeCurrency(currencyInput.value),
        });
        if (!result.ok) {
          saveButton.disabled = false;
          saveButton.textContent = "Save changes";
          if (result.errors.some((error) => error.field === "name" && error.message.includes("100"))) {
            setFieldError(profileInput, profileError, firstMessage(result, "name"));
          } else if (result.errors.some((error) => error.field === "currency")) {
            setFieldError(currencyInput, currencyErrorElement, firstMessage(result, "currency"));
          } else if (result.errors.some((error) => error.field === "name")) {
            setFieldError(workspaceInput, workspaceErrorElement, firstMessage(result, "name"));
          } else {
            showToast("Could not save settings", firstMessage(result), "error");
          }
          return;
        }
        close();
        showToast("Settings saved", "Stored in the local database.", "success");
      });

      [profileInput, workspaceInput, currencyInput].forEach((input) => {
        input.addEventListener("input", () => {
          input.classList.remove("is-invalid");
          input.removeAttribute("aria-invalid");
          const targetError =
            input === profileInput
              ? profileError
              : input === workspaceInput
                ? workspaceErrorElement
                : currencyErrorElement;
          if (targetError) targetError.hidden = true;
        });
      });
    },
  });
}
