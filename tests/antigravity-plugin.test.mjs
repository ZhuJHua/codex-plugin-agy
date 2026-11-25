import "./environment.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { installFakeCodex } from "./fake-codex-fixture.mjs";
import { initGitRepo, makeTempDir } from "./helpers.mjs";

const PLUGIN_ROOT = fileURLToPath(new URL("../plugins/codex", import.meta.url));
const COMPANION = path.join(PLUGIN_ROOT, "scripts", "codex-companion.mjs");
const SESSION_HOOK = path.join(PLUGIN_ROOT, "scripts", "session-lifecycle-hook.mjs");
const STOP_HOOK = path.join(PLUGIN_ROOT, "scripts", "stop-review-gate-hook.mjs");

function runNode(script, args = [], options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    ...options
  });
}

test("manifest, hooks, skills, agent, and rules conform to Antigravity specs", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, "plugin.json"), "utf8"));
  const allowedManifestKeys = new Set([
    "name",
    "displayName",
    "version",
    "description",
    "logo",
    "suggestedPrompts",
    "author",
    "homepage",
    "repository",
    "disabled"
  ]);
  for (const key of Object.keys(manifest)) {
    assert.ok(allowedManifestKeys.has(key), `Unexpected plugin.json key: ${key}`);
  }
  assert.equal(manifest.name, "codex");
  assert.ok(fs.existsSync(path.join(PLUGIN_ROOT, manifest.logo)), "logo file exists");
  assert.equal(manifest.suggestedPrompts.length, 3);

  const hooks = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, "hooks.json"), "utf8"));
  assert.ok(Array.isArray(hooks["codex-session-lifecycle"]?.SessionStart));
  assert.ok(Array.isArray(hooks["codex-stop-review-gate"]?.Stop));
  assert.equal(hooks["codex-stop-review-gate"].Stop[0].type, "command");

  const skillsDir = path.join(PLUGIN_ROOT, "skills");
  const skillDirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.equal(skillDirs.length, 10);
  for (const dirName of skillDirs) {
    const content = fs.readFileSync(path.join(skillsDir, dirName, "SKILL.md"), "utf8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(match, `Skill ${dirName} must have YAML frontmatter`);
    assert.match(match[1], new RegExp(`^name:\\s*${dirName}$`, "m"));
    assert.match(match[1], /^description:/m);
    assert.ok(!content.includes("CLAUDE_PLUGIN_ROOT"), `Skill ${dirName} should not reference CLAUDE_PLUGIN_ROOT`);
    assert.ok(!content.includes("$ARGUMENTS"), `Skill ${dirName} should not reference $ARGUMENTS`);
  }

  const agent = fs.readFileSync(path.join(PLUGIN_ROOT, "agents", "codex-rescue.md"), "utf8");
  assert.match(agent, /^name:\s*codex-rescue$/m);
  assert.match(agent, /^subagent:\s*true$/m);
  assert.match(agent, /^mainAgent:\s*false$/m);
  assert.match(agent, /^tools:\s*\[.*run_command.*\]$/m);

  const rules = fs.readFileSync(path.join(PLUGIN_ROOT, "rules", "AGENTS.md"), "utf8");
  assert.ok(!rules.startsWith("---"), "Plugin rules/AGENTS.md must not have frontmatter");
  assert.ok(Buffer.byteLength(rules, "utf8") < 24000, "rules/AGENTS.md under 24KB cap");
});

test("all JS modules pass syntax check", () => {
  const files = [
    COMPANION,
    SESSION_HOOK,
    STOP_HOOK,
    ...fs
      .readdirSync(path.join(PLUGIN_ROOT, "scripts", "lib"))
      .filter((file) => file.endsWith(".mjs"))
      .map((file) => path.join(PLUGIN_ROOT, "scripts", "lib", file))
  ];
  for (const file of files) {
    const res = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(res.status, 0, `Syntax error in ${file}: ${res.stderr}`);
  }
});

