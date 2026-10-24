import { run } from "./lib/runner.mjs";

/**
 * Start the local development server from the project root.
 * Configuration comes from the environment (PORT, HOST, ACCOUNTING_DB_PATH);
 * see .env.example. No WSL, NVM, or fixed install path is assumed.
 */
run(process.execPath, ["server/index.js", ...process.argv.slice(2)]);
