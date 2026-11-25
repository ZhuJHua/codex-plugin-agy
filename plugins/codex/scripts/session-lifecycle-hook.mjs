#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";

import { markSessionStarted } from "./lib/job-lifecycle.mjs";

export const SESSION_ID_ENV = "CODEX_COMPANION_SESSION_ID";

function readHookInput() {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

function resolveSessionId(input) {
  return input.conversationId || input.session_id || process.env[SESSION_ID_ENV] || null;
}

function handleSessionStart(input) {
  const sessionId = resolveSessionId(input);
  if (sessionId) {
    markSessionStarted(sessionId);
  }
}

async function main() {
  const input = readHookInput();
  const eventName = process.argv[2] ?? input.hookEventName ?? input.hook_event_name ?? "";

  if (eventName === "SessionStart") {
    handleSessionStart(input);
  }

  // Antigravity hooks require a valid JSON object on stdout.
  process.stdout.write("{}\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.stdout.write("{}\n");
  process.exit(1);
});
