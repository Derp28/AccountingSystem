import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path to the project root, derived from this file so every script
 * behaves the same no matter which directory the shell started in. This is what
 * lets the app run from a Windows path with spaces, from WSL, or from Docker
 * without hard-coded locations.
 */
export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/**
 * Spawn a child with the project root as its working directory, inheriting the
 * console so output streams to the terminal (and to Playwright's webServer log).
 * The parent's exit code mirrors the child's.
 */
export function run(command, args, { env = {} } = {}) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, ...env },
    // Windows cannot execute .cmd/.bat shims (npx, npm) without a shell.
    shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command),
  });

  const forward = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGINT", forward);
  process.on("SIGTERM", forward);

  child.on("error", (error) => {
    console.error(`Could not start ${path.basename(command)}: ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });

  return child;
}
