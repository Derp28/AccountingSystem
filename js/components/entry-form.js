import {
  ADJUSTMENT_TYPES,
  ADJUSTMENT_TYPE_MAP,
  SOURCE_TYPES,
  getAccount,
  getAccountByCode,
  getSourceMeta,
  validateEntry,
} from "../accounting.js";
import { clearFieldErrors, escapeHtml, qs, qsa, setFieldError } from "../dom.js";
import { formatCentsForInput, formatMoney, parseAmount, todayIso } from "../format.js";
import { icon } from "../icons.js";
import { addEntry, getState, updateEntry } from "../state.js";
import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { accountOptions } from "./ui.js";

function defaultLinesFor(sourceType, accounts) {
  const meta = getSourceMeta(sourceType);
  if (meta.defaultLines.length === 0) {
    return [
      { accountId: "", description: "", debitCents: 0, creditCents: 0 },
      { accountId: "", description: "", debitCents: 0, creditCents: 0 },
    ];
  }

  return meta.defaultLines.map((template) => {
    const account = getAccountByCode(accounts, template.accountCode);
    return {
      accountId: account?.id || "",
      description: "",
      debitCents: 0,
      creditCents: 0,
    };
  });
}

function editorTitle(sourceType, isEdit, entryNo) {
  if (isEdit) return `Edit draft ${entryNo}`;
  if (sourceType === "ADJUSTMENT") return "New adjustment";
  if (sourceType === "GENERAL_JOURNAL") return "New journal entry";
  return `New ${getSourceMeta(sourceType).label.toLowerCase()}`;
}

function editorEyebrow(sourceType) {
  if (sourceType === "ADJUSTMENT") return "Adjustments";
  if (sourceType === "GENERAL_JOURNAL") return "General journal";
  return "Business transaction";
}

function lineRowHtml(accounts, line, index) {
  return `
    <div class="line-row" data-line-id="${escapeHtml(line.id || "")}" data-line-index="${index}">
      <div class="line-field">
        <label class="line-field-label" for="line-account-${index}">Account</label>
        <select class="select" id="line-account-${index}" data-line-account aria-label="Line ${index + 1} account">
          <option value="">Choose account</option>
          ${accountOptions(accounts, line.accountId, { includeInactive: true })}
        </select>
      </div>
      <div class="line-field">
        <label class="line-field-label" for="line-description-${index}">Line description</label>
        <input class="input" id="line-description-${index}" data-line-description type="text" maxlength="200" value="${escapeHtml(
          line.description || "",
        )}" placeholder="Optional note" aria-label="Line ${index + 1} description" />
      </div>
      <div class="line-field">
        <label class="line-field-label" for="line-debit-${index}">Debit</label>
        <input class="input num-input" id="line-debit-${index}" data-line-debit type="text" inputmode="decimal" value="${escapeHtml(
          formatCentsForInput(line.debitCents),
        )}" placeholder="0.00" aria-label="Line ${index + 1} debit" />
      </div>
      <div class="line-field">
        <label class="line-field-label" for="line-credit-${index}">Credit</label>
        <input class="input num-input" id="line-credit-${index}" data-line-credit type="text" inputmode="decimal" value="${escapeHtml(
          formatCentsForInput(line.creditCents),
        )}" placeholder="0.00" aria-label="Line ${index + 1} credit" />
      </div>
      <button class="btn btn-ghost btn-icon btn-sm line-remove" type="button" data-remove-line aria-label="Remove line ${index + 1}">
        ${icon("trash", 15)}
      </button>
    </div>
  `;
}

