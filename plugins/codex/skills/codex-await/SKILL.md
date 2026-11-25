---
name: codex-await
description: >-
  Wait for a running or queued OpenAI Codex background job to finish and return
  its stored terminal result. Handles bounded observer timeouts (exit code 124)
  without cancelling the detached worker.
---

# Await Codex Job

Wait for an identified Codex job when the current workflow needs its terminal result. Exact job IDs resolve across workspaces automatically.

## Invocation

Run [codex-companion.mjs](../../scripts/codex-companion.mjs) (default path: `~/.gemini/config/plugins/codex/scripts/codex-companion.mjs`):

```bash
node ~/.gemini/config/plugins/codex/scripts/codex-companion.mjs await --cwd <workspace> <job-id> [--timeout-ms <ms>] [--json]
```

## Wait & Output Rules

- Pass `WaitMsBeforeAsync: 10000` and `NotificationTimeoutSeconds: 600` to `run_command`.
- Observers replay at most 20 earlier progress lines when attaching and default to a 9-minute wait limit (`--timeout-ms` overrides).
- **Exit code `124`** means only that this wait invocation timed out while the detached worker **continues running**. Report the job ID and `/codex-await` / `/codex-status` / `/codex-result` options; do NOT cancel the job or claim completion or failure.
- Return the stored terminal result and exit status unchanged. Preserve actionable stderr on failure.
