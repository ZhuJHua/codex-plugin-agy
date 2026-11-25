# Prompt Design and Validation

The plugin delegates through the local Codex harness (`codex app-server`). Model and reasoning effort come from user-supplied flags or your local Codex configuration (`~/.codex/config.toml` / `.codex/config.toml`). Fresh task prompts are formatted after the app server reports the resolved model and provider.

## Task Guidance by Model Family

| Resolved model | Fresh task guidance |
| --- | --- |
| OpenAI `gpt-6` and `gpt-6.1` variants | Complete authorized work before asking about a blocker, use checks proportional to the change, and give a concise handoff. |
| OpenAI `gpt-6.2` variants | Proceed on reasonable, reversible assumptions within scope, check the requested outcome before handing back, reuse repository patterns, and give a self-contained handoff. |
| Other models or providers | Use the generic task contract. |

Resumed turns send only the new instruction or continuation message, leaving earlier thread input intact.

## Prompt Surfaces

| Surface | Responsibility |
| --- | --- |
| `skills/codex-rescue/SKILL.md` | Invoke the runner directly from Antigravity by default; preserve the agreed task, context, and explicit execution controls. |
| `agents/codex-rescue.md` | Optional forwarding subagent for independent parallel work or context isolation; invokes the same runner once and relays results verbatim. |
| `skills/codex-prompting/SKILL.md` | Clarify incomplete task requests without inventing scope, paths, or mandatory block templates. |
| `prompts/task.md` | Common initial handoff contract with dynamic guidance selected from the resolved model family. |
| `prompts/adversarial-review.md` | Evidence-based adversarial challenge review with structured JSON output (`schemas/review-output.schema.json`). |
| `prompts/stop-review-gate.md` | `ALLOW:` / `BLOCK:` protocol for work attributable to the immediately previous Antigravity turn. |
| `skills/codex-result-handling/SKILL.md` | Preserve output, uncertainty, verification limits, job/thread IDs, and recovery commands. |
| `rules/AGENTS.md` | Always-on Antigravity guardrails for skill routing, permission boundaries, and result fidelity. |

## Stop Gate Attribution

Antigravity's `Stop` hook receives `transcriptPath`, `cwd`, `terminationReason`, and `executionNum` rather than a per-turn git diff snapshot. The stop-gate hook extracts the latest assistant response from `transcriptPath` as a scope hint, skips non-`NO_TOOL_CALL` terminations (e.g., `USER_CANCELED`, `ERROR`), caps continuations at 3 per turn, and instructs Codex to return `ALLOW:` with a limitation rather than block on unrelated dirty files when attribution cannot be proven.
