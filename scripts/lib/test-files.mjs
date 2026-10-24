import { readdirSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./runner.mjs";

/**
 * Collect test files by walking a test directory. Node's test runner needs
 * explicit file paths: shells on Windows do not expand `tests/unit/*.test.js`
 * globs, so the scripts do the expansion themselves.
 */
export function testFiles(...directories) {
  const found = [];
  for (const directory of directories) {
    for (const file of readdirSync(path.join(projectRoot, directory), {
      withFileTypes: true,
    })) {
      if (file.isFile() && file.name.endsWith(".test.js")) {
        found.push(path.join(directory, file.name));
      }
    }
  }
  return found.sort();
}
