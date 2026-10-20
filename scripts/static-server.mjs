import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(projectDir, "public");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
]);

const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cache-Control": "no-store",
};

function sendText(res, status, text) {
  res.writeHead(status, {
    ...securityHeaders,
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(text);
}

const server = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendText(res, 405, "Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
  } catch {
    sendText(res, 400, "Bad request");
    return;
  }

  if (pathname === "/") pathname = "/index.html";

  const filePath = path.resolve(publicDir, `.${pathname}`);
  if (!filePath.startsWith(publicDir + path.sep) && filePath !== publicDir) {
    sendText(res, 403, "Forbidden");
    return;
  }

  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    sendText(res, 404, "Not found");
    return;
  }

  if (!stats.isFile()) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    ...securityHeaders,
    "Content-Type": contentTypes.get(ext) || "application/octet-stream",
    "Content-Length": stats.size,
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) sendText(res, 500, "Internal server error");
    else res.destroy();
  });
  stream.pipe(res);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop the other process or set PORT.`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Ledgerline Stage 1 prototype`);
  console.log(`Serving ${publicDir}`);
  console.log(`Open http://${host}:${port}`);
  console.log("Prototype only: no data is saved and no ledger is written.");
});
