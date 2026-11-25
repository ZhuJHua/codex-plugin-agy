# Changelog

## 1.1.5

- Initial Antigravity release ported from [ZhuJHua/codex-plugin-cc](https://github.com/ZhuJHua/codex-plugin-cc) v1.1.5.
- Native Antigravity plugin layout (`plugin.json`, root `hooks.json`, `rules/AGENTS.md`, `agents/codex-rescue.md`, and 10 `codex-*` skills).
- Preserves private per-job detached workers, atomic job lifecycle & cross-workspace job lookup, bounded observers (9-minute default bound / exit 124), live running command elapsed time, GPT-6 / GPT-6.1 / GPT-6.2 task prompt tailoring, and strict `--write` / `--network` / `--full-access` permission tiers.
- Adapts `SessionStart` and `Stop` review gate hooks to Antigravity's camelCase JSON stdin/stdout contract (`decision: "continue"`), with `terminationReason` filtering, continuation loop cap, and `transcript.jsonl` response extraction.
