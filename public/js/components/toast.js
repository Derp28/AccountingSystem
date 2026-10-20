import { escapeHtml } from "../dom.js";
import { icon } from "../icons.js";

const MAX_TOASTS = 4;

export function showToast(title, message = "", tone = "success", timeout = 6500) {
  const region = document.getElementById("toast-region");
  if (!region) return;

  while (region.children.length >= MAX_TOASTS) {
    region.firstElementChild?.remove();
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.setAttribute("role", "status");
  const iconName = tone === "error" ? "alert-circle" : tone === "info" ? "info" : "check-circle";
  toast.innerHTML = `
    <span class="toast-icon">${icon(iconName, 18)}</span>
    <div class="toast-message">
      <strong>${escapeHtml(title)}</strong>
      ${message ? `<span>${escapeHtml(message)}</span>` : ""}
    </div>
    <button class="toast-close" type="button" aria-label="Dismiss notification">×</button>
  `;

  const remove = () => toast.remove();
  toast.querySelector(".toast-close").addEventListener("click", remove);
  region.appendChild(toast);

  if (timeout > 0) {
    window.setTimeout(remove, timeout);
  }

  return toast;
}
