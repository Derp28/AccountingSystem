import express from "express";
import {
  getBalanceSheet,
  getIncomeStatement,
  getTrialBalance,
} from "../services/reports.js";

export function reportRoutes(db) {
  const router = express.Router();

  router.get("/trial-balance", (req, res) => {
    res.json(
      getTrialBalance(db, req.ledgerId, {
        asOf: req.query.asOf,
        basis: req.query.basis,
      }),
    );
  });

  router.get("/income-statement", (req, res) => {
    res.json(
      getIncomeStatement(db, req.ledgerId, {
        from: req.query.from,
        to: req.query.to,
        basis: req.query.basis,
      }),
    );
  });

  router.get("/balance-sheet", (req, res) => {
    res.json(
      getBalanceSheet(db, req.ledgerId, {
        asOf: req.query.asOf,
        basis: req.query.basis,
      }),
    );
  });

  return router;
}