function readLines(dialog) {
  const errors = [];
  const lines = qsa(".line-row", dialog).map((row, index) => {
    const debit = parseAmount(qs("[data-line-debit]", row).value);
    const credit = parseAmount(qs("[data-line-credit]", row).value);

    if (!debit.ok) {
      errors.push({ field: `line-${index}-amount`, message: `Line ${index + 1}: ${debit.error}` });
      qs("[data-line-debit]", row).classList.add("is-invalid");
    } else {
      qs("[data-line-debit]", row).classList.remove("is-invalid");
    }

    if (!credit.ok) {
      errors.push({ field: `line-${index}-amount`, message: `Line ${index + 1}: ${credit.error}` });
      qs("[data-line-credit]", row).classList.add("is-invalid");
    } else {
      qs("[data-line-credit]", row).classList.remove("is-invalid");
    }

    return {
      id: row.dataset.lineId || undefined,
      accountId: qs("[data-line-account]", row).value || null,
      description: qs("[data-line-description]", row).value,
      debitCents: debit.ok ? debit.cents : 0,
      creditCents: credit.ok ? credit.cents : 0,
    };
  });

  return { lines, errors };
}

function currentTotals(dialog) {
  let debit = 0;
  let credit = 0;
  qsa(".line-row", dialog).forEach((row) => {
    const debitValue = parseAmount(qs("[data-line-debit]", row).value);
    const creditValue = parseAmount(qs("[data-line-credit]", row).value);
    if (debitValue.ok) debit += debitValue.cents;
    if (creditValue.ok) credit += creditValue.cents;
  });
  return { debit, credit };
}

function updateTotals(dialog, currency) {
  const { debit, credit } = currentTotals(dialog);
  const difference = debit - credit;
  const debitElement = qs("[data-total-debit]", dialog);
  const creditElement = qs("[data-total-credit]", dialog);
  const balanceElement = qs("[data-balance-pill]", dialog);

  if (debitElement) debitElement.textContent = formatMoney(debit, currency);
  if (creditElement) creditElement.textContent = formatMoney(credit, currency);

  if (balanceElement) {
    if (debit > 0 && debit === credit) {
      balanceElement.className = "balance-pill balance-ok";
      balanceElement.innerHTML = `${icon("check", 13)} Balanced`;
    } else if (debit === 0 && credit === 0) {
      balanceElement.className = "balance-pill balance-bad";
      balanceElement.innerHTML = `${icon("info", 13)} Enter amounts`;
    } else {
      balanceElement.className = "balance-pill balance-bad";
      balanceElement.innerHTML = `${icon("alert", 13)} Difference ${formatMoney(Math.abs(difference), currency)}`;
    }
  }
}

function probablyBlankLine(row) {
  return (
    !qs("[data-line-account]", row).value &&
    !qs("[data-line-description]", row).value.trim() &&
    !qs("[data-line-debit]", row).value.trim() &&
    !qs("[data-line-credit]", row).value.trim()
  );
}

function lineTemplate(accounts) {
  return {
    id: "",
    accountId: "",
    description: "",
    debitCents: 0,
    creditCents: 0,
  };
}

