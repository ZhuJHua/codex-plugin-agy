---
name: codex-adversarial-review
description: >-
  Run a steerable read-only adversarial code and design review using OpenAI
  Codex to challenge assumptions, tradeoffs, edge cases, race conditions, and
  failure handling. Supports --base, --model, --effort, and custom focus text.
---

# Codex Adversarial Review

Run only when the user requested an adversarial/challenge review from Codex or an accepted task plan includes it. This workflow is **read-only**: do not edit files, fix findings, or add an unrequested independent review.

## Invocation

Run [codex-companion.mjs](../../scripts/codex-companion.mjs) (default path: `~/.gemini/config/plugins/codex/scripts/codex-companion.mjs`):

```bash
node ~/.gemini/config/plugins/codex/scripts/codex-companion.mjs adversarial-review --cwd <workspace> [flags] -- '<optional focus text>'
```

Supported flags (forward only what the user selected):
- `--base <ref>`: compare current branch against `<ref>` (e.g., `main`).
- `--scope auto|working-tree|branch`: override auto target detection (staged-only/unstaged-only scopes are unsupported).
- `--model <model|spark>`: select model (`spark` maps to `gpt-5.3-codex-spark`).
- `--effort <none|minimal|low|medium|high|xhigh|max|ultra>`: select reasoning effort (validated by runtime against model capabilities).
- `--wait` (default) or `--background`: wait by default; forward `--background` only when requested.
- `--timeout-ms <ms>`: override the default 9-minute observer timeout.
- Optional trailing focus text after `--` (omit `--` and text if no extra focus was given).

## Execution & Wait Rules

- Quote arguments cleanly with single quotes (escape `'` as `'\''`). Never use `eval`.
- Do NOT wrap the companion in a second detached shell (`&`); the companion owns its private detached worker.
- For foreground waits, pass `WaitMsBeforeAsync: 10000` and `NotificationTimeoutSeconds: 600` to `run_command`. Retry with `BypassSandbox: true` if the standard sandbox blocks `codex app-server`.
- Exit code `124` means the observer timed out while the worker continues running: report the job ID and use `codex-await` when the result is needed; never report failure or cancel.

## Output Rules

- Return companion stdout unchanged and preserve actionable stderr on failure.
- A background launch report is not a completed review; use `codex-await <job-id>` when the workflow needs the findings.
