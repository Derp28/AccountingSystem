import crypto from "node:crypto";
import { promisify } from "node:util";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
import { normalizeProfileInput, normalizeWorkspaceInput } from "../lib/validation.js";
import { insertSeedAccounts } from "../lib/seed-accounts.js";
import { transaction } from "../db/connection.js";

const scryptAsync = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64, maxmem: 32 * 1024 * 1024 };
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function text(value) {
  return String(value ?? "").trim();
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLedger(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getLocalUser(db) {
  return db.prepare("SELECT * FROM users ORDER BY created_at LIMIT 1").get() || null;
}

export function getLedger(db, ledgerId) {
  return db.prepare("SELECT * FROM ledgers WHERE id = ?").get(ledgerId) || null;
}

export function listLedgers(db, userId) {
  return db
    .prepare("SELECT * FROM ledgers WHERE user_id = ? ORDER BY created_at ASC, name ASC")
    .all(userId)
    .map(mapLedger);
}

export function getFirstLedger(db, userId) {
  const row = db
    .prepare("SELECT * FROM ledgers WHERE user_id = ? ORDER BY created_at ASC, name ASC LIMIT 1")
    .get(userId);
  return row || null;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizePassword(value) {
  const password = String(value ?? "");
  if (password.length < 12) {
    throw new ValidationError([
      { field: "password", message: "Use a password with at least 12 characters." },
    ]);
  }
  if (password.length > 128) {
    throw new ValidationError([
      { field: "password", message: "Keep the password to 128 characters or fewer." },
    ]);
  }
  return password;
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT.keyLength, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64url"),
    Buffer.from(derived).toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, n, r, p, salt, expected] = String(stored || "").split("$");
    if (scheme !== "scrypt" || !n || !r || !p || !salt || !expected) return false;
    const expectedBuffer = Buffer.from(expected, "base64url");
    const derived = await scryptAsync(password, Buffer.from(salt, "base64url"), expectedBuffer.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
    const actualBuffer = Buffer.from(derived);
    return (
      actualBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    );
  } catch {
    return false;
  }
}

function createSession(db, userId, ledgerId = null) {
  const activeLedger = ledgerId || getFirstLedger(db, userId)?.id || null;
  const token = crypto.randomBytes(32).toString("base64url");
  const csrfToken = crypto.randomBytes(24).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS).toISOString();
  db.prepare(`
    INSERT INTO sessions (
      token_hash, user_id, csrf_token, active_ledger_id,
      created_at, last_seen_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    hashToken(token),
    userId,
    csrfToken,
    activeLedger,
    now.toISOString(),
    now.toISOString(),
    expiresAt,
  );
  return { token, csrfToken, activeLedgerId: activeLedger, expiresAt };
}

function sessionPayload(db, userId, session, userRow) {
  const ledgerRow = session.activeLedgerId
    ? getLedger(db, session.activeLedgerId)
    : getFirstLedger(db, userId);
  const activeLedger = ledgerRow || getFirstLedger(db, userId);
  return {
    token: session.token,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
    user: mapUser(userRow),
    ledger: mapLedger(activeLedger),
  };
}

function normalizeClaimInput(body) {
  const displayName = text(body?.displayName ?? body?.name);
  const username = text(body?.username).toLowerCase();
  const password = String(body?.password ?? "");
  const errors = [];

  if (!displayName) {
    errors.push({ field: "displayName", message: "Enter your name or business name." });
  } else if (displayName.length > 100) {
    errors.push({ field: "displayName", message: "Keep the name to 100 characters or fewer." });
  }
  if (!username) {
    errors.push({ field: "username", message: "Choose a username." });
  } else if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
    errors.push({
      field: "username",
      message: "Use 3–64 lowercase letters, numbers, dots, underscores, or hyphens.",
    });
  }
  if (password.length < 12) {
    errors.push({ field: "password", message: "Use a password with at least 12 characters." });
  } else if (password.length > 128) {
    errors.push({ field: "password", message: "Keep the password to 128 characters or fewer." });
  }
  if (body?.confirmPassword !== undefined && String(body.confirmPassword) !== password) {
    errors.push({ field: "confirmPassword", message: "The passwords do not match." });
  }

  let workspace;
  try {
    workspace = normalizeWorkspaceInput({
      name: body?.ledgerName ?? body?.workspaceName,
      currency: body?.currency,
    });
  } catch (error) {
    for (const detail of error.details || []) {
      errors.push({ ...detail, field: detail.field === "name" ? "ledgerName" : detail.field });
    }
  }

  if (errors.length) throw new ValidationError(errors);
  return { displayName, username, password, ledgerName: workspace.name, currency: workspace.currency };
}

export async function claimLocalAccount(db, body) {
  const input = normalizeClaimInput(body);
  const passwordHash = await hashPassword(input.password);

  return transaction(db, () => {
    let user = getLocalUser(db);
    if (!user) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO users (
          id, username, display_name, password_hash, claimed, failed_attempts,
          locked_until, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, 0, NULL, ?, ?)
      `).run("user-local", input.username, input.displayName, passwordHash, now, now);
      user = getLocalUser(db);
    } else {
      if (user.claimed) {
        throw new ConflictError("This installation already has a local account.", [
          { field: "username", message: "Sign in with the existing local account." },
        ]);
      }
      db.prepare(`
        UPDATE users
        SET username = ?, display_name = ?, password_hash = ?, claimed = 1,
            failed_attempts = 0, locked_until = NULL, updated_at = ?
        WHERE id = ?
      `).run(input.username, input.displayName, passwordHash, new Date().toISOString(), user.id);
      user = getLocalUser(db);
    }

    let ledger = getFirstLedger(db, user.id);
    if (!ledger) {
      const now = new Date().toISOString();
      const ledgerId = `ledger-${crypto.randomUUID()}`;
      db.prepare(`
        INSERT INTO ledgers (id, user_id, name, currency, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(ledgerId, user.id, input.ledgerName, input.currency, now, now);
      insertSeedAccounts(db, ledgerId);
      ledger = getLedger(db, ledgerId);
    } else {
      db.prepare("UPDATE ledgers SET name = ?, currency = ?, updated_at = ? WHERE id = ?").run(
        input.ledgerName,
        input.currency,
        new Date().toISOString(),
        ledger.id,
      );
      ledger = getLedger(db, ledger.id);
    }

    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    const session = createSession(db, user.id, ledger.id);
    return { ...sessionPayload(db, user.id, session, user), claimed: true };
  });
}

export async function login(db, body) {
  const username = text(body?.username).toLowerCase();
  const password = String(body?.password ?? "");
  if (!username || !password) {
    throw new AppError(401, "Invalid username or password.", [], "INVALID_CREDENTIALS");
  }

  const user = getLocalUser(db);
  if (!user || !user.claimed || !user.password_hash) {
    throw new AppError(401, "Invalid username or password.", [], "INVALID_CREDENTIALS");
  }
  if (user.username !== username) {
    throw new AppError(401, "Invalid username or password.", [], "INVALID_CREDENTIALS");
  }

  if (user.locked_until && Date.parse(user.locked_until) > Date.now()) {
    const minutes = Math.max(1, Math.ceil((Date.parse(user.locked_until) - Date.now()) / 60000));
    throw new AppError(
      429,
      `Too many failed attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      [],
      "AUTH_LOCKED",
    );
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const failedAttempts = Number(user.failed_attempts) + 1;
    const lockedUntil =
      failedAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MS).toISOString()
        : null;
    db.prepare("UPDATE users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?").run(
      failedAttempts,
      lockedUntil,
      new Date().toISOString(),
      user.id,
    );
    if (lockedUntil) {
      throw new AppError(
        429,
        "Too many failed attempts. Try again in about 15 minutes.",
        [],
        "AUTH_LOCKED",
      );
    }
    throw new AppError(401, "Invalid username or password.", [], "INVALID_CREDENTIALS");
  }

  return transaction(db, () => {
    db.prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      user.id,
    );
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
    const session = createSession(db, user.id);
    return { ...sessionPayload(db, user.id, session, getLocalUser(db)), claimed: true };
  });
}

