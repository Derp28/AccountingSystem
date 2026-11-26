import { escapeHtml, focusFirst, qs } from "../dom.js";
import { icon } from "../icons.js";

let modalSequence = 0;

/**
 * Open an accessible native dialog. Native <dialog> supplies the focus trap;
 * this helper handles Escape, backdrop clicks, focus return, and cleanup.
 */
export function openModal({
  title,
  eyebrow = "",
  description = "",
  content = "",
  footer = "",
  size = "",
  dismissible = true,
  initialFocus = null,
  onMount = null,
  onClose = null,
}) {
  modalSequence += 1;
  const titleId = `modal-title-${modalSequence}`;
  const descriptionId = `modal-description-${modalSequence}`;
  const previouslyFocused = document.activeElement;

  const dialog = document.createElement("dialog");
  dialog.className = `modal ${size}`.trim();
  dialog.setAttribute("aria-labelledby", titleId);
  if (description) dialog.setAttribute("aria-describedby", descriptionId);

  dialog.innerHTML = `
    <div class="modal-shell">
      <header class="modal-header">
        <div class="modal-heading">
          ${eyebrow ? `<div class="modal-eyebrow">${escapeHtml(eyebrow)}</div>` : ""}
          <h2 class="modal-title" id="${titleId}">${escapeHtml(title)}</h2>
          ${
            description
              ? `<p class="modal-description" id="${descriptionId}">${escapeHtml(description)}</p>`
              : ""
          }
        </div>
        ${
          dismissible
            ? `<button class="btn btn-ghost btn-icon modal-close" type="button" aria-label="Close dialog">${icon("close", 18)}</button>`
            : ""
        }
      </header>
      <div class="modal-body">${content}</div>
      ${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}
    </div>
  `;

  function close() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener("close", () => {
    dialog.remove();
    onClose?.();
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
  });

  dialog.addEventListener("cancel", (event) => {
    if (!dismissible) event.preventDefault();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && dismissible) close();
  });

  if (dismissible) {
    qs(".modal-close", dialog).addEventListener("click", close);
  }

  document.body.appendChild(dialog);
  dialog.showModal();

  onMount?.(dialog, close);

  if (initialFocus) {
    focusFirst(dialog, initialFocus);
  } else {
    const auto = qs("[data-autofocus]", dialog);
    if (auto) auto.focus();
    else focusFirst(dialog, "input:not([type=hidden]), select, textarea, button, a[href]");
  }

  return { dialog, close };
}

export function openConfirm({
  title,
  eyebrow = "Please confirm",
  description = "",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
}) {
  return openModal({
    title,
    eyebrow,
    description,
    size: "modal-narrow",
    content: `<p class="help" style="font-size:12.5px; line-height:1.6">${escapeHtml(message)}</p>
      <div class="form-error-summary" data-confirm-error hidden></div>`,
    footer: `
      <button class="btn btn-secondary" type="button" data-cancel>${escapeHtml(cancelLabel)}</button>
      <button class="btn ${tone === "danger" ? "btn-danger" : "btn-primary"}" type="button" data-confirm>${escapeHtml(confirmLabel)}</button>
    `,
    onMount(dialog, close) {
      const errorBox = qs("[data-confirm-error]", dialog);
      const confirmButton = qs("[data-confirm]", dialog);
      qs("[data-cancel]", dialog).addEventListener("click", close);
      confirmButton.addEventListener("click", async () => {
        confirmButton.disabled = true;
        confirmButton.innerHTML = `<span class="spinner" aria-hidden="true"></span> Working…`;
        try {
          await onConfirm?.();
          close();
        } catch (error) {
          errorBox.hidden = false;
          errorBox.textContent = error?.message || "Something went wrong.";
          confirmButton.disabled = false;
          confirmButton.textContent = confirmLabel;
        }
      });
    },
  });
}

export function showDetailError(dialog, errors) {
  const box = qs("[data-detail-errors]", dialog);
  if (!box) return;
  const messages = (errors || []).map((error) => error.message || String(error));
  box.hidden = false;
  box.innerHTML = `<strong>Could not continue</strong><ul>${messages
    .map((message) => `<li>${escapeHtml(message)}</li>`)
    .join("")}</ul>`;
}
