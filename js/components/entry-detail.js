import {
  entryStatus,
  getAccount,
  getSourceMeta,
  entryTotalCredit,
  entryTotalDebit,
} from "../accounting.js";
import { escapeHtml, qs } from "../dom.js";
import { formatDate, formatDateTime, formatMoney } from "../format.js";
import { icon } from "../icons.js";
import { deleteDraft, getState, postEntry, reverseEntry } from "../state.js";
import { openEntryEditor } from "./entry-form.js";
import { openConfirm, openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { sourceBadge, statusBadge } from "./ui.js";

export function openEntryDetail(entryId) {
  const state = getState();
  const entry = state.entries.find((candidate) => candidate.id === entryId);
  if (!entry) {
    showToast("Entry not found", "Reload the page to re-read the demo ledger.", "error");
    return;
  }

  const currency = state.workspace?.currency || "USD";
  const meta = getSourceMeta(entry.sourceType);
  const debit = entryTotalDebit(entry);
  const credit = entryTotalCredit(entry);
  const isDraft = entry.status === "DRAFT";
  const reversal = entry.reversedBy
    ? state.entries.find((candidate) => candidate.id === entry.reversedBy)
    : null;
  const original = entry.reversalOf
    ? state.entries.find((candidate) => candidate.id === entry.reversalOf)
    : null;

  const accountRows = (entry.lines || [])
    .map((line) => {
      const account = getAccount(state.accounts, line.accountId);
      return `
        <tr>
          <td data-label="Account">
            ${
              account
                ? `<span class="account-code">${escapeHtml(account.code)}</span> ${escapeHtml(account.name)}`
                : `<span class="muted">Unassigned account</span>`
            }
          </td>
          <td data-label="Description">${escapeHtml(line.description || "—")}</td>
          <td class="num" data-label="Debit">${
            line.debitCents ? escapeHtml(formatMoney(line.debitCents, currency)) : "—"
          }</td>
          <td class="num" data-label="Credit">${
            line.creditCents ? escapeHtml(formatMoney(line.creditCents, currency)) : "—"
          }</td>
        </tr>
      `;
    })
    .join("");

  const notes = [];
  if (entry.adjustmentType) {
    notes.push(`
      <div class="info-panel">
        ${icon("adjustments", 17)}
        <span><strong>${escapeHtml(entry.adjustmentType.replaceAll("_", " "))}</strong><br />
        ${escapeHtml(entry.adjustmentReason || "No reason recorded.")}</span>
      </div>
    `);
  }
  if (reversal) {
    notes.push(`
      <div class="reversal-note">
        ${icon("reverse", 17)}
        <span><strong>This entry has been reversed.</strong> ${escapeHtml(
          entry.reversalReason || "A linked reversal entry was created.",
        )}</span>
      </div>
    `);
  }
  if (original) {
    notes.push(`
      <div class="warning-panel">
        ${icon("info", 17)}
        <span><strong>Reversal entry.</strong> This entry offsets ${escapeHtml(original.entryNo)}. ${escapeHtml(
          entry.reversalReason || "",
        )}</span>
      </div>
    `);
  }

  const footerActions = [];
  footerActions.push(`<button class="btn btn-secondary" type="button" data-close>Close</button>`);
  if (reversal) {
    footerActions.push(
      `<button class="btn btn-secondary" type="button" data-view-reversal>View reversal</button>`,
    );
  } else if (original) {
    footerActions.push(
      `<button class="btn btn-secondary" type="button" data-view-original>View original</button>`,
    );
  }

  if (isDraft) {
    footerActions.push(`<button class="btn btn-danger-ghost" type="button" data-delete>Delete draft</button>`);
    footerActions.push(`<button class="btn btn-secondary" type="button" data-edit>Edit draft</button>`);
    footerActions.push(`<button class="btn btn-primary" type="button" data-post>Post entry…</button>`);
  } else if (!entry.reversalOf && !entry.reversedBy) {
    footerActions.push(`<button class="btn btn-danger-ghost" type="button" data-reverse>Reverse entry…</button>`);
  }

  const content = `
    <div class="modal-form">
      <div class="detail-header">
        <div>
          <div class="detail-title-row" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
            ${sourceBadge(entry.sourceType)}
            ${statusBadge(entry)}
          </div>
          <h3 class="section-title" style="margin-top:8px">${escapeHtml(entry.memo)}</h3>
          <p class="help">${escapeHtml(meta.description)}</p>
        </div>
        <div class="text-right">
          <div class="adjustment-amount">${escapeHtml(formatMoney(debit, currency))}</div>
          <div class="adjustment-meta">${escapeHtml(entry.entryNo)}</div>
        </div>
      </div>

      <div class="detail-meta">
        <div class="detail-meta-item"><span>Entry number</span><strong>${escapeHtml(entry.entryNo)}</strong></div>
        <div class="detail-meta-item"><span>Entry date</span><strong>${escapeHtml(formatDate(entry.date))}</strong></div>
        <div class="detail-meta-item"><span>Reference</span><strong>${escapeHtml(entry.reference || "—")}</strong></div>
        <div class="detail-meta-item"><span>${entry.postedAt ? "Posted" : "Created"}</span><strong>${escapeHtml(
          formatDateTime(entry.postedAt || entry.createdAt),
        )}</strong></div>
      </div>

      ${notes.join("")}

      <div class="detail-lines">
        <table class="data-table responsive-table">
          <caption class="sr-only">Debit and credit lines for ${escapeHtml(entry.entryNo)}</caption>
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Description</th>
              <th scope="col" class="num">Debit</th>
              <th scope="col" class="num">Credit</th>
            </tr>
          </thead>
          <tbody>${accountRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="strong">Totals</td>
              <td class="num strong" data-label="Debit">${escapeHtml(formatMoney(debit, currency))}</td>
              <td class="num strong" data-label="Credit">${escapeHtml(formatMoney(credit, currency))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="form-error-summary" data-detail-errors hidden></div>
      <div class="demo-note">
        ${icon("info", 17)}
        <span>${isDraft ? "Draft entries are kept in this demo tab and remain editable until posting." : "Posted entries are stored immutably; corrections use a linked reversal."}</span>
      </div>
    </div>
  `;

  openModal({
    title: entry.entryNo,
    eyebrow: isDraft ? "Draft entry" : "Journal entry",
    description: `${meta.label} · ${formatDate(entry.date)}`,
    size: "modal-wide",
    content,
    footer: footerActions.join(""),
    onMount(dialog, close) {
      qs("[data-close]", dialog)?.addEventListener("click", close);

      qs("[data-edit]", dialog)?.addEventListener("click", () => {
        close();
        openEntryEditor({
          entry,
          allowedTypes: [entry.sourceType],
        });
      });

      qs("[data-delete]", dialog)?.addEventListener("click", () => {
        close();
        openConfirm({
          title: "Delete this draft?",
          description: `${entry.entryNo} is not posted and can be removed.`,
          message: "This removes the draft from this demo tab. It cannot be undone.",
          confirmLabel: "Delete draft",
          tone: "danger",
          async onConfirm() {
            const result = await deleteDraft(entry.id);
            if (!result.ok) throw new Error(result.errors.map((error) => error.message).join(" "));
            showToast("Draft deleted", "The draft was removed from this demo tab.", "info");
          },
        });
      });

      qs("[data-post]", dialog)?.addEventListener("click", () => {
        close();
        openConfirm({
          title: "Post this entry?",
          description: `${entry.entryNo} will become a permanent posted journal entry.`,
          message:
            "Posting revalidates balance, accounts, date, and memo. Once posted, the entry cannot be edited or deleted; corrections use a reversal. Drafts are excluded from balances until posted.",
          confirmLabel: "Post entry",
          async onConfirm() {
            const result = await postEntry(entry.id);
            if (!result.ok) throw new Error(result.errors.map((error) => error.message).join(" "));
            showToast(
              "Entry posted",
              `${result.entry.entryNo} is now a posted journal entry.`,
              "success",
            );
          },
        });
      });

      qs("[data-reverse]", dialog)?.addEventListener("click", () => {
        close();
        openReversalDialog(entry);
      });

      qs("[data-view-reversal]", dialog)?.addEventListener("click", () => {
        close();
        openEntryDetail(entry.reversedBy);
      });

      qs("[data-view-original]", dialog)?.addEventListener("click", () => {
        close();
        openEntryDetail(entry.reversalOf);
      });
    },
  });
}

function openReversalDialog(entry) {
  const state = getState();
  const content = `
    <div class="modal-form">
      <div class="warning-panel">
        ${icon("alert", 17)}
        <span><strong>Posted entries are never edited.</strong> A reversal creates a new linked entry with debits and credits swapped. Both entries remain in the journal and net to zero.</span>
      </div>
      <div class="field">
        <label class="label" for="reversal-reason">Reason for reversal <span class="required" aria-hidden="true">*</span></label>
        <textarea class="textarea" id="reversal-reason" data-reversal-reason maxlength="300" placeholder="Explain why this entry is being reversed."></textarea>
        <p class="field-error" id="reversal-reason-error" hidden></p>
      </div>
      <div class="form-error-summary" data-reversal-error hidden></div>
      <div class="demo-note">
        ${icon("info", 17)}
        <span>The reversal is posted immediately and linked to the original. Both entries stay in the journal and net to zero.</span>
      </div>
    </div>
  `;

  openModal({
    title: `Reverse ${entry.entryNo}?`,
    eyebrow: "Correction workflow",
    description: "The original entry stays posted and a linked reversal is added.",
    size: "modal-narrow",
    content,
    footer: `
      <button class="btn btn-secondary" type="button" data-cancel>Cancel</button>
      <button class="btn btn-danger" type="button" data-confirm-reversal>Create reversal</button>
    `,
    onMount(dialog, close) {
      const input = qs("[data-reversal-reason]", dialog);
      const error = qs("#reversal-reason-error", dialog);
      const summary = qs("[data-reversal-error]", dialog);
      const button = qs("[data-confirm-reversal]", dialog);

      qs("[data-cancel]", dialog).addEventListener("click", close);
      input.focus();

      button.addEventListener("click", async () => {
        const reason = input.value.trim();
        if (!reason) {
          input.classList.add("is-invalid");
          input.setAttribute("aria-invalid", "true");
          error.hidden = false;
          error.textContent = "Add a reason for the reversal.";
          input.focus();
          return;
        }

        button.disabled = true;
        button.innerHTML = `<span class="spinner" aria-hidden="true"></span> Creating…`;
        const result = await reverseEntry(entry.id, reason);
        if (!result.ok) {
          button.disabled = false;
          button.textContent = "Create reversal";
          summary.hidden = false;
          summary.innerHTML = `<strong>Could not reverse</strong><ul>${result.errors
            .map((item) => `<li>${escapeHtml(item.message)}</li>`)
            .join("")}</ul>`;
          return;
        }

        close();
        showToast(
          "Reversal created",
          `${result.entry.entryNo} offsets ${entry.entryNo}.`,
          "success",
        );
      });

      input.addEventListener("input", () => {
        input.classList.remove("is-invalid");
        input.removeAttribute("aria-invalid");
        error.hidden = true;
      });
    },
  });
}
