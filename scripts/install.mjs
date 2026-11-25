#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(REPO_ROOT, "plugins", "codex");
const DEFAULT_TARGET = path.join(os.homedir(), ".gemini", "config", "plugins", "codex");

function printHelp() {
  console.log(
    [
      "Install or uninstall the Antigravity Codex Companion plugin.",
      "",
      "Usage:",
      "  node scripts/install.mjs [options]",
      "",
      "Options:",
      "  --symlink              Symlink plugins/codex instead of copying (for local development)",
      "  --workspace <path>     Install into <path>/.agents/plugins/codex instead of global config",
      "  --target <path>        Explicit destination directory",
      "  --uninstall            Remove the installed plugin directory/symlink",
      "  -h, --help             Show this help message"
    ].join("\n")
  );
}

function parseCli(argv) {
  const options = { symlink: false, uninstall: false, workspace: null, target: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "--symlink") options.symlink = true;
    else if (arg === "--uninstall") options.uninstall = true;
    else if (arg === "--workspace") options.workspace = argv[++i];
    else if (arg === "--target") options.target = argv[++i];
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function resolveTarget(options) {
  if (options.target) return path.resolve(options.target);
  if (options.workspace) return path.join(path.resolve(options.workspace), ".agents", "plugins", "codex");
  return DEFAULT_TARGET;
}

function ensureExecutableScripts(dir) {
  if (process.platform === "win32") return;
  for (const name of ["codex-companion.mjs", "session-lifecycle-hook.mjs", "stop-review-gate-hook.mjs"]) {
    const file = path.join(dir, "scripts", name);
    if (fs.existsSync(file)) {
      fs.chmodSync(file, 0o755);
    }
  }
}

function main() {
  const options = parseCli(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const target = resolveTarget(options);

  if (options.uninstall) {
    if (!fs.existsSync(target) && !fs.lstatSync(target, { throwIfNoEntry: false })) {
      console.log(`Plugin not installed at ${target}`);
      return;
    }
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`Removed Codex plugin from ${target}`);
    return;
  }

  if (!fs.existsSync(path.join(SOURCE_DIR, "plugin.json"))) {
    throw new Error(`Plugin source not found at ${SOURCE_DIR}`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.rmSync(target, { recursive: true, force: true });

  if (options.symlink) {
    fs.symlinkSync(SOURCE_DIR, target, process.platform === "win32" ? "junction" : "dir");
    ensureExecutableScripts(SOURCE_DIR);
    console.log(`Symlinked Codex plugin: ${target} -> ${SOURCE_DIR}`);
  } else {
    fs.cpSync(SOURCE_DIR, target, { recursive: true });
    ensureExecutableScripts(target);
    console.log(`Installed Codex plugin to ${target}`);
  }

  console.log("Antigravity discovers the plugin automatically on the next turn. Run `/codex-setup` to verify Codex CLI readiness.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
