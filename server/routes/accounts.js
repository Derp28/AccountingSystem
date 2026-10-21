import express from "express";
import {
  createAccount,
  getAccount,
  listAccounts,
  setAccountActive,
  updateAccount,
} from "../services/accounts.js";
import { NotFoundError } from "../lib/errors.js";

function checkedId(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) {
    throw new NotFoundError("The account was not found.");
  }
  return value;
}

export function accountRoutes(db) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json({ accounts: listAccounts(db, req.ledgerId) });
  });

  router.post("/", (req, res) => {
    res.status(201).json({ account: createAccount(db, req.ledgerId, req.body) });
  });

  router.get("/:id", (req, res) => {
    const account = getAccount(db, req.ledgerId, checkedId(req.params.id));
    if (!account) throw new NotFoundError("The account was not found.");
    res.json({ account });
  });

  router.put("/:id", (req, res) => {
    res.json({ account: updateAccount(db, req.ledgerId, checkedId(req.params.id), req.body) });
  });

  router.post("/:id/active", (req, res) => {
    const active = req.body?.active;
    if (typeof active !== "boolean") {
      res.status(422).json({
        error: {
          message: "Choose whether the account is active.",
          details: [{ field: "active", message: "Choose whether the account is active." }],
        },
      });
      return;
    }
    res.json({ account: setAccountActive(db, req.ledgerId, checkedId(req.params.id), active) });
  });

  return router;
}
