import { brandMark, icon } from "../icons.js";
import { clearFieldErrors, escapeHtml, qs, setFieldError } from "../dom.js";
import {
  currencyDatalist,
  currencyError,
  normalizeCurrency,
  workspaceNameError,
} from "../components/setup.js";
import { claimAccount, loginUser } from "../state.js";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;

function displayNameError(value) {
  const name = String(value || "").trim();
  if (!name) return "Enter your name or business name.";
  if (name.length > 100) return "Keep the name to 100 characters or fewer.";
  return "";
}

function usernameError(value) {
  const username = String(value || "").trim().toLowerCase();
  if (!username) return "Choose a username.";
  if (!USERNAME_PATTERN.test(username)) {
    return "Use 3–64 lowercase letters, numbers, dots, underscores, or hyphens.";
  }
  return "";
}

function passwordError(value) {
  const password = String(value || "");
  if (password.length < 12) return "Use a password with at least 12 characters.";
  if (password.length > 128) return "Keep the password to 128 characters or fewer.";
  return "";
}

function confirmError(password, confirm) {
  if (String(password || "") !== String(confirm || "")) return "The passwords do not match.";
  return "";
}

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

function visualPanel({ kicker, title, subtitle, features }) {
  return `
    <section class="onboarding-visual" aria-label="Ledgerline introduction">
      <div class="onboarding-brand">
        <span class="brand-mark">${brandMark(24)}</span>
        <div>
          <div class="brand-name">Ledgerline</div>
          <div class="brand-sub">Accounting workspace</div>
        </div>
      </div>

      <div class="onboarding-copy">
        <div class="onboarding-kicker">${escapeHtml(kicker)}</div>
        <h1 class="onboarding-title">${escapeHtml(title)}</h1>
        <p class="onboarding-sub">${escapeHtml(subtitle)}</p>
      </div>

      <div class="onboarding-features">
        ${features
          .map(
            (feature) =>
              `<div class="feature">${icon(feature.icon, 16)}<span>${escapeHtml(feature.text)}</span></div>`,
          )
          .join("")}
      </div>
    </section>
  `;
}

export function renderClaim(state) {
  const displayName = state.auth?.displayName || "";
  return `
    <div class="onboarding">
      ${visualPanel({
        kicker: "Local-first accounting",
        title: "Protect the books on this machine.",
        subtitle:
          "Create a local account for this installation. The password locks the running app; the database file stays on this computer, and this account can open more than one ledger.",
        features: [
          { icon: "lock", text: "Local username and password gate the running app" },
          { icon: "ledger", text: "One account, multiple separate ledgers" },
          { icon: "journal", text: "Posted entries stay immutable; corrections use reversals" },
          { icon: "chart", text: "Trial balance, income statement, and balance sheet" },
        ],
      })}

      <section class="onboarding-content" aria-label="Create local account">
        <div class="onboarding-form-card">
          ${brandCard()}
          <div class="onboarding-step">Secure this installation</div>
          <h2 class="welcome-title">Create your local account</h2>
          <p class="welcome-sub">
            This username and password protect the app on this machine. It is not an online
            account and nothing is sent to a server.
          </p>

          <form class="onboarding-form" data-claim-form novalidate>
            <div class="field">
              <label class="label" for="claim-display-name">Your name or business name <span class="required" aria-hidden="true">*</span></label>
              <input class="input" id="claim-display-name" type="text" maxlength="100" autocomplete="organization"
                value="${escapeHtml(displayName)}" data-autofocus />
              <p class="field-error" id="claim-display-name-error" hidden></p>
            </div>

            <div class="field">
              <label class="label" for="claim-username">Username <span class="required" aria-hidden="true">*</span></label>
              <input class="input" id="claim-username" type="text" maxlength="64" autocomplete="username" />
              <p class="help">Lowercase letters, numbers, dots, underscores, or hyphens.</p>
              <p class="field-error" id="claim-username-error" hidden></p>
            </div>

            <div class="field-row">
              <div class="field">
                <label class="label" for="claim-password">Password <span class="required" aria-hidden="true">*</span></label>
                <input class="input" id="claim-password" type="password" maxlength="128" autocomplete="new-password" />
                <p class="help">At least 12 characters.</p>
                <p class="field-error" id="claim-password-error" hidden></p>
              </div>
              <div class="field">
                <label class="label" for="claim-confirm">Confirm password <span class="required" aria-hidden="true">*</span></label>
                <input class="input" id="claim-confirm" type="password" maxlength="128" autocomplete="new-password" />
                <p class="field-error" id="claim-confirm-error" hidden></p>
              </div>
            </div>

            <div class="field-row">
              <div class="field">
                <label class="label" for="claim-ledger-name">First ledger name <span class="required" aria-hidden="true">*</span></label>
                <input class="input" id="claim-ledger-name" type="text" maxlength="80" placeholder="e.g. Studio books" />
                <p class="field-error" id="claim-ledger-name-error" hidden></p>
              </div>
              <div class="field">
                <label class="label" for="claim-currency">Currency <span class="required" aria-hidden="true">*</span></label>
                <input class="input" id="claim-currency" type="text" list="currency-options" maxlength="3" placeholder="USD" autocomplete="off" />
                ${currencyDatalist()}
                <p class="field-error" id="claim-currency-error" hidden></p>
              </div>
            </div>

            <div class="warning-panel">
              ${icon("alert", 17)}
              <span><strong>No email recovery.</strong> If you forget the password, reset it from this machine with <code>npm run auth:reset-password -- &lt;username&gt;</code>. Anyone with access to this computer can read or reset the local database.</span>
            </div>

            <button class="btn btn-primary" type="submit">Create local account</button>
          </form>

          <div class="onboarding-footnote">
            <strong>Protected, not encrypted.</strong> This login keeps casual users out of the
            running app. For data-at-rest protection, use full-disk encryption and keep the
            machine account locked.
          </div>
        </div>
      </section>
    </div>
  `;
}

