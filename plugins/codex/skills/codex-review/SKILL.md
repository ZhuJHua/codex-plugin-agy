---
name: codex-review
description: >-
  Run OpenAI Codex's built-in read-only code reviewer against uncommitted
  working-tree changes or branch changes relative to a base ref. Use when the
  user asks for a Codex code review or an accepted plan includes one.
---

# Codex Native Review

Run only when the user requested a Codex review or an accepted task plan includes it. This workflow is **read-only**: do not edit files, fix findings, or add an unrequested independent review.

## Invocation

Run [codex-companion.mjs](../../scripts/codex-companion.mjs) (default path: `~/.gemini/config/plugins/codex/scripts/codex-companion.mjs`):

```bash
node ~/.gemini/config/plugins/codex/scripts/codex-companion.mjs review --cwd <workspace> [flags]
```

Supported flags (forward only what the user selected):
- `--base <ref>`: review branch changes against `<ref>` (e.g., `main`).
- `--scope auto|working-tree|branch`: override auto target detection.
- `--model <model|spark>`: select model (`spark` maps to `gpt-5.3-codex-spark`).
- `--wait` (default) or `--background`: wait by default; forward `--background` only when requested so Antigravity can continue independent work immediately.
- `--timeout-ms <ms>`: override the default 9-minute observer timeout.

> **Unsupported by native review:** Custom focus text, staged-only/unstaged-only scopes, and `--effort` are rejected by native review. Direct the user to `codex-adversarial-review` when custom focus or `--effort` is required.

## Execution & Wait Rules

- Build shell arguments as literal single-quoted values (escape `'` as `'\''`). Never use `eval`.
- Do NOT wrap the companion in a second detached shell (`&`); the companion owns its private detached worker.
- For foreground waits, pass `WaitMsBeforeAsync: 10000` and `NotificationTimeoutSeconds: 600` to `run_command`. Because `codex app-server` needs network and `~/.codex` access, retry with `BypassSandbox: true` if blocked by the sandbox.
- Exit code `124` means the observer reached its wait limit while the worker is **still running**: do NOT report failure or completion, and do NOT cancel. Call `codex-await` with the job ID when the result is needed.

## Output Rules

- Return companion stdout unchanged and preserve actionable stderr on failure.
- A background launch acknowledgment is not a completed review. Never fabricate findings or claim success from the launcher exiting.
