---
name: codex-setup
description: >-
  Check whether the local OpenAI Codex CLI is installed and authenticated,
  optionally install it via npm, and enable or disable the stop-time Codex
  review gate for the current workspace. Use when setting up Codex, diagnosing
  Codex auth/runtime errors, or toggling the stop review gate.
---

# Codex Setup

Run the companion runner [codex-companion.mjs](../../scripts/codex-companion.mjs) (default path: `~/.gemini/config/plugins/codex/scripts/codex-companion.mjs`) with `setup`:

```bash
node ~/.gemini/config/plugins/codex/scripts/codex-companion.mjs setup --cwd <workspace> --json [flags]
```

Supported flags (forward only when the user requested them):
- `--enable-review-gate`: enable the read-only Codex `Stop` review gate for the current workspace.
- `--disable-review-gate`: disable the `Stop` review gate for the current workspace.

> **Sandbox note:** `setup` spawns a short-lived `codex app-server` to read local auth status (`~/.codex`). Try sandboxed first; if blocked by sandbox restrictions, retry with `BypassSandbox: true`.

## Missing Codex CLI Flow

If the JSON result reports `codex.available === false` and `npm.available === true`:
1. Use `ask_question` once to ask whether to install `@openai/codex` globally now, with options:
   - `(Recommended) Install Codex now`
   - `Skip for now`
2. If the user approves, run:
   ```bash
   npm install -g @openai/codex
   ```
3. Re-run `setup --cwd <workspace> --json` (preserving any review-gate flag) and present the updated status.

If Codex is already installed or `npm` is unavailable, do not ask about installation.

## Output Rules

- Present the final setup checks (`node`, `npm`, `codex`, `auth`, `sessionRuntime`, `reviewGateEnabled`), actions taken, and next steps clearly.
- If Codex is installed but not authenticated, preserve the guidance to run `codex login` (or `codex login --device-auth` / `codex login --with-api-key`) in a terminal.
- If `--enable-review-gate` was enabled, remind the user that the stop gate can trigger iterative fix/review turns and consume Codex usage limits.
