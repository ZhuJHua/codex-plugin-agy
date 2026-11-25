# Codex Companion Rules

When collaborating with OpenAI Codex in Antigravity, use the bundled `codex-*` skills and the companion runner (`~/.gemini/config/plugins/codex/scripts/codex-companion.mjs`):

- **Code reviews**: Use `codex-review` for native read-only reviews and `codex-adversarial-review` for steerable design/risk reviews. Run reviews only when requested by the user or included in an accepted plan. Do not edit files or add an unrequested independent review during a review-only request.
- **Task delegation**: Use `codex-rescue` directly from the main session by default. Use the `codex-rescue` subagent via `invoke_subagent` only when independent parallel execution or context isolation is genuinely useful.
- **Job management**: Use `codex-status`, `codex-await`, `codex-result`, `codex-cancel`, and `codex-setup`. Only cancel a job when the user explicitly requests cancellation; an observer timeout (exit code `124`) means the detached worker is still running and does not authorize cancelling it.
- **Permission boundaries**: Never silently escalate permissions. Forward `--network` or `--full-access` only when explicitly requested for that invocation; never add them automatically to recover from a failure. For diagnosis, planning, research, or read-only requests, omit `--write`.
- **Result fidelity**: Relay companion output accurately, preserving job IDs, thread IDs, sandbox mode, result/log paths, errors, and recovery commands. A background launch or interrupted observer is not completed work.
