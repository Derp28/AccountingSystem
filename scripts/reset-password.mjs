#!/usr/bin/env node
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { openDatabase, closeDatabase } from "../server/db/connection.js";
import { runMigrations } from "../server/db/migrations.js";
import { resetPassword } from "../server/services/auth.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

function usage() {
  console.log(`Reset the local Ledgerline password.

Usage:
  npm run auth:reset-password -- <username>
  npm run auth:reset-password -- <username> --password "<new password>"

Environment:
  ACCOUNTING_DB_PATH   Override the SQLite file (default data/accounting.sqlite).
  LEDGERLINE_NEW_PASSWORD   Provide the password non-interactively (for Docker).

The command also revokes every active session, so all browsers must sign in again.
`);
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(question);

    if (!stdin.isTTY) {
      const rl = readline.createInterface({ input: stdin });
      rl.once("line", (line) => {
        rl.close();
        resolve(line);
      });
      return;
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      const characters = String(chunk);
      for (const character of characters) {
        if (character === "\u0003") {
          stdout.write("\n");
          process.exit(130);
        }
        if (character === "\r" || character === "\n") {
          stdin.removeListener("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        value += character;
        stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  let username = null;
  let password = process.env.LEDGERLINE_NEW_PASSWORD || null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--password") {
      password = args[index + 1] ?? null;
      index += 1;
    } else if (!arg.startsWith("--") && !username) {
      username = arg;
    }
  }

  if (!username) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (!password) {
    password = await promptHidden("New password: ");
    const confirm = await promptHidden("Confirm password: ");
    if (password !== confirm) {
      console.error("The passwords do not match. Nothing was changed.");
      process.exitCode = 1;
      return;
    }
  }

  const configuredPath = process.env.ACCOUNTING_DB_PATH || path.join("data", "accounting.sqlite");
  const dbPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(projectRoot, configuredPath);

  const db = openDatabase(dbPath);
  try {
    runMigrations(db);
    const result = await resetPassword(db, username, password);
    console.log(`Password updated for "${result.username}". Active sessions were revoked.`);
  } finally {
    closeDatabase(db);
  }
}

main().catch((error) => {
  console.error(error?.message || "The password could not be reset.");
  process.exitCode = 1;
});
