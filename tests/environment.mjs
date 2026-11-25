import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ISOLATED_VARIABLES = [
  "CODEX_COMPANION_SESSION_ID",
  "CODEX_COMPANION_TRANSCRIPT_PATH",
  "CODEX_COMPANION_DATA_DIR",
  "CLAUDE_PLUGIN_DATA",
  "CLAUDE_ENV_FILE",
  "CLAUDE_PLUGIN_ROOT"
];

const testDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agy-test-env-"));

export function testEnvironment(overrides = {}, base = process.env) {
  const env = { ...base };
  for (const name of ISOLATED_VARIABLES) delete env[name];
  return { ...env, CODEX_COMPANION_DATA_DIR: testDataRoot, ...overrides };
}

const inherited = Object.fromEntries(ISOLATED_VARIABLES.map(name => [name, process.env[name]]));
for (const name of ISOLATED_VARIABLES) delete process.env[name];
process.env.CODEX_COMPANION_DATA_DIR = testDataRoot;
process.once("exit", () => {
  fs.rmSync(testDataRoot, { recursive: true, force: true });
  for (const [name, value] of Object.entries(inherited)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
