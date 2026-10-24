import { run } from "./lib/runner.mjs";
import { testFiles } from "./lib/test-files.mjs";

const files = testFiles("tests/unit");
if (files.length === 0) {
  console.error("No unit test files were found under tests/unit.");
  process.exit(1);
}

run(process.execPath, ["--test", ...files, ...process.argv.slice(2)]);
