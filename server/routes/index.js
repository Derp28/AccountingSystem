import express from "express";
import { schemaVersion } from "../db/connection.js";
import { apiNotFound } from "../middleware/security.js";
import { attachAuth, requireAuth, requireCsrf } from "../middleware/auth.js";
import { getBootstrap } from "../services/bootstrap.js";
import { accountRoutes } from "./accounts.js";
import { authRoutes } from "./auth.js";
import { dashboardRoutes } from "./dashboard.js";
import { entryRoutes } from "./entries.js";
import { ledgerRoutes } from "./ledgers.js";
import { reportRoutes } from "./reports.js";
import { setupRoutes } from "./setup.js";

export function apiRouter(db) {
  const router = express.Router();

  router.use(attachAuth(db));

  router.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: "ledgerline",
      schemaVersion: schemaVersion(db),
    });
  });

  router.use("/auth", authRoutes(db));

  router.get("/bootstrap", (req, res) => {
    res.json(getBootstrap(db, req.auth));
  });

  router.use(requireAuth);
  router.use(requireCsrf);

  router.use(setupRoutes(db));
  router.use("/ledgers", ledgerRoutes(db));
  router.use("/accounts", accountRoutes(db));
  router.use("/entries", entryRoutes(db));
  router.use("/dashboard", dashboardRoutes(db));
  router.use("/reports", reportRoutes(db));
  router.use(apiNotFound);

  return router;
}
