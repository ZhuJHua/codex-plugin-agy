import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { makeTempDir } from "./helpers.mjs";

const INSTALLER = fileURLToPath(new URL("../scripts/install.mjs", import.meta.url));

test("installer copies, symlinks, supports --workspace, and uninstalls cleanly", () => {
  const tempRoot = makeTempDir("agy-install-test-");
  const copyTarget = path.join(tempRoot, "copied-plugin");
  const symlinkTarget = path.join(tempRoot, "linked-plugin");
  const workspaceRoot = path.join(tempRoot, "my-project");

  // Copy install
  const copyRes = spawnSync(process.execPath, [INSTALLER, "--target", copyTarget], { encoding: "utf8" });
  assert.equal(copyRes.status, 0, copyRes.stderr);
  assert.ok(fs.existsSync(path.join(copyTarget, "plugin.json")));
  assert.ok(fs.existsSync(path.join(copyTarget, "hooks.json")));
  assert.ok(fs.existsSync(path.join(copyTarget, "scripts", "codex-companion.mjs")));

  // Symlink install
  const linkRes = spawnSync(process.execPath, [INSTALLER, "--symlink", "--target", symlinkTarget], { encoding: "utf8" });
  assert.equal(linkRes.status, 0, linkRes.stderr);
  assert.ok(fs.lstatSync(symlinkTarget).isSymbolicLink());
  assert.ok(fs.existsSync(path.join(symlinkTarget, "plugin.json")));

  // Workspace install
  const wsRes = spawnSync(process.execPath, [INSTALLER, "--workspace", workspaceRoot], { encoding: "utf8" });
  assert.equal(wsRes.status, 0, wsRes.stderr);
  assert.ok(fs.existsSync(path.join(workspaceRoot, ".agents", "plugins", "codex", "plugin.json")));

  // Uninstall
  const uninstallRes = spawnSync(process.execPath, [INSTALLER, "--uninstall", "--target", copyTarget], { encoding: "utf8" });
  assert.equal(uninstallRes.status, 0, uninstallRes.stderr);
  assert.ok(!fs.existsSync(copyTarget));
});
