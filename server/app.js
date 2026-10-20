import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { apiRouter } from "./routes/index.js";
import {
  apiNotFound,
  errorHandler,
  requireJson,
  sameOriginOnly,
  securityHeaders,
} from "./middleware/security.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PUBLIC_DIR = path.resolve(here, "..", "public");

export function createApp({ db, publicDir = DEFAULT_PUBLIC_DIR }) {
  const app = express();
  app.disable("x-powered-by");

  app.use(securityHeaders);
  app.use(sameOriginOnly);
  app.use(express.json({ limit: "100kb", strict: true }));

  app.use("/api", requireJson, apiRouter(db));
  app.use(
    express.static(publicDir, {
      index: "index.html",
      etag: true,
      lastModified: true,
      setHeaders(res) {
        res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );

  app.use((req, res) => {
    if (req.path.startsWith("/api/")) return apiNotFound(req, res);
    res.status(404).type("text/plain").send("Not found");
  });

  app.use(errorHandler);
  return app;
}
