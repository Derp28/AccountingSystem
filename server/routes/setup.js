import express from "express";
import {
  getProfile,
  getWorkspace,
  saveProfile,
  saveWorkspace,
} from "../services/setup.js";

export function setupRoutes(db) {
  const router = express.Router();

  router.get("/profile", (req, res) => {
    res.json({ profile: getProfile(db, req.auth.user.id) });
  });

  router.put("/profile", (req, res) => {
    res.json({ profile: saveProfile(db, req.auth.user.id, req.body) });
  });

  router.get("/workspace", (req, res) => {
    res.json({ workspace: getWorkspace(db, req.ledgerId) });
  });

  router.put("/workspace", (req, res) => {
    res.json({ workspace: saveWorkspace(db, req.ledgerId, req.body) });
  });

  return router;
}
