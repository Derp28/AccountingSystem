import { escapeHtml, qs, setFieldError } from "../dom.js";
import { brandMark, icon } from "../icons.js";
import { setProfile } from "../state.js";

function profileError(value) {
  const name = String(value || "").trim();
  if (!name) return "Enter your name or business name to continue.";
  if (name.length > 100) return "Keep the name to 100 characters or fewer.";
  return "";
}

export function renderOnboarding(state) {
  return `
    <div class="onboarding">
      <section class="onboarding-visual" aria-labelledby="onboarding-title">
        <div class="onboarding-brand">
          <span class="brand-mark">${brandMark(24)}</span>
          <div>
            <div class="brand-name">Ledgerline</div>
            <div class="brand-sub">Accounting workspace</div>
          </div>
        </div>

        <div class="onboarding-copy">
          <div class="onboarding-kicker">Local-first accounting</div>
          <h1 class="onboarding-title" id="onboarding-title">Keep the books clear, from the first entry.</h1>
          <p class="onboarding-sub">
            A structured workspace for your chart of accounts, business transactions,
            general journal, and manual adjustments. Start with your profile, then name the
            report you want to work in.
          </p>
        </div>

        <div class="onboarding-features">
          <div class="feature">${icon("journal", 16)}<span>Double-entry journal with debit and credit lines</span></div>
          <div class="feature">${icon("scale", 16)}<span>Balances and trial totals derived from posted entries</span></div>
          <div class="feature">${icon("adjustments", 16)}<span>Manual adjustments with a required reason</span></div>
          <div class="feature">${icon("lock", 16)}<span>Posted entries stay put; corrections use reversals</span></div>
        </div>
      </section>

      <section class="onboarding-content" aria-label="Profile setup">
        <div class="onboarding-form-card">
          <div class="onboarding-card-brand">
            <span class="brand-mark">${brandMark(24)}</span>
            <div>
              <div class="brand-name">Ledgerline</div>
              <div class="brand-sub">Accounting workspace</div>
            </div>
          </div>
          <div class="onboarding-step">Step 1 of 2 · Your profile</div>
          <h2 class="welcome-title">Welcome to Ledgerline</h2>
          <p class="welcome-sub">
            Tell us what to call you or your business. This name personalizes the dashboard
            and is stored in the local database on this machine.
          </p>

          <form class="onboarding-form" data-profile-form novalidate>
            <div class="field">
              <label class="label" for="profile-name">Your name or business name <span class="required" aria-hidden="true">*</span></label>
              <input
                class="input"
                id="profile-name"
                data-profile-name
                type="text"
                maxlength="100"
                autocomplete="organization"
                placeholder="e.g. Alder Studio or Jamie Rivera"
                required
                data-autofocus
              />
              <p class="field-error" id="profile-name-error" hidden></p>
            </div>

            <button class="btn btn-primary" type="submit">Continue to workspace</button>
          </form>

          <div class="onboarding-footnote">
            <strong>Saved on this machine.</strong> Your profile and workspace are stored in
            a local SQLite file. Nothing is sent to an external service.
          </div>
        </div>
      </section>
    </div>
  `;
}

export function mountOnboarding(root) {
  const form = qs("[data-profile-form]", root);
  if (!form) return;

  const input = qs("[data-profile-name]", root);
  const error = qs("#profile-name-error", root);
  const submitButton = form.querySelector("button[type=submit]");
  input?.focus();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = profileError(input.value);
    setFieldError(input, error, message);
    if (message) {
      input.focus();
      return;
    }

    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.innerHTML = `<span class="spinner" aria-hidden="true"></span> Saving…`;
    const result = await setProfile(input.value);
    if (!result.ok) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
      const fieldError = result.errors.find((item) => item.field === "name");
      setFieldError(input, error, fieldError ? fieldError.message : result.errors[0]?.message);
      input.focus();
    }
  });

  input?.addEventListener("input", () => {
    input.classList.remove("is-invalid");
    input.removeAttribute("aria-invalid");
    if (error) error.hidden = true;
  });
}
