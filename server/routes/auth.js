import express from "express";
import { getAuthStatus, login, logout, claimLocalAccount, SESSION_ABSOLUTE_MS } from "../services/auth.js";
import {
  clearSessionCookie,
  getSessionToken,
  setSessionCookie,
} from "../middleware/auth.js";

function responseAuth(db, result) {
  return getAuthStatus(db, {
    session: {
      csrfToken: result.csrfToken,
      activeLedgerId: result.ledger?.id || null,
      expiresAt: result.expiresAt,
    },
    user: result.user,
    ledger: result.ledger,
  });
}

export function authRoutes(db) {
  const router = express.Router();

  router.get("/status", (req, res) => {
    res.json({ auth: getAuthStatus(db, req.auth) });
  });

  router.post("/claim", async (req, res) => {
    const result = await claimLocalAccount(db, req.body);
    setSessionCookie(res, result.token, SESSION_ABSOLUTE_MS / 1000);
    res.status(201).json({
      auth: responseAuth(db, result),
      user: result.user,
      ledger: result.ledger,
    });
  });

  router.post("/login", async (req, res) => {
    const result = await login(db, req.body);
    setSessionCookie(res, result.token, SESSION_ABSOLUTE_MS / 1000);
    res.json({
      auth: responseAuth(db, result),
      user: result.user,
      ledger: result.ledger,
    });
  });

  router.post("/logout", (req, res) => {
    logout(db, getSessionToken(req));
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.post("/lock", (req, res) => {
    logout(db, getSessionToken(req));
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  return router;
}
