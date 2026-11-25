---
name: codex-result
description: >-
  Retrieve the stored final output, Codex session ID, and `codex resume`
  command for a finished Codex review or task job.
---

# Codex Stored Result

Retrieve the stored final output for the latest finished Codex job in the workspace or a specific job ID (exact job IDs resolve across workspaces automatically).

## Invocation

Run [codex-companion.mjs](../../scripts/codex-companion.mjs) (default path: `~/.gemini/config/plugins/codex/scripts/codex-companion.mjs`):

```bash
node ~/.gemini/config/plugins/codex/scripts/codex-companion.mjs result --cwd <workspace> [job-id] [--json]
```

## Output Rules

- Present the full runtime output unchanged.
- Preserve findings, uncertainty, changed files, verification limits, job/thread IDs, `codex resume <session-id>` commands, result/log paths, errors, and recovery commands.
- Preserve actionable stderr if invocation fails (for example, if the job is still running).