export function openEntryEditor({
  entry = null,
  sourceType = "SALES_INVOICE",
  allowedTypes = null,
  onSaved = null,
} = {}) {
  const state = getState();
  const isEdit = Boolean(entry);
  let activeSourceType = entry?.sourceType || sourceType;
  const types = allowedTypes || (entry ? [activeSourceType] : [sourceType]);
  const currency = state.workspace?.currency || "USD";
  const initialLines =
    entry?.lines?.map((line) => ({ ...line })) || defaultLinesFor(activeSourceType, state.accounts);
  const dateValue = entry?.date || todayIso();

  const typeField = isEdit
    ? `<div class="field">
        <span class="label">Type</span>
        <div class="input" style="display:flex; align-items:center; gap:8px; background:var(--paper-deep)">
          ${escapeHtml(getSourceMeta(activeSourceType).label)}
          <span class="badge badge-posted" style="margin-left:auto">Locked</span>
        </div>
      </div>`
    : `<div class="field">
        <label class="label" for="entry-source-type">Transaction type</label>
        <select class="select" id="entry-source-type" data-source-type>
          ${types
            .map(
              (type) =>
                `<option value="${type}" ${type === activeSourceType ? "selected" : ""}>${escapeHtml(
                  getSourceMeta(type).label,
                )}</option>`,
            )
            .join("")}
        </select>
      </div>`;

  const content = `
    <form class="modal-form" data-entry-form novalidate>
      <div class="form-error-summary" data-form-errors hidden></div>

      <div class="field-row">
        <div class="field">
          <label class="label" for="entry-date">Entry date <span class="required" aria-hidden="true">*</span></label>
          <input class="input" id="entry-date" name="date" data-entry-date type="date" value="${escapeHtml(
            dateValue,
          )}" required />
          <p class="field-error" id="entry-date-error" data-error-for="date" hidden></p>
        </div>
        ${typeField}
      </div>

      <div class="field">
        <label class="label" for="entry-memo">Description / memo <span class="required" aria-hidden="true">*</span></label>
        <input class="input" id="entry-memo" name="memo" data-entry-memo type="text" maxlength="500" value="${escapeHtml(
          entry?.memo || "",
        )}" placeholder="What does this entry record?" required />
        <p class="field-error" id="entry-memo-error" data-error-for="memo" hidden></p>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="label" for="entry-reference">Reference <span class="muted">(optional)</span></label>
          <input class="input" id="entry-reference" name="reference" data-entry-reference type="text" maxlength="80" value="${escapeHtml(
            entry?.reference || "",
          )}" placeholder="Invoice, bill, or receipt number" />
        </div>
        <div class="field" data-adjustment-type-field ${activeSourceType === "ADJUSTMENT" ? "" : "hidden"}>
          <label class="label" for="entry-adjustment-type">Adjustment type <span class="required" aria-hidden="true">*</span></label>
          <select class="select" id="entry-adjustment-type" data-adjustment-type>
            <option value="">Choose a type</option>
            ${ADJUSTMENT_TYPES.map(
              (type) =>
                `<option value="${type.id}" ${
                  entry?.adjustmentType === type.id ? "selected" : ""
                }>${escapeHtml(type.label)}</option>`,
            ).join("")}
          </select>
          <p class="field-error" id="entry-adjustment-type-error" data-error-for="adjustmentType" hidden></p>
        </div>
      </div>

      <div class="field" data-adjustment-reason-field ${activeSourceType === "ADJUSTMENT" ? "" : "hidden"}>
        <label class="label" for="entry-adjustment-reason">Reason for adjustment <span class="required" aria-hidden="true">*</span></label>
        <textarea class="textarea" id="entry-adjustment-reason" data-adjustment-reason maxlength="300" placeholder="Explain why this adjusting entry is needed.">${escapeHtml(
          entry?.adjustmentReason || "",
        )}</textarea>
        <p class="field-error" id="entry-adjustment-reason-error" data-error-for="adjustmentReason" hidden></p>
      </div>

      <div class="line-editor">
        <div class="line-editor-head">
          <div>
            <div class="line-editor-title">Debit and credit lines</div>
            <div class="help">Every posted entry must balance. Drafts may be incomplete.</div>
          </div>
          <button class="btn btn-secondary btn-sm" type="button" data-add-line>
            ${icon("plus", 14)} Add line
          </button>
        </div>
        <div class="line-rows" data-line-rows>
          ${initialLines.map((line, index) => lineRowHtml(state.accounts, line, index)).join("")}
        </div>
        <div class="line-totals">
          <div class="totals-item">
            <span>Total debits</span>
            <strong data-total-debit>${formatMoney(0, currency)}</strong>
          </div>
          <div class="totals-item">
            <span>Total credits</span>
            <strong data-total-credit>${formatMoney(0, currency)}</strong>
          </div>
          <span class="balance-pill balance-bad" data-balance-pill>${icon("info", 13)} Enter amounts</span>
          <button class="btn btn-ghost btn-sm" type="button" data-balance-entry>Balance difference</button>
        </div>
      </div>

      <div class="demo-note">
        ${icon("info", 17)}
        <span><strong>Demo draft.</strong> Saving keeps the draft in this browser tab; the shipped app writes it to SQLite. Posting is a separate, fully validated step.</span>
      </div>
    </form>
  `;

  const footer = `
    <span class="footer-note">Drafts are stored locally and survive restart.</span>
    <button class="btn btn-secondary" type="button" data-cancel>Cancel</button>
    <button class="btn btn-primary" type="button" data-save>
      ${isEdit ? "Save changes" : "Save draft"}
    </button>
  `;

  return openModal({
    title: editorTitle(activeSourceType, isEdit, entry?.entryNo),
    eyebrow: editorEyebrow(activeSourceType),
    description: isEdit
      ? "Draft entries remain editable until posting."
      : "Record the draft first, then review it before posting.",
    size: "modal-wide",
    content,
    footer,
    initialFocus: "#entry-memo",
    onMount(dialog, close) {
      const form = qs("[data-entry-form]", dialog);
      const rowsContainer = qs("[data-line-rows]", dialog);
      const sourceSelect = qs("[data-source-type]", dialog);
      const typeFieldWrapper = qs("[data-adjustment-type-field]", dialog);
      const reasonFieldWrapper = qs("[data-adjustment-reason-field]", dialog);
      const errorSummary = qs("[data-form-errors]", dialog);

      function refreshTotals() {
        updateTotals(dialog, currency);
      }

      function refreshRemoveButtons() {
        const rows = qsa(".line-row", dialog);
        rows.forEach((row, index) => {
          const remove = qs("[data-remove-line]", row);
          remove.disabled = rows.length <= 1;
          remove.setAttribute("aria-label", `Remove line ${index + 1}`);
        });
      }

      function appendLine(line = lineTemplate(state.accounts)) {
        const index = qsa(".line-row", dialog).length;
        rowsContainer.insertAdjacentHTML(
          "beforeend",
          lineRowHtml(state.accounts, line, index),
        );
        refreshRemoveButtons();
        refreshTotals();
        const newRow = qsa(".line-row", dialog).at(-1);
        qs("[data-line-account]", newRow)?.focus();
      }

      function resetLines() {
        rowsContainer.innerHTML = defaultLinesFor(activeSourceType, state.accounts)
          .map((line, index) => lineRowHtml(state.accounts, line, index))
          .join("");
        refreshRemoveButtons();
        refreshTotals();
      }

      function clearErrorSummary() {
        errorSummary.hidden = true;
        errorSummary.innerHTML = "";
        clearFieldErrors(form);
      }

      function showErrors(errors) {
        clearErrorSummary();
        const globalMessages = [];

        errors.forEach((error) => {
          if (["date", "memo", "adjustmentType", "adjustmentReason"].includes(error.field)) {
            const input = qs(`[data-${error.field === "date" ? "entry-date" : error.field === "memo" ? "entry-memo" : error.field === "adjustmentType" ? "adjustment-type" : "adjustment-reason"}]`, dialog);
            const errorElement = qs(`[data-error-for="${error.field}"]`, dialog);
            setFieldError(input, errorElement, error.message);
          } else {
            globalMessages.push(error.message);
          }
        });

        if (globalMessages.length > 0) {
          errorSummary.hidden = false;
          errorSummary.innerHTML = `<strong>Please check the entry</strong><ul>${globalMessages
            .map((message) => `<li>${escapeHtml(message)}</li>`)
            .join("")}</ul>`;
        }

        const firstInvalid = qs(".is-invalid", dialog);
        if (firstInvalid) firstInvalid.focus();
        else if (globalMessages.length > 0) errorSummary.scrollIntoView({ block: "nearest" });
      }

      form.addEventListener("input", (event) => {
        if (event.target.matches("[data-line-debit], [data-line-credit]")) {
          event.target.classList.remove("is-invalid");
          refreshTotals();
        }
        if (event.target.matches("[data-entry-date], [data-entry-memo]")) {
          event.target.classList.remove("is-invalid");
        }
      });

      form.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-add-line]");
        if (addButton) {
          appendLine();
          return;
        }

        const removeButton = event.target.closest("[data-remove-line]");
        if (removeButton) {
          const row = removeButton.closest(".line-row");
          if (qsa(".line-row", dialog).length > 1) {
            row.remove();
            qsa(".line-row", dialog).forEach((lineRow, index) => {
              lineRow.dataset.lineIndex = String(index);
              qs("[data-line-account]", lineRow).id = `line-account-${index}`;
              qs("[data-line-description]", lineRow).id = `line-description-${index}`;
              qs("[data-line-debit]", lineRow).id = `line-debit-${index}`;
              qs("[data-line-credit]", lineRow).id = `line-credit-${index}`;
            });
            refreshRemoveButtons();
            refreshTotals();
          }
          return;
        }

        if (event.target.closest("[data-balance-entry]")) {
          const { debit, credit } = currentTotals(dialog);
          const difference = debit - credit;
          if (difference === 0) {
            showToast("Already balanced", "Debits and credits are equal.", "info", 3200);
            return;
          }

          const rows = qsa(".line-row", dialog);
          let target = null;
          if (difference > 0) {
            target = rows.find(
              (row) =>
                qs("[data-line-account]", row).value &&
                !qs("[data-line-debit]", row).value.trim() &&
                !qs("[data-line-credit]", row).value.trim(),
            );
            if (!target) {
              appendLine();
              target = qsa(".line-row", dialog).at(-1);
            }
            qs("[data-line-credit]", target).value = formatCentsForInput(Math.abs(difference));
          } else {
            target = rows.find(
              (row) =>
                qs("[data-line-account]", row).value &&
                !qs("[data-line-debit]", row).value.trim() &&
                !qs("[data-line-credit]", row).value.trim(),
            );
            if (!target) {
              appendLine();
              target = qsa(".line-row", dialog).at(-1);
            }
            qs("[data-line-debit]", target).value = formatCentsForInput(Math.abs(difference));
          }
          refreshTotals();
          qs("[data-line-account]", target)?.focus();
          return;
        }

        if (event.target.closest("[data-cancel]")) {
          close();
        }
      });

      sourceSelect?.addEventListener("change", () => {
        activeSourceType = sourceSelect.value;
        const isAdjustment = activeSourceType === "ADJUSTMENT";
        if (typeFieldWrapper) typeFieldWrapper.hidden = !isAdjustment;
        if (reasonFieldWrapper) reasonFieldWrapper.hidden = !isAdjustment;
        const title = qs(".modal-title", dialog);
        if (title) title.textContent = editorTitle(activeSourceType, false);
        resetLines();
        clearErrorSummary();
      });

      qs("[data-save]", dialog).addEventListener("click", async () => {
        clearErrorSummary();
        const { lines, errors: amountErrors } = readLines(dialog);
        const meaningfulLines = lines.filter(
          (line) =>
            line.accountId ||
            line.description.trim() ||
            line.debitCents > 0 ||
            line.creditCents > 0,
        );

        const payload = {
          sourceType: activeSourceType,
          date: qs("[data-entry-date]", dialog).value,
          memo: qs("[data-entry-memo]", dialog).value,
          reference: qs("[data-entry-reference]", dialog).value,
          adjustmentType: qs("[data-adjustment-type]", dialog)?.value || null,
          adjustmentReason: qs("[data-adjustment-reason]", dialog)?.value || null,
          lines: meaningfulLines,
        };

        const errors = [...amountErrors];
        if (meaningfulLines.length === 0) {
          errors.push({ field: "lines", message: "Add at least one line with an account." });
        }

        const validation = validateEntry({ ...payload, status: "DRAFT" }, state.accounts, {
          forPost: false,
        });
        errors.push(...validation.errors);

        if (errors.length > 0) {
          showErrors(errors);
          return;
        }

        const saveButton = qs("[data-save]", dialog);
        const originalLabel = saveButton.textContent.trim();
        saveButton.disabled = true;
        saveButton.innerHTML = `<span class="spinner" aria-hidden="true"></span> Saving…`;

        const result = isEdit
          ? await updateEntry(entry.id, payload)
          : await addEntry(payload);

        if (!result.ok) {
          saveButton.disabled = false;
          saveButton.textContent = originalLabel;
          showErrors(result.errors);
          return;
        }

        close();
        if (isEdit) {
          showToast("Draft saved", `${result.entry.entryNo} was updated in this demo tab.`, "success");
        } else {
          showToast(
            "Draft saved",
            `${result.entry.entryNo} was written to this demo tab.`,
            "success",
          );
        }

        onSaved?.();
      });
    },
  });
}
