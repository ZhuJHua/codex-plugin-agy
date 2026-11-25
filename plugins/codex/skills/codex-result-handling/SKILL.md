---
name: codex-result-handling
description: >-
  Guidelines for relaying OpenAI Codex outputs, background job launches,
  observer timeouts (exit 124), and failure reports accurately without
  fabrication or unauthorized edits.
---

# Codex Result Handling

Relay companion output unchanged when required. Preserve findings, evidence, uncertainty, changed files, verification limits, job/thread IDs, result/log paths, errors, and exact resume commands (`codex resume <session-id>`). The recorded job status is authoritative; a launcher or observer exiting does not by itself prove task completion.

A background launch reports queued or running work. When the current workflow depends on its result, use `codex-await <job-id>` and return the stored terminal result. Exit code `124` means the wait timed out while the job continues; retain its references, continue independent work or wait again, and do not cancel without the user's explicit request.

Preserve partial output and actual invocation errors, including actionable stderr. Do not recast failed or cancelled work as success, fabricate a Codex answer, or replace a failed delegation with an unrequested implementation. Cancellation preserves history and does not revert edits.

For a review-only request, end after reporting the review. If the user already authorized fixing reviewed issues, continue within that authorization; otherwise obtain approval before editing. Direct missing CLI or login issues to `codex-setup`.