export function logout(db, token) {
  if (!token) return { ok: true };
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  return { ok: true };
}

export function resolveSession(db, token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = db.prepare(`
    SELECT s.*, u.username, u.display_name, u.claimed
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(tokenHash);
  if (!row || !row.claimed) return null;

  const now = Date.now();
  const absoluteExpired = Date.parse(row.expires_at) <= now;
  const idleExpired = Date.parse(row.last_seen_at) + SESSION_IDLE_MS <= now;
  if (absoluteExpired || idleExpired) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }

  const nowIso = new Date(now).toISOString();
  db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(nowIso, tokenHash);

  const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id);
  let ledgerRow = row.active_ledger_id ? getLedger(db, row.active_ledger_id) : null;
  if (!ledgerRow || ledgerRow.user_id !== row.user_id) {
    ledgerRow = getFirstLedger(db, row.user_id);
    if (ledgerRow) {
      db.prepare("UPDATE sessions SET active_ledger_id = ? WHERE token_hash = ?").run(
        ledgerRow.id,
        tokenHash,
      );
    }
  }

  return {
    session: {
      tokenHash,
      csrfToken: row.csrf_token,
      activeLedgerId: ledgerRow?.id || null,
      createdAt: row.created_at,
      lastSeenAt: nowIso,
      expiresAt: row.expires_at,
    },
    user: mapUser(userRow),
    ledger: mapLedger(ledgerRow),
  };
}

export function getAuthStatus(db, auth = null) {
  const user = getLocalUser(db);
  if (!user) {
    return { claimed: false, authenticated: false, setupRequired: true };
  }
  if (!user.claimed) {
    return {
      claimed: false,
      authenticated: false,
      setupRequired: true,
      displayName: user.display_name,
    };
  }
  if (!auth) {
    return {
      claimed: true,
      authenticated: false,
      setupRequired: false,
      displayName: user.display_name,
    };
  }
  return {
    claimed: true,
    authenticated: true,
    setupRequired: false,
    user: mapUser(user),
    ledgers: listLedgers(db, user.id),
    activeLedger: mapLedger(auth.ledger),
    csrfToken: auth.session.csrfToken,
    expiresAt: auth.session.expiresAt,
  };
}

export function switchLedger(db, auth, ledgerId) {
  const ledger = db
    .prepare("SELECT * FROM ledgers WHERE id = ? AND user_id = ?")
    .get(String(ledgerId || ""), auth.user.id);
  if (!ledger) throw new NotFoundError("The ledger was not found.");
  db.prepare("UPDATE sessions SET active_ledger_id = ? WHERE token_hash = ?").run(
    ledger.id,
    auth.session.tokenHash,
  );
  return mapLedger(ledger);
}

export function createLedger(db, auth, body) {
  const input = normalizeWorkspaceInput(body);
  return transaction(db, () => {
    const now = new Date().toISOString();
    const id = `ledger-${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO ledgers (id, user_id, name, currency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, auth.user.id, input.name, input.currency, now, now);
    insertSeedAccounts(db, id);
    return mapLedger(getLedger(db, id));
  });
}

