import express from "express";
import {
  getProfile,
  getWorkspace,
  saveProfile,
  saveWorkspace,
} from "../services/setup.js";
import { getBootstrap } from "../services/bootstrap.js";

export function setupRoutes(db) {
  const router = express.Router();

  router.get("/bootstrap", (req, res) => {
    res.json(getBootstrap(db));
  });

  router.get("/profile", (req, res) => {
    res.json({ profile: getProfile(db) });
  });

  router.put("/profile", (req, res) => {
    res.json({ profile: saveProfile(db, req.body) });
  });

  router.get("/workspace", (req, res) => {
    res.json({ workspace: getWorkspace(db) });
  });

  router.put("/workspace", (req, res) => {
    res.json({ workspace: saveWorkspace(db, req.body) });
  });

  return router;
}
