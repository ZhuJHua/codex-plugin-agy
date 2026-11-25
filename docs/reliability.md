# Execution and Recovery Protocol

All execution commands (`task`, `review`, `adversarial-review`) persist a queued request before launching a detached Node worker. The foreground process observes that record and streams its log. Killing or timing out the observer does not kill the worker. Each worker starts and closes its own private `codex app-server` over stdio; persistent task threads remain in the user's existing `CODEX_HOME` (`~/.codex`).

## State and Coordination

- **State root**: Defaults to `<os.tmpdir()>/codex-companion-agy` (override with `CODEX_COMPANION_DATA_DIR`), ensuring Antigravity `run_command` invocations and lifecycle hooks (`SessionStart` / `Stop`) always read and write the exact same state directory.
- **Authoritative job JSON**: Each job record stores request parameters, worker/runtime process identities, cancellation intent, resolved configuration, observations, and terminal result. Queries scan job files directly, so removing `state.json` does not lose job history.
- **Cross-workspace lookup**: `status`, `result`, `await`, and `cancel` resolve an exact job ID across workspace state directories (failing explicitly on ambiguity while keeping list views workspace-scoped).
- **Cross-tool leases**: Global workspace leases and thread leases are stored under `<os.tmpdir()>/codex-companion/`, matching `codex-plugin-cc`. Read-only jobs may overlap; write jobs (`--write`, `--network`, `--full-access`) conflict with any active job on the same canonical worktree, preventing concurrent edit collisions even when using Antigravity and Claude Code side by side.

## End States, Observers, and Cancellation

- Only a root terminal acknowledgement completes a turn (`turn/completed` or non-retrying root error).
- Attaching observers (`await`) replay at most 20 earlier progress lines. Foreground commands and `await` default to a 9-minute observer bound (`540000ms`), exiting with code `124` while the detached worker keeps running.
- `status` computes live command elapsed time (`Current: Running command: ... (running Xm Ys)`) from progress log timestamps so interim events do not hide a long-running command.
- Cancellation targets the recorded turn first (`turn/interrupt`), then verifies process start identity before terminating owned process groups. Unverified or surviving processes are reported explicitly as `terminationUnconfirmed`. Cancellation preserves logs and partial output and does not revert edits.
- Persistent tasks automatically retry explicit capacity/server-overloaded failures up to twice (5s and 15s backoff) on the same thread while preserving requested model, effort, and sandbox policy.

## Permission Tiers

- `read-only` (default for direct `task`, `review`, `adversarial-review`, and stop gate)
- `--write` (`workspace-write`)
- `--network` (`workspace-write` + per-thread `sandbox_workspace_write.network_access: true` and `turn/start.sandboxPolicy.networkAccess: true`; never mutates `~/.codex/config.toml`)
- `--full-access` (`danger-full-access`, `approvalPolicy: "never"`, explicit per invocation only)