export function updateLedger(db, auth, body) {
  const input = normalizeWorkspaceInput(body);
  if (!auth.ledger) throw new NotFoundError("The ledger was not found.");
  db.prepare("UPDATE ledgers SET name = ?, currency = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(
    input.name,
    input.currency,
    new Date().toISOString(),
    auth.ledger.id,
    auth.user.id,
  );
  return mapLedger(getLedger(db, auth.ledger.id));
}

export function updateDisplayName(db, auth, body) {
  const input = normalizeProfileInput(body);
  db.prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?").run(
    input.name,
    new Date().toISOString(),
    auth.user.id,
  );
  return mapUser(getLocalUser(db));
}

export async function resetPassword(db, username, newPassword) {
  const normalizedUsername = text(username).toLowerCase();
  const user = getLocalUser(db);
  if (!user || !user.claimed || user.username !== normalizedUsername) {
    throw new NotFoundError("No claimed local account matches that username.");
  }
  const password = normalizePassword(newPassword);
  const passwordHash = await hashPassword(password);
  return transaction(db, () => {
    db.prepare(`
      UPDATE users
      SET password_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = ?
      WHERE id = ?
    `).run(passwordHash, new Date().toISOString(), user.id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    return { username: user.username, revokedSessions: true };
  });
}
