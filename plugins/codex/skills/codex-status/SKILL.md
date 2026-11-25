---
name: codex-status
description: >-
  Inspect active and recent OpenAI Codex companion jobs, including live phase,
  running command elapsed time, sandbox mode, and result/log paths. Supports
  cross-workspace lookup by exact job ID.
---

# Codex Job Status

Query progress for Codex jobs in the current workspace or for a specific job ID (exact job IDs resolve across workspaces automatically).

## Invocation

Run [codex-companion.mjs](../../scripts/codex-companion.mjs) (default path: `~/.gemini/config/plugins/codex/scripts/codex-companion.mjs`):

```bash
node ~/.gemini/config/plugins/codex/scripts/codex-companion.mjs status --cwd <workspace> [job-id] [flags]
```

Supported flags:
- `[job-id]`: inspect a single job (exact or unambiguous prefix).
- `--all`: include more than the default 8 recent jobs.
- `--wait` (requires `[job-id]`): poll until the job finishes or `--timeout-ms <ms>` expires.
- `--json`: emit machine-readable JSON snapshot.

## Output Rules

- Present the runtime output unchanged, including job IDs, status, phase, elapsed time, live running command elapsed time (`Current: Running command: ...`), sandbox mode, Codex session ID, result/log paths, errors, and follow-up commands.
- Do not infer completion from elapsed time. Preserve actionable stderr on failure.
