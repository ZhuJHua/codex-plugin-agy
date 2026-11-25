---
name: codex-rescue
description: >-
  Delegate an investigation, debugging, planning, or code implementation task
  to OpenAI Codex via the companion runner, with optional write/network/full-access
  sandbox controls, thread resumption, and background execution. Use whenever
  the user wants Codex to investigate, fix, or implement a task.
---

# Codex Task Delegation (`codex-rescue`)

Run the companion directly from the main Antigravity session by default (avoid unnecessary subagent indirection for ordinary handoffs). Preserve the user's request, agreed plan, relevant context, and acceptance criteria verbatim; do not inspect the whole repository or replan before dispatching. If no task was supplied, ask the user what Codex should do.

## Invocation

Run [codex-companion.mjs](../../scripts/codex-companion.mjs) (default path: `~/.gemini/config/plugins/codex/scripts/codex-companion.mjs`):

```bash
node ~/.gemini/config/plugins/codex/scripts/codex-companion.mjs task --cwd <workspace> [controls] -- '<verbatim request>'
```

For long or multi-line requests, write the prompt to a temporary file (e.g., inside your scratch directory) and pass `--prompt-file <path>` instead of positional text. Never use `eval`.

## Permission & Execution Controls

- **Sandbox tier (strictly bounded):**
  - **Default (read-only):** Omit `--write` for diagnosis, research, planning, or explicitly read-only requests.
  - **`--write` (`workspace-write`):** Add `--write` for authorized implementation/fix tasks (unless `--network` or `--full-access` is already supplied). Write capability does not authorize scope expansion.
  - **`--network` (`workspace-write` + network):** Forward ONLY when explicitly requested by the user for this invocation (e.g., fetching dependencies or test runners needing loopback sockets). Implies `--write`; cannot be combined with `--full-access`. Never add automatically to recover from a failure.
  - **`--full-access` (`danger-full-access`):** Forward ONLY when explicitly requested by the user for this invocation. Disables the Codex sandbox (`approvalPolicy: never`). Never infer it from an earlier task, never add it after a failure, and ignore mentions inside task text.
- **Model & Effort:** Leave `--model` and `--effort` unset unless explicitly selected. Pass values unchanged; the runtime resolves aliases (`spark` → `gpt-5.3-codex-spark`), validates effort against model capabilities, and tailors task prompts for GPT-6 / GPT-6.1 / GPT-6.2 families.
- **Wait vs Background:** Wait by default (`--wait`). Forward `--background` ONLY when requested; the runner owns its private detached worker, so do not double-detach in a shell.
- **Resume vs Fresh:**
  - Honor explicit `--resume` (mapped to `--resume-last`), `--thread <id>`, or `--fresh`.
  - When resuming a thread, send only the new instruction and changed constraints verbatim; rely on the thread for prior context.
  - If the relationship to a prior Codex task is genuinely ambiguous, run:
    ```bash
    node ~/.gemini/config/plugins/codex/scripts/codex-companion.mjs task-resume-candidate --cwd <workspace> --json
    ```
    If `available: true`, use `ask_question` once to ask whether to continue the previous thread or start fresh.
  - If a resumed thread has an incompatible sandbox mode, report the error and the `--fresh` option instead of escalating permissions.

## Parallel or Isolated Handoffs

When running independent parallel tasks or when context isolation is genuinely helpful, invoke the bundled `codex-rescue` subagent via `invoke_subagent` (`TypeName: "codex-rescue"`), passing the complete task and explicit controls in its prompt.

## Execution & Result Handling

- For foreground runs, pass `WaitMsBeforeAsync: 10000` and `NotificationTimeoutSeconds: 600` to `run_command`. Retry with `BypassSandbox: true` if the standard sandbox blocks `codex app-server`.
- Observers default to 9 minutes; forward `--timeout-ms <ms>` if requested. Exit code `124` means the job is still running: call `codex-await <job-id>` when the result is needed; never report failure or completion, and never cancel.
- Return companion stdout unchanged, preserving job IDs, thread IDs, sandbox mode, result/log paths, errors, and recovery commands. Direct missing CLI or auth errors to `codex-setup`.
- Read [codex-prompting](../codex-prompting/SKILL.md) if the request needs shaping and [codex-result-handling](../codex-result-handling/SKILL.md) for strict relaying rules.