export function mountClaim(root) {
  const form = qs("[data-claim-form]", root);
  if (!form) return;
  const displayNameInput = qs("#claim-display-name", root);
  const usernameInput = qs("#claim-username", root);
  const passwordInput = qs("#claim-password", root);
  const confirmInput = qs("#claim-confirm", root);
  const ledgerInput = qs("#claim-ledger-name", root);
  const currencyInput = qs("#claim-currency", root);
  const submitButton = form.querySelector("button[type=submit]");
  displayNameInput?.focus();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors(form);

    const errors = {
      displayName: displayNameError(displayNameInput.value),
      username: usernameError(usernameInput.value),
      password: passwordError(passwordInput.value),
      confirmPassword: confirmError(passwordInput.value, confirmInput.value),
      ledgerName: workspaceNameError(ledgerInput.value),
      currency: currencyError(currencyInput.value),
    };
    setFieldError(displayNameInput, qs("#claim-display-name-error", root), errors.displayName);
    setFieldError(usernameInput, qs("#claim-username-error", root), errors.username);
    setFieldError(passwordInput, qs("#claim-password-error", root), errors.password);
    setFieldError(confirmInput, qs("#claim-confirm-error", root), errors.confirmPassword);
    setFieldError(ledgerInput, qs("#claim-ledger-name-error", root), errors.ledgerName);
    setFieldError(currencyInput, qs("#claim-currency-error", root), errors.currency);

    const order = [
      ["displayName", displayNameInput],
      ["username", usernameInput],
      ["password", passwordInput],
      ["confirmPassword", confirmInput],
      ["ledgerName", ledgerInput],
      ["currency", currencyInput],
    ];
    const firstInvalid = order.find(([field]) => errors[field]);
    if (firstInvalid) {
      firstInvalid[1].focus();
      return;
    }

    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner" aria-hidden="true"></span> Securing…`;

    const result = await claimAccount({
      displayName: displayNameInput.value,
      username: usernameInput.value,
      password: passwordInput.value,
      confirmPassword: confirmInput.value,
      ledgerName: ledgerInput.value,
      currency: normalizeCurrency(currencyInput.value),
    });

    if (!result.ok) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
      const fieldMap = {
        displayName: [displayNameInput, "#claim-display-name-error"],
        username: [usernameInput, "#claim-username-error"],
        password: [passwordInput, "#claim-password-error"],
        confirmPassword: [confirmInput, "#claim-confirm-error"],
        ledgerName: [ledgerInput, "#claim-ledger-name-error"],
        name: [ledgerInput, "#claim-ledger-name-error"],
        currency: [currencyInput, "#claim-currency-error"],
      };
      for (const failure of result.errors) {
        const target = fieldMap[failure.field];
        if (target) setFieldError(target[0], qs(target[1], root), failure.message);
      }
      const firstField = result.errors.find((failure) => fieldMap[failure.field]);
      if (firstField) fieldMap[firstField.field][0].focus();
      else qs("#claim-username-error", root).textContent = firstMessage(result);
      return;
    }
  });
}

