import { resolveSession } from "../services/auth.js";

export const SESSION_COOKIE = "ledgerline_session";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function parseCookies(header = "") {
  const cookies = {};
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      cookies[name] = part.slice(index + 1).trim();
    }
  }
  return cookies;
}

export function getSessionToken(req) {
  return parseCookies(req.get("cookie"))[SESSION_COOKIE] || null;
}

export function setSessionCookie(res, token, maxAgeSeconds) {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (process.env.LEDGERLINE_SECURE_COOKIES === "1") attributes.push("Secure");
  res.append("Set-Cookie", attributes.join("; "));
}

export function clearSessionCookie(res) {
  setSessionCookie(res, "", 0);
}

export function attachAuth(db) {
  return (req, res, next) => {
    req.auth = resolveSession(db, getSessionToken(req));
    req.ledgerId = req.auth?.ledger?.id || null;
    next();
  };
}

export function requireAuth(req, res, next) {
  if (req.auth) return next();
  return res.status(401).json({
    error: {
      message: "Sign in to continue.",
      code: "AUTH_REQUIRED",
      details: [],
    },
  });
}

export function requireCsrf(req, res, next) {
  if (!MUTATION_METHODS.has(req.method)) return next();
  const supplied = req.get("x-csrf-token") || "";
  if (req.auth && supplied && supplied === req.auth.session.csrfToken) return next();
  return res.status(403).json({
    error: {
      message: "This request could not be verified. Refresh the page and try again.",
      code: "CSRF_REJECTED",
      details: [],
    },
  });
}