test("end-to-end setup, task, GPT-6 prompting, cross-workspace lookup, reviews, and Antigravity hooks", async () => {
  const workDir = makeTempDir("agy-codex-work-");
  const otherDir = makeTempDir("agy-codex-other-");
  const dataDir = makeTempDir("agy-codex-data-");
  const binDir = makeTempDir("agy-codex-bin-");
  const codexHome = makeTempDir("agy-codex-home-");

  initGitRepo(workDir);
  fs.writeFileSync(path.join(workDir, "app.js"), "export const x = 1;\n");
  spawnSync("git", ["add", "."], { cwd: workDir });
  spawnSync("git", ["commit", "-q", "-m", "init"], { cwd: workDir });
  fs.writeFileSync(path.join(workDir, "app.js"), "export const x = 2;\n");

  installFakeCodex(binDir, "review-ok");
  const fakeStatePath = path.join(binDir, "fake-codex-state.json");
  const env = {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    CODEX_HOME: codexHome,
    CODEX_COMPANION_DATA_DIR: dataDir
  };
  delete env.CODEX_COMPANION_SESSION_ID;
  delete env.CLAUDE_PLUGIN_DATA;

  // 1. Setup
  const setupRes = runNode(COMPANION, ["setup", "--cwd", workDir, "--json"], { cwd: workDir, env });
  assert.equal(setupRes.status, 0, setupRes.stderr);
  const setupJson = JSON.parse(setupRes.stdout);
  assert.equal(setupJson.ready, true);
  assert.equal(setupJson.reviewGateEnabled, false);
  assert.equal(setupJson.sessionRuntime.label, "private per-job");

  // 2. Task execution (with GPT-6.2 prompt tailoring)
  const taskRes = runNode(COMPANION, ["task", "--cwd", workDir, "--model", "gpt-6.2", "--json", "--", "Diagnose the issue"], {
    cwd: workDir,
    env
  });
  assert.equal(taskRes.status, 0, taskRes.stderr);
  const taskJson = JSON.parse(taskRes.stdout);
  assert.equal(taskJson.status, 0);
  assert.ok(taskJson.threadId);
  assert.ok(taskJson.meta.jobId);

  const fakeStateText = fs.readFileSync(fakeStatePath, "utf8");
  assert.ok(fakeStateText.includes("thr_1"));

  const { buildTaskPrompt } = await import(path.join(PLUGIN_ROOT, "scripts", "lib", "prompts.mjs"));
  const gpt62Prompt = buildTaskPrompt(PLUGIN_ROOT, "Diagnose the issue", { model: "gpt-6.2", modelProvider: "openai" });
  assert.match(gpt62Prompt, /delegated task from Antigravity/);
  assert.match(gpt62Prompt, /Proceed on reasonable, reversible assumptions within scope/);
  assert.match(gpt62Prompt, /self-contained handoff/);
  const gpt61Prompt = buildTaskPrompt(PLUGIN_ROOT, "Diagnose the issue", { model: "gpt-6.1-sol", modelProvider: "openai" });
  assert.match(gpt61Prompt, /Complete the work already authorized before asking/);
  assert.match(gpt61Prompt, /concise handoff/);

  // 3. Cross-workspace result lookup from otherDir
  const resultRes = runNode(COMPANION, ["result", taskJson.meta.jobId, "--cwd", otherDir], { cwd: otherDir, env });
  assert.equal(resultRes.status, 0, resultRes.stderr);
  assert.match(resultRes.stdout, /codex resume /);

  // 4. Native review
  const reviewRes = runNode(COMPANION, ["review", "--cwd", workDir, "--json"], { cwd: workDir, env });
  assert.equal(reviewRes.status, 0, reviewRes.stderr);
  assert.equal(JSON.parse(reviewRes.stdout).codex.status, 0);

  // 5. Adversarial review
  const advRes = runNode(COMPANION, ["adversarial-review", "--cwd", workDir, "--json", "--", "check edge cases"], {
    cwd: workDir,
    env
  });
  assert.equal(advRes.status, 0, advRes.stderr);
  assert.equal(JSON.parse(advRes.stdout).codex.status, 0);

  // 6. SessionStart hook outputs valid JSON
  const ssRes = runNode(SESSION_HOOK, ["SessionStart"], {
    cwd: PLUGIN_ROOT,
    env,
    input: JSON.stringify({ conversationId: "conv-123", hookEventName: "SessionStart", cwd: workDir })
  });
  assert.equal(ssRes.status, 0, ssRes.stderr);
  assert.deepEqual(JSON.parse(ssRes.stdout), {});

  // 7. Stop hook when disabled -> allow
  const stopDisabled = runNode(STOP_HOOK, [], {
    cwd: PLUGIN_ROOT,
    env,
    input: JSON.stringify({ conversationId: "conv-123", cwd: workDir, terminationReason: "NO_TOOL_CALL", executionNum: 0 })
  });
  assert.equal(stopDisabled.status, 0, stopDisabled.stderr);
  assert.deepEqual(JSON.parse(stopDisabled.stdout), { decision: "allow" });

  // Enable review gate
  const enableRes = runNode(COMPANION, ["setup", "--cwd", workDir, "--enable-review-gate", "--json"], { cwd: workDir, env });
  assert.equal(enableRes.status, 0);
  assert.equal(JSON.parse(enableRes.stdout).reviewGateEnabled, true);

  // 8. Stop hook ignores USER_CANCELED
  const stopCanceled = runNode(STOP_HOOK, [], {
    cwd: PLUGIN_ROOT,
    env,
    input: JSON.stringify({ conversationId: "conv-123", cwd: workDir, terminationReason: "USER_CANCELED", executionNum: 0 })
  });
  assert.equal(stopCanceled.status, 0);
  assert.deepEqual(JSON.parse(stopCanceled.stdout), { decision: "allow" });

  // 9. Stop hook respects continuation cap
  const stopCap = runNode(STOP_HOOK, [], {
    cwd: PLUGIN_ROOT,
    env,
    input: JSON.stringify({ conversationId: "conv-123", cwd: workDir, terminationReason: "NO_TOOL_CALL", executionNum: 3 })
  });
  assert.equal(stopCap.status, 0);
  assert.deepEqual(JSON.parse(stopCap.stdout), { decision: "allow" });

  // 10. Stop hook returns decision: "continue" on BLOCK: and reads Antigravity transcript
  const transcriptFile = path.join(workDir, "transcript.jsonl");
  fs.writeFileSync(transcriptFile, `${JSON.stringify({ plannerResponse: { response: "Updated app.js value to 2." } })}\n`);
  const preload = path.join(workDir, "mock-stop.mjs");
  const callsFile = path.join(workDir, "stop-calls.json");
  fs.writeFileSync(
    preload,
    `import fs from 'node:fs';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const original = childProcess.spawnSync;
childProcess.spawnSync = function(command, args, options) {
  if (command === 'codex') return { status: 0, stdout: 'fake codex', stderr: '' };
  if (command === process.execPath && args[0] === ${JSON.stringify(COMPANION)} && args[1] === 'task') {
    fs.writeFileSync(${JSON.stringify(callsFile)}, JSON.stringify({ args }));
    return { status: 0, stdout: JSON.stringify({ rawOutput: process.env.MOCK_STOP_OUTPUT }), stderr: '' };
  }
  return original.call(this, command, args, options);
};
syncBuiltinESMExports();`
  );

  const stopBlock = spawnSync(process.execPath, ["--import", preload, STOP_HOOK], {
    cwd: PLUGIN_ROOT,
    encoding: "utf8",
    env: { ...env, MOCK_STOP_OUTPUT: "BLOCK: app.js:1 breaks invariant" },
    input: JSON.stringify({
      conversationId: "conv-123",
      cwd: workDir,
      transcriptPath: transcriptFile,
      terminationReason: "NO_TOOL_CALL",
      executionNum: 0
    })
  });
  assert.equal(stopBlock.status, 0, stopBlock.stderr);
  const blockDecision = JSON.parse(stopBlock.stdout);
  assert.equal(blockDecision.decision, "continue");
  assert.match(blockDecision.reason, /app\.js:1 breaks invariant/);
  const capturedCall = JSON.parse(fs.readFileSync(callsFile, "utf8"));
  assert.match(capturedCall.args.at(-1), /Updated app\.js value to 2\./);

  // 11. Stop hook returns decision: "allow" on ALLOW:
  const stopAllow = spawnSync(process.execPath, ["--import", preload, STOP_HOOK], {
    cwd: PLUGIN_ROOT,
    encoding: "utf8",
    env: { ...env, MOCK_STOP_OUTPUT: "ALLOW: verified clean" },
    input: JSON.stringify({
      conversationId: "conv-123",
      cwd: workDir,
      transcriptPath: transcriptFile,
      terminationReason: "NO_TOOL_CALL",
      executionNum: 0
    })
  });
  assert.equal(stopAllow.status, 0, stopAllow.stderr);
  assert.deepEqual(JSON.parse(stopAllow.stdout), { decision: "allow" });
});
