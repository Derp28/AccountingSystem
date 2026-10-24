import { run } from "./lib/runner.mjs";
import { testFiles } from "./lib/test-files.mjs";

const files = testFiles("tests/unit", "tests/integration");
if (files.length === 0) {
  console.error("No unit or integration test files were found.");
  process.exit(1);
}

run(process.execPath, ["--test", ...files, ...process.argv.slice(2)]);
