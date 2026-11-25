#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { getCodexAvailability } from "./lib/codex.mjs";
import { loadPromptTemplate, interpolateTemplate } from "./lib/prompts.mjs";
import { getConfig, listJobs } from "./lib/state.mjs";
import { sortJobsNewestFirst } from "./lib/job-control.mjs";
import { SESSION_ID_ENV } from "./lib/tracked-jobs.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";

const STOP_REVIEW_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_STOP_GATE_CONTINUATIONS = 3;
const MAX_RESPONSE_HINT_CHARS = 8000;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

function readHookInput() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function emitDecision(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function logNote(message) {
  if (!message) {
    return;
  }
  process.stderr.write(`${message}\n`);
}

function resolveSessionId(input = {}) {
  return input.conversationId || input.session_id || process.env[SESSION_ID_ENV] || null;
}

function resolveHookCwd(input = {}) {
  if (typeof input.cwd === "string" && input.cwd.trim()) {
    return input.cwd.trim();
  }
  if (Array.isArray(input.workspacePaths) && typeof input.workspacePaths[0] === "string" && input.workspacePaths[0].trim()) {
    return input.workspacePaths[0].trim();
  }
  return process.cwd();
}

function filterJobsForCurrentSession(jobs, input = {}) {
  const sessionId = resolveSessionId(input);
  if (!sessionId) {
    return jobs;
  }
  return jobs.filter((job) => job.sessionId === sessionId);
}

function extractTextFromTranscriptEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return "";
  }
  // Support common Antigravity / JSONL transcript entry shapes defensively.
  if (typeof entry.response === "string" && entry.response.trim()) {
    return entry.response.trim();
  }
  if (typeof entry.plannerResponse?.response === "string" && entry.plannerResponse.response.trim()) {
    return entry.plannerResponse.response.trim();
  }
  if (typeof entry.plannerResponse?.modifiedResponse === "string" && entry.plannerResponse.modifiedResponse.trim()) {
    return entry.plannerResponse.modifiedResponse.trim();
  }
  if (entry.role === "assistant" && typeof entry.content === "string" && entry.content.trim()) {
    return entry.content.trim();
  }
  if (entry.role === "assistant" && Array.isArray(entry.content)) {
    const joined = entry.content
      .map((part) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (joined) {
      return joined;
    }
  }
  return "";
}

function readLastAssistantMessage(input = {}) {
  const direct = String(input.lastAssistantMessage ?? input.last_assistant_message ?? "").trim();
  if (direct) {
    return direct.slice(0, MAX_RESPONSE_HINT_CHARS);
  }
  const transcriptPath = input.transcriptPath || input.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return "";
  }
  try {
    const stat = fs.statSync(transcriptPath);
    const readSize = Math.min(stat.size, 256 * 1024);
    const fd = fs.openSync(transcriptPath, "r");
    let tail = "";
    try {
      const buffer = Buffer.alloc(readSize);
      fs.readSync(fd, buffer, 0, readSize, Math.max(0, stat.size - readSize));
      tail = buffer.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
    const lines = tail.split(/\r?\n/).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        const parsed = JSON.parse(lines[index]);
        const text = extractTextFromTranscriptEntry(parsed);
        if (text) {
          return text.slice(0, MAX_RESPONSE_HINT_CHARS);
        }
      } catch {
        // Ignore truncated leading line or malformed lines.
      }
    }
  } catch {
    return "";
  }
  return "";
}

function buildStopReviewPrompt(input = {}) {
  const lastAssistantMessage = readLastAssistantMessage(input);
  const template = loadPromptTemplate(ROOT_DIR, "stop-review-gate");
  const agentResponseBlock = lastAssistantMessage
    ? ["Previous Antigravity response:", lastAssistantMessage].join("\n")
    : "No previous assistant response excerpt was available in the hook payload.";
  return interpolateTemplate(template, {
    AGENT_RESPONSE_BLOCK: agentResponseBlock
  });
}

function buildSetupNote(cwd) {
  const availability = getCodexAvailability(cwd);
  if (availability.available) {
    return null;
  }

  const detail = availability.detail ? ` ${availability.detail}.` : "";
  return `Codex is not set up for the review gate.${detail} Run /codex-setup.`;
}

