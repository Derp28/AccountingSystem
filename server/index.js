import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, openDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrations.js";
import { createApp } from "./app.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const configuredPath = process.env.ACCOUNTING_DB_PATH || path.join("data", "accounting.sqlite");
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.resolve(projectRoot, configuredPath);

const loopbackHosts = ["127.0.0.1", "localhost", "::1"];
const containerBind = process.env.LEDGERLINE_CONTAINER === "1";
if (!loopbackHosts.includes(host) && !(containerBind && host === "0.0.0.0")) {
  console.error(`Refusing to start on ${host}: Ledgerline is a loopback-only local app.`);
  process.exit(1);
}
if (host === "0.0.0.0") {
  console.warn(
    "Container mode is binding 0.0.0.0 inside the container. Publish the port only on the host loopback interface.",
  );
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("PORT must be an integer between 1 and 65535.");
  process.exit(1);
}

const db = openDatabase(dbPath);
runMigrations(db);
const app = createApp({ db });

const server = app.listen(port, host, () => {
  console.log(`Ledgerline listening on http://${host}:${port}`);
  console.log(`Database: ${dbPath}`);
});

server.on("error", (error) => {
  console.error("Could not start Ledgerline:", error.message);
  closeDatabase(db);
  process.exit(1);
});

function shutdown() {
  server.close(() => {
    closeDatabase(db);
    process.exit(0);
  });
  setTimeout(() => {
    closeDatabase(db);
    process.exit(0);
  }, 2000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
