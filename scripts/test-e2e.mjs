import fs from "node:fs";
import path from "node:path";
import { projectRoot, run } from "./lib/runner.mjs";

/**
 * Launch the Playwright test runner through its package CLI. Resolving the CLI
 * directly (instead of shelling out to `npx`) keeps the command identical on
 * Windows, WSL, macOS, and inside CI containers.
 */
const cli = path.join(projectRoot, "node_modules", "@playwright", "test", "cli.js");

if (!fs.existsSync(cli)) {
  console.error("Playwright is not installed. Run `npm install` first.");
  process.exit(1);
}

// Linux hosts without sudo can unpack Chromium's shared libraries into a
// user-local directory; see scripts/setup-local-browser-libs.sh. Windows and
// macOS use Playwright's bundled browsers and skip this.
const env = {};
const home = process.env.HOME || process.env.USERPROFILE || "";
const libDir = path.join(home, ".local", "playwright-libs", "usr", "lib", "x86_64-linux-gnu");
if (process.platform === "linux" && fs.existsSync(libDir)) {
  env.LD_LIBRARY_PATH = [libDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
}

run(process.execPath, [cli, "test", ...process.argv.slice(2)], { env });