function parseStopReviewOutput(rawOutput) {
  const text = String(rawOutput ?? "").trim();
  if (!text) {
    return {
      ok: false,
      reason:
        "The stop-time Codex review task returned no final output. Run /codex-review --wait manually or disable the gate via /codex-setup --disable-review-gate."
    };
  }

  const firstLine = text.split(/\r?\n/, 1)[0].trim();
  if (firstLine.startsWith("ALLOW:")) {
    return { ok: true, reason: null };
  }
  if (firstLine.startsWith("BLOCK:")) {
    const reason = firstLine.slice("BLOCK:".length).trim() || text;
    return {
      ok: false,
      reason: `Codex stop-time review found issues that still need fixes before ending the turn: ${reason}`
    };
  }

  return {
    ok: false,
    reason:
      "The stop-time Codex review task returned an unexpected answer. Run /codex-review --wait manually or disable the gate."
  };
}

function runStopReview(cwd, input = {}) {
  const scriptPath = path.join(SCRIPT_DIR, "codex-companion.mjs");
  const prompt = buildStopReviewPrompt(input);
  const sessionId = resolveSessionId(input);
  const childEnv = {
    ...process.env,
    ...(sessionId ? { [SESSION_ID_ENV]: sessionId } : {})
  };
  const jobTimeoutMs = String(STOP_REVIEW_TIMEOUT_MS - 10000);
  const result = spawnSync(
    process.execPath,
    [scriptPath, "task", "--json", "--timeout-ms", jobTimeoutMs, "--job-timeout-ms", jobTimeoutMs, "--", prompt],
    {
      cwd,
      env: childEnv,
      encoding: "utf8",
      timeout: STOP_REVIEW_TIMEOUT_MS
    }
  );

  if (result.error?.code === "ETIMEDOUT") {
    return {
      ok: false,
      reason:
        "The stop-time Codex review task timed out after 15 minutes. Run /codex-review --wait manually or disable the gate."
    };
  }

  let payload;
  let parseError = null;
  try {
    payload = JSON.parse(result.stdout);
  } catch (error) {
    parseError = error;
  }
  if (result.status === 124 || payload?.waitTimedOut) {
    const jobId = payload?.meta?.jobId ?? payload?.jobId;
    return {
      ok: false,
      reason: jobId
        ? `The stop-time Codex review task ${jobId} is still running. Collect it with /codex-await ${jobId}.`
        : "The stop-time Codex review task is still running. Check /codex-status for its job ID, then collect it with /codex-await <job-id>."
    };
  }

  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim();
    return {
      ok: false,
      reason: detail
        ? `The stop-time Codex review task failed: ${detail}`
        : "The stop-time Codex review task failed. Run /codex-review --wait manually or disable the gate."
    };
  }

  if (parseError) {
    return {
      ok: false,
      reason:
        "The stop-time Codex review task returned invalid JSON. Run /codex-review --wait manually or disable the gate."
    };
  }
  return parseStopReviewOutput(payload?.rawOutput);
}

function main() {
  const input = readHookInput();

  // Only evaluate the review gate on normal turn completions (NO_TOOL_CALL or omitted).
  if (input.terminationReason && input.terminationReason !== "NO_TOOL_CALL") {
    emitDecision({ decision: "allow" });
    return;
  }

  // Prevent unbounded continuation loops inside a single user turn.
  if (Number.isInteger(input.executionNum) && input.executionNum >= MAX_STOP_GATE_CONTINUATIONS) {
    logNote(`Codex stop review gate reached continuation limit (${MAX_STOP_GATE_CONTINUATIONS}); allowing stop.`);
    emitDecision({ decision: "allow" });
    return;
  }

  const cwd = resolveHookCwd(input);
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const config = getConfig(workspaceRoot);

  const jobs = sortJobsNewestFirst(filterJobsForCurrentSession(listJobs(workspaceRoot), input));
  const runningJob = jobs.find((job) => job.status === "queued" || job.status === "running");
  const runningTaskNote = runningJob
    ? `Codex task ${runningJob.id} is still running. Check /codex-status and use /codex-cancel ${runningJob.id} if you want to stop it.`
    : null;

  if (!config.stopReviewGate) {
    logNote(runningTaskNote);
    emitDecision({ decision: "allow" });
    return;
  }

  const setupNote = buildSetupNote(cwd);
  if (setupNote) {
    logNote(setupNote);
    logNote(runningTaskNote);
    emitDecision({ decision: "allow" });
    return;
  }

  const review = runStopReview(cwd, input);
  if (!review.ok) {
    emitDecision({
      decision: "continue",
      reason: runningTaskNote ? `${runningTaskNote} ${review.reason}` : review.reason
    });
    return;
  }

  logNote(runningTaskNote);
  emitDecision({ decision: "allow" });
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  emitDecision({ decision: "allow" });
  process.exitCode = 1;
}
