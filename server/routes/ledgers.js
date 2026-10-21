import express from "express";
import { NotFoundError } from "../lib/errors.js";
import { createLedger, listLedgers, switchLedger } from "../services/auth.js";

export function ledgerRoutes(db) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json({ ledgers: listLedgers(db, req.auth.user.id), activeLedger: req.auth.ledger });
  });

  router.post("/", (req, res) => {
    const ledger = createLedger(db, req.auth, req.body);
    const activeLedger = switchLedger(db, req.auth, ledger.id);
    res.status(201).json({ ledger, activeLedger });
  });

  router.post("/:id/switch", (req, res) => {
    const id = String(req.params.id || "");
    if (!id) throw new NotFoundError("The ledger was not found.");
    res.json({ ledger: switchLedger(db, req.auth, id) });
  });

  return router;
}
