import { AppError } from "../lib/errors.js";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hostname(hostHeader = "") {
  if (hostHeader.startsWith("[")) {
    const end = hostHeader.indexOf("]");
    return end === -1 ? "" : hostHeader.slice(1, end);
  }
  return hostHeader.split(":")[0];
}

function isLoopback(host) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function securityHeaders(req, res, next) {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join("; "),
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
}

export function sameOriginOnly(req, res, next) {
  if (!MUTATION_METHODS.has(req.method)) return next();

  const host = req.get("host") || "";
  if (!isLoopback(hostname(host))) {
    return res.status(403).json({
      error: { message: "Mutations are only accepted from the local loopback host." },
    });
  }

  const origin = req.get("origin");
  if (origin) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      return res.status(403).json({ error: { message: "Invalid request origin." } });
    }
    if (parsed.host !== host || !isLoopback(parsed.hostname)) {
      return res.status(403).json({ error: { message: "Cross-origin mutations are not allowed." } });
    }
  }
  next();
}

export function requireJson(req, res, next) {
  if (!MUTATION_METHODS.has(req.method) || req.method === "DELETE") return next();
  if (!req.is("application/json") && !req.is("application/*+json")) {
    return res.status(415).json({ error: { message: "Send mutations as JSON." } });
  }
  next();
}

export function apiNotFound(req, res) {
  res.status(404).json({ error: { message: "API endpoint not found." } });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
      },
    });
  }

  if (error?.type === "entity.too.large" || error?.status === 413) {
    return res.status(413).json({ error: { message: "Request body is too large." } });
  }

  if (error?.type === "entity.parse.failed" || error instanceof SyntaxError) {
    return res.status(400).json({ error: { message: "Request body must be valid JSON." } });
  }

  if (String(error?.message || "").includes("posted entry is immutable")) {
    return res.status(409).json({
      error: { message: "Posted entries are immutable. Use a reversal instead." },
    });
  }
  if (String(error?.message || "").includes("invalid reversal target")) {
    return res.status(409).json({ error: { message: "That reversal is not allowed." } });
  }

  // Log the local diagnostic, but never expose stacks, SQL, or paths.
  console.error("Unhandled API error", error);
  return res.status(500).json({ error: { message: "An unexpected server error occurred." } });
}
