# Codex Plugin for Antigravity

Collaborate with [OpenAI Codex CLI](https://developers.openai.com/codex/cli/) directly inside Google Antigravity for code reviews, adversarial design reviews, and delegated coding tasks.

Ported from [ZhuJHua/codex-plugin-cc](https://github.com/ZhuJHua/codex-plugin-cc) (v1.1.5) — a hardened fork of [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) — and adapted natively for Antigravity's plugin system (`plugin.json`, root `hooks.json`, `skills/`, `agents/`, `rules/AGENTS.md`).

## What You Get

- **Native & Adversarial Reviews**: `codex-review` (built-in Codex reviewer) and `codex-adversarial-review` (steerable challenge review with `--effort`, `--model`, and custom focus text).
- **Task Delegation**: `codex-rescue` directly from the main Antigravity session by default, plus an optional `codex-rescue` subagent for independent parallel tasks or context isolation.
- **Background Job Control**: `codex-status`, `codex-await`, `codex-result`, `codex-cancel`, and `codex-setup`.
- **Optional Stop-Time Review Gate**: Antigravity `Stop` hook that reviews attributable edits from the last turn before ending the loop.

## Key Engineering Highlights (v1.1.5)

- **Private detached worker per job**: Each review or task runs in its own detached Node worker owning a private `codex app-server` over stdio (no shared broker daemon).
- **Atomic job lifecycle & safe cross-tool coordination**: Atomic JSON state writes, process-locked transactions, cross-workspace job lookup by exact ID, and shared `/tmp/codex-companion/` workspace/thread leases (safely coordinating even if you use both Antigravity and Claude Code on the same repository).
- **Bounded observers**: Attaching observers replay at most 20 progress lines; foreground runs and `await` default to a 9-minute observer limit (exit code `124` without cancelling the detached worker).
- **Live running command elapsed time**: `codex-status` displays `Current: Running command: ... (running Xm Ys)` derived from log timestamps.
- **GPT-6 model-family prompt tailoring**: Dynamically tailors fresh task guidance for OpenAI `gpt-6` / `gpt-6.1` and `gpt-6.2` families after Codex resolves the model; maps `spark` to `gpt-5.3-codex-spark`.
- **Strict sandbox tiers**:
  - Default (`read-only`) for diagnosis, planning, research, and reviews
  - `--write` (`workspace-write`) for authorized implementation
  - `--network` (`workspace-write` + per-thread/turn network access without mutating `~/.codex/config.toml`)
  - `--full-access` (`danger-full-access`, explicit per invocation, never silently escalated)

## Requirements

- **Node.js 18.18+**
- **OpenAI Codex CLI** (`npm install -g @openai/codex`) authenticated via `codex login` (ChatGPT subscription or OpenAI API key)

## Installation

### Global install (all Antigravity workspaces)

```bash
git clone https://github.com/ZhuJHua/codex-plugin-agy.git
cd codex-plugin-agy
npm run install:plugin
```

For local development (edits in this repo take effect immediately):

```bash
npm run install:symlink
```

### Workspace-scoped install (single project)

```bash
node scripts/install.mjs --workspace /path/to/your/project
```

This installs the plugin into `<project>/.agents/plugins/codex/`.

### Uninstall

```bash
npm run uninstall:plugin
```

After installation, Antigravity discovers the plugin automatically on the next turn. Ask Antigravity to run `/codex-setup` (or "check Codex setup") to verify Node, Codex CLI, and authentication status.

## Included Skills & Subagent

| Component | Type | Purpose |
| --- | --- | --- |
| `codex-setup` | Skill | Verify Node/Codex/auth readiness, offer npm install, toggle `--enable-review-gate` / `--disable-review-gate`. |
| `codex-review` | Skill | Run Codex's built-in read-only reviewer on uncommitted changes or `--base <ref>`. |
| `codex-adversarial-review` | Skill | Run a steerable adversarial review (`--base`, `--model`, `--effort`, focus text). |
| `codex-rescue` | Skill | Delegate tasks to Codex (`--write`, `--network`, `--full-access`, `--resume`, `--fresh`, `--background`, `--model`, `--effort`). |
| `codex-status` | Skill | Inspect active and recent jobs, live command elapsed time, and log/result paths. |
| `codex-await` | Skill | Wait for a background job and return its stored terminal result (`--timeout-ms`). |
| `codex-result` | Skill | Display stored final output and `codex resume <session-id>` command. |
| `codex-cancel` | Skill | Cancel an active job on explicit user request while preserving history and logs. |
| `codex-prompting` | Skill | Delegation prompt shaping guide and recipes (`references/codex-prompt-recipes.md`). |
| `codex-result-handling` | Skill | Accurate relaying rules for outputs, launches, exit-124 waits, and failures. |
| `codex-rescue` | Subagent | Thin forwarding subagent for independent parallel or context-isolated Codex tasks. |

## Stop-Time Review Gate

Enable or disable per workspace:

```bash
node ~/.gemini/config/plugins/codex/scripts/codex-companion.mjs setup --cwd /path/to/repo --enable-review-gate
node ~/.gemini/config/plugins/codex/scripts/codex-companion.mjs setup --cwd /path/to/repo --disable-review-gate
```

When enabled, Antigravity's `Stop` hook runs `scripts/stop-review-gate-hook.mjs` on normal turn completions (`NO_TOOL_CALL`). It extracts the latest assistant response from `transcriptPath` as a scope hint, runs a read-only attribution-aware Codex check, and returns `{"decision": "continue", "reason": "..."}` only when a concrete material defect is found (capped at 3 continuations per user turn to avoid runaway loops).

> [!WARNING]
> The stop review gate can trigger iterative fix/review loops and consume Codex usage limits quickly. Enable it only when actively monitoring a session.

## Development & Testing

```bash
npm test
```

See [docs/prompting.md](docs/prompting.md) and [docs/reliability.md](docs/reliability.md) for prompt design, execution lifecycle, and coordination details.

## License

Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
