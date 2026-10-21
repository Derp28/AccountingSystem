import express from "express";
import { getDashboard, getTrialBalance } from "../services/reports.js";

export function dashboardRoutes(db) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json(getDashboard(db, req.ledgerId));
  });

  router.get("/trial-balance", (req, res) => {
    res.json(
      getTrialBalance(db, req.ledgerId, {
        asOf: req.query.asOf,
        basis: req.query.basis,
      }),
    );
  });

  return router;
}
