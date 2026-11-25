---
name: codex-cancel
description: >-
  Cancel an active OpenAI Codex companion job when explicitly requested by the
  user, while retaining its job record, partial output, and logs.
---

# Cancel Codex Job

**Strict guard:** Only run this skill when the user explicitly asked to cancel or stop a Codex job. A wait timeout (exit `124`) or a slow task is **not** permission to cancel.

## Invocation

Run [codex-companion.mjs](../../scripts/codex-companion.mjs) (default path: `~/.gemini/config/plugins/codex/scripts/codex-companion.mjs`):

```bash
node ~/.gemini/config/plugins/codex/scripts/codex-companion.mjs cancel --cwd <workspace> [job-id] [--json]
```

If `[job-id]` is omitted and exactly one job is active, it cancels that job; if multiple are active, it asks for a specific job ID. Exact job IDs resolve across workspaces.

> **Sandbox note:** Verifying process identity (`ps`) and terminating detached process groups may require `BypassSandbox: true` if blocked by the standard sandbox.

## Output Rules

- Return the runtime output unchanged, including whether termination was confirmed.
- Remind the user if relevant that cancellation retains the job record, partial output, and logs, and does **not** revert edits already written to disk.
- Preserve actionable stderr if cancellation fails.
