const CURRENCY_FORMATTERS = new Map();

function getCurrencyFormatter(currency) {
  const code = String(currency || "USD").toUpperCase();
  if (!CURRENCY_FORMATTERS.has(code)) {
    try {
      CURRENCY_FORMATTERS.set(
        code,
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: code,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      );
    } catch {
      CURRENCY_FORMATTERS.set(code, null);
    }
  }
  return CURRENCY_FORMATTERS.get(code);
}

/**
 * Display-only conversion from integer cents. Never use this for arithmetic.
 */
export function formatMoney(cents, currency = "USD") {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  const formatter = getCurrencyFormatter(currency);
  if (formatter) return formatter.format(safe / 100);
  return `${(safe / 100).toFixed(2)} ${String(currency || "").toUpperCase()}`.trim();
}

export function formatMoneyPlain(cents) {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  return (safe / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSignedMoney(cents, currency = "USD") {
  if (cents > 0) return `+${formatMoney(cents, currency)}`;
  return formatMoney(cents, currency);
}

export function formatDate(isoDate, options = {}) {
  if (!isoDate) return "—";
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: options.short ? "short" : "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatShortDate(isoDate) {
  return formatDate(isoDate, { short: true });
}

export function formatDateTime(isoDateTime) {
  if (!isoDateTime) return "—";
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return isoDateTime;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Parse a human-entered amount into integer cents without floating-point
 * arithmetic. Returns { ok, cents, blank, error }.
 */
export function parseAmount(value) {
  const raw = String(value ?? "")
    .trim()
    .replace(/,/g, "");

  if (raw === "") return { ok: true, cents: 0, blank: true, error: null };

  if (!/^\d{1,12}(\.\d{0,2})?$/.test(raw)) {
    return {
      ok: false,
      cents: 0,
      blank: false,
      error: "Use a number with at most two decimal places.",
    };
  }

  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0") || "0");

  if (!Number.isSafeInteger(cents) || cents > 99_999_999_999) {
    return {
      ok: false,
      cents: 0,
      blank: false,
      error: "Amount is too large.",
    };
  }

  return { ok: true, cents, blank: raw === "" || cents === 0, error: null };
}

export function formatCentsForInput(cents) {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  if (safe === 0) return "";
  const sign = safe < 0 ? "-" : "";
  const absolute = Math.abs(safe);
  const whole = Math.trunc(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function formatInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|[\s_-])([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export function sumCents(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}
