---
name: repro-session
description: Debug and reproduce Dilag desktop sessions backed by the embedded Pi coding-agent SDK. Use when given a Dilag/Pi session ID, a stuck or busy session, missing generated screens, question UI issues, tool-call failures, or requests to inspect recent Pi session messages after migrating away from Claude/opencode commands.
---

# Repro Session

Use this skill to inspect a Dilag desktop session without relying on the old `opencode serve` HTTP API. Dilag embeds Pi through the SDK in Electron main, so there is no Pi server port to discover.

## Quick Start

Run the inspector first:

```bash
node .agents/skills/repro-session/scripts/inspect-dilag-pi-session.mjs <session-id>
```

Use `--json` when another script or test needs machine-readable output.

## Workflow

1. Identify the session ID from the route, UI, copied session ID, logs, or user report.
2. Run the inspector from the repo root.
3. Read the matching Pi JSONL session under `~/.dilag/pi/sessions/**`.
4. Report:
   - session file, cwd, model, thinking level, message counts, and latest timestamp
   - latest user prompt and latest assistant text
   - recent tool calls and whether each has a matching `toolResult`
   - unresolved `question` tools as possible pending/lost question UI state
   - generated `.designs/*.html` files in the session cwd
5. If the persisted session looks incomplete, inspect the live app path in `apps/desktop/electron/ipc/pi.ts` and renderer state around `bridge.agent.*`.

## Pi/Dilag Facts

- Do not search for `opencode serve` or curl `/session`, `/question`, or `/permission`; that command is obsolete for Dilag's Pi path.
- Pi sessions are JSONL files stored under `~/.dilag/pi/sessions/--<cwd-with-dashes>--/`.
- Dilag maps Pi runtime events into bridge events such as `message.updated`, `message.part.updated`, `session.status`, `session.idle`, `session.error`, `question.asked`, `question.replied`, and `question.rejected`.
- Runtime permission prompts are intentionally skipped on the Pi path. If a bug report mentions pending permissions, translate that into a stale tool call, lost UI event, or obsolete opencode assumption.
- Dilag keeps question UI through a custom Pi `question` tool. Persisted JSONL can show unresolved `question` tool calls, but live pending question requests are held in Electron main memory.
- Generated screens should be in `{project-cwd}/.designs/**/*.html`; `screens/` is only a legacy fallback.

## Interpreting Results

- **Unresolved latest tool call**: the session may still be running, may have been aborted before a tool result persisted, or may have lost a runtime event.
- **Unresolved `question` tool**: check the renderer question UI and `listAgentQuestions()`/`pendingQuestions` handling in `apps/desktop/electron/ipc/pi.ts`.
- **No generated screens**: verify the active project cwd and whether the agent wrote to `.designs/` instead of an unrelated path.
- **Session not found**: check whether the copied ID is partial, whether the project cwd differs, or whether this is a legacy `~/.dilag/sessions` session rather than a Pi session.

## Useful Source Paths

- `apps/desktop/electron/ipc/pi.ts` - Pi SDK adapter, runtime sessions, question tool, event mapping.
- `apps/desktop/electron/ipc/paths.ts` - Dilag and Pi storage paths.
- `packages/desktop-bridge/src/index.ts` - renderer/preload bridge contract.
- `docs/architecture.md` and `docs/platform.md` - product-level Pi architecture and behavior.