export function renderLogin(state) {
  const displayName = state.auth?.displayName || "your ledger";
  return `
    <div class="onboarding">
      ${visualPanel({
        kicker: "Local sign-in",
        title: "Welcome back to your books.",
        subtitle: `The local ledger for ${displayName} is locked. Sign in to continue.`,
        features: [
          { icon: "lock", text: "Only this installation's account can sign in" },
          { icon: "ledger", text: "Switch between ledgers after you sign in" },
          { icon: "journal", text: "Posted entries remain immutable" },
          { icon: "chart", text: "Reports stay scoped to the active ledger" },
        ],
      })}

      <section class="onboarding-content" aria-label="Sign in">
        <div class="onboarding-form-card">
          ${brandCard()}
          <div class="onboarding-step">Local sign-in</div>
          <h2 class="welcome-title">Sign in</h2>
          <p class="welcome-sub">Demo mode: the username is <strong>demo</strong> and any password works.</p>

          <form class="onboarding-form" data-login-form novalidate>
            <div class="field">
              <label class="label" for="login-username">Username <span class="required" aria-hidden="true">*</span></label>
              <input class="input" id="login-username" type="text" maxlength="64" autocomplete="username" data-autofocus />
              <p class="field-error" id="login-username-error" hidden></p>
            </div>

            <div class="field">
              <label class="label" for="login-password">Password <span class="required" aria-hidden="true">*</span></label>
              <input class="input" id="login-password" type="password" maxlength="128" autocomplete="current-password" />
              <p class="field-error" id="login-password-error" hidden></p>
            </div>

            <div class="form-error-summary" data-login-error hidden></div>

            <button class="btn btn-primary" type="submit">Sign in</button>
          </form>

          <div class="onboarding-footnote">
            <strong>Demo mode.</strong> The shipped app hashes the password with scrypt and resets it offline; nothing is checked here. Run
            <code>npm run auth:reset-password -- &lt;username&gt;</code> on the machine that runs the app.
          </div>
        </div>
      </section>
    </div>
  `;
}

export function mountLogin(root) {
  const form = qs("[data-login-form]", root);
  if (!form) return;
  const usernameInput = qs("#login-username", root);
  const passwordInput = qs("#login-password", root);
  const errorBox = qs("[data-login-error]", root);
  const submitButton = form.querySelector("button[type=submit]");
  usernameInput?.focus();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    errorBox.hidden = true;
    errorBox.textContent = "";

    if (!usernameInput.value.trim() || !passwordInput.value) {
      setFieldError(
        usernameInput,
        qs("#login-username-error", root),
        usernameInput.value.trim() ? "" : "Enter your username.",
      );
      setFieldError(
        passwordInput,
        qs("#login-password-error", root),
        passwordInput.value ? "" : "Enter your password.",
      );
      (usernameInput.value.trim() ? passwordInput : usernameInput).focus();
      return;
    }

    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner" aria-hidden="true"></span> Signing in…`;

    const result = await loginUser({
      username: usernameInput.value,
      password: passwordInput.value,
    });

    if (!result.ok) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
      errorBox.hidden = false;
      errorBox.textContent = firstMessage(result);
      passwordInput.value = "";
      passwordInput.focus();
    }
  });
}
