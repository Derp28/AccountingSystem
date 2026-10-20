import express from "express";
import { NotFoundError } from "../lib/errors.js";
import {
  createDraft,
  deleteDraft,
  getEntry,
  listEntries,
  postEntry,
  reverseEntry,
  updateDraft,
} from "../services/entries.js";

function checkedId(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) {
    throw new NotFoundError("The entry was not found.");
  }
  return value;
}

export function entryRoutes(db) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json({ entries: listEntries(db) });
  });

  router.get("/:id", (req, res) => {
    const entry = getEntry(db, checkedId(req.params.id));
    if (!entry) throw new NotFoundError("The entry was not found.");
    res.json({ entry });
  });

  router.post("/", (req, res) => {
    const clientRequestId = req.get("Idempotency-Key") || req.body?.clientRequestId;
    const result = createDraft(db, req.body, { clientRequestId });
    res.status(result.idempotent ? 200 : 201).json(result);
  });

  router.put("/:id", (req, res) => {
    res.json({ entry: updateDraft(db, checkedId(req.params.id), req.body) });
  });

  router.delete("/:id", (req, res) => {
    res.json(deleteDraft(db, checkedId(req.params.id)));
  });

  router.post("/:id/post", (req, res) => {
    res.json({ entry: postEntry(db, checkedId(req.params.id)) });
  });

  router.post("/:id/reverse", (req, res) => {
    const clientRequestId = req.get("Idempotency-Key") || req.body?.clientRequestId;
    res.json(reverseEntry(db, checkedId(req.params.id), { ...req.body, clientRequestId }));
  });

  return router;
}
