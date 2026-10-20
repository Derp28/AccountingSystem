import express from "express";
import { schemaVersion } from "../db/connection.js";
import { apiNotFound } from "../middleware/security.js";
import { accountRoutes } from "./accounts.js";
import { dashboardRoutes } from "./dashboard.js";
import { entryRoutes } from "./entries.js";
import { setupRoutes } from "./setup.js";

export function apiRouter(db) {
  const router = express.Router();

  router.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: "ledgerline",
      schemaVersion: schemaVersion(db),
    });
  });

  router.use(setupRoutes(db));
  router.use("/accounts", accountRoutes(db));
  router.use("/entries", entryRoutes(db));
  router.use("/dashboard", dashboardRoutes(db));
  router.use(apiNotFound);

  return router;
}
