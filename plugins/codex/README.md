# Codex Companion Plugin for Antigravity

Collaborate with local [OpenAI Codex CLI](https://developers.openai.com/codex/cli/) (`codex app-server`) directly from Antigravity for code reviews, adversarial design reviews, and delegated coding tasks.

Ported from [ZhuJHua/codex-plugin-cc](https://github.com/ZhuJHua/codex-plugin-cc) (v1.1.5) and adapted natively for Antigravity's plugin architecture (`plugin.json`, `skills/`, `agents/`, `rules/AGENTS.md`, `hooks.json`).

## Highlights (Preserved from `ZhuJHua/codex-plugin-cc` v1.1.5)

- **Private detached worker per job**: Each review or task runs in its own detached Node worker with a private `codex app-server` over stdio (no shared broker daemon).
- **Atomic job lifecycle & coordination**: Atomic JSON state writes, file locks, cross-workspace job lookup by exact ID, and shared `/tmp/codex-companion/` workspace/thread leases (safely coordinating even alongside Claude Code's `codex-plugin-cc`).
- **Bounded observers**: Attaching observers replay at most 20 progress lines; foreground runs and `await` default to a 9-minute observer bound (exit `124` while the worker continues running).
- **Live command elapsed time**: `/codex-status` displays `Current: Running command: ... (running Xm Ys)` for the latest unfinished command.
- **Model-tailored prompts**: Automatically tailors fresh task handoff guidance for OpenAI GPT-6 / GPT-6.1 and GPT-6.2 model families after Codex resolves the model; maps `spark` to `gpt-5.3-codex-spark`.
- **Granular sandbox tiers**: `read-only` (default), `--write` (`workspace-write`), `--network` (`workspace-write` + per-thread/turn network without editing `config.toml`), and `--full-access` (`danger-full-access`, explicit per invocation).
- **Optional Antigravity `Stop` review gate**: Uses Antigravity's native `Stop` hook contract (`decision: "continue"`), guards against non-`NO_TOOL_CALL` stops and infinite loops, and runs read-only attribution-aware stop-time reviews when enabled.

## Included Skills

| Skill | Purpose |
| --- | --- |
| `codex-setup` | Check Node/Codex/auth readiness, offer installation, and toggle `--enable-review-gate` / `--disable-review-gate`. |
| `codex-review` | Run Codex's built-in read-only code reviewer against working-tree or branch (`--base <ref>`) changes. |
| `codex-adversarial-review` | Run a steerable adversarial review challenging assumptions, tradeoffs, and failure modes (`--base`, `--model`, `--effort`, focus text). |
| `codex-rescue` | Delegate investigation, debugging, or implementation tasks to Codex (`--write`, `--network`, `--full-access`, `--resume`, `--fresh`, `--background`, `--model`, `--effort`). |
| `codex-status` | Inspect running and recent Codex jobs, live command elapsed time, and log/result paths. |
| `codex-await` | Wait for a background job and return its stored terminal result (`--timeout-ms`). |
| `codex-result` | Display the stored final output and `codex resume <session-id>` command for a finished job. |
| `codex-cancel` | Cancel an active Codex job on explicit user request while preserving history and logs. |
| `codex-prompting` | Delegation shaping guide and prompt recipes (`references/codex-prompt-recipes.md`). |
| `codex-result-handling` | Accurate relaying rules for Codex outputs, background launches, exit-124 waits, and failures. |

## Bundled Subagent

- `codex-rescue` (`agents/codex-rescue.md`): Optional forwarding subagent for independent parallel tasks or context isolation.

## Requirements

- Node.js 18.18+
- Local `codex` CLI (`npm install -g @openai/codex`) signed in via `codex login` (ChatGPT subscription or OpenAI API key)
