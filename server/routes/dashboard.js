import express from "express";
import { getDashboard, getTrialBalance } from "../services/reports.js";

export function dashboardRoutes(db) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json(getDashboard(db));
  });

  router.get("/trial-balance", (req, res) => {
    res.json(getTrialBalance(db));
  });

  return router;
}
