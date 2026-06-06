# Dilag Architecture

This document describes the current desktop architecture. Dilag keeps a stable product bridge in the renderer while embedding the Pi coding-agent SDK in Electron main.

## Goals

- Keep the renderer runtime-agnostic: React talks to `@dilag/desktop-bridge`, not to Pi directly.
- Store Dilag app metadata locally in SQLite under `~/.dilag`, while generated HTML lives in each project cwd.
- Isolate Pi auth/session data under `~/.dilag/pi`.
- Preserve the desktop product contract: provider connection, model selection, session creation, streaming chat, generated HTML screens, questions, and timeline navigation.

## Process Boundaries

```text
React renderer
  └─ window.dilag / @dilag/desktop-bridge
      └─ Electron preload
          └─ Electron main IPC handlers
              └─ Pi SDK runtime + filesystem/native services
```

The renderer never imports Pi directly. All native and agent access goes through `@dilag/desktop-bridge` so the UI remains insulated from runtime-specific SDK types.

## App Startup

1. Electron main starts from `apps/desktop/electron/main.ts`.
2. `registerHostHandlers()` wires native IPC domains: app, agent, sessions, designs, project files, skills, menu, zoom, updater, filesystem, dialog, and shell.
3. `initializeHost()` prepares the embedded Pi runtime.
4. The renderer boots from `apps/desktop/src/main.tsx`, calls `bridge.agent.start()`, then renders the router.
5. `GlobalEventsProvider` subscribes to `bridge.agent.onEvent()` and forwards normalized agent events into the Zustand session store.

## Runtime Bridge

Pi is embedded in Electron main through `apps/desktop/electron/ipc/pi.ts`. The bridge namespace remains product-level and provider-neutral:

```ts
bridge.agent.start()
bridge.agent.getProviderData()
bridge.agent.setApiKey({ providerID, apiKey })
bridge.agent.createSession({ directory })
bridge.agent.getMessages({ sessionID, directory })
bridge.agent.prompt({ sessionID, directory, text, images, model })
bridge.agent.abort({ sessionID })
bridge.agent.getTree({ sessionID })
bridge.agent.navigateTree({ sessionID, targetId })
bridge.agent.onEvent(listener)
```

Bridge request/response and event types live in `packages/desktop-bridge`. Runtime-specific conversion stays in the Electron host.

## Storage

Dilag-owned app state lives under `~/.dilag/`; generated designs live in project folders:

```text
~/.dilag/
├── state.sqlite                   # Project registry and app state
├── pi/
│   ├── auth.json                  # Provider credentials for Pi auth storage
│   ├── models.json                # Model registry/cache data when present
│   └── sessions/                  # Pi JSONL session data, keyed by project cwd
└── skills/                        # Built-in Dilag design skills for Pi

{project-cwd}/
├── .designs/                      # Canonical generated HTML screens
│   └── **/*.html
└── screens/                       # Legacy fallback display only
    └── **/*.html
```

`~/.dilag/sessions.json` and `~/.dilag/sessions/{session-id}` are legacy-only migration surfaces. New project/session state comes from SQLite plus Pi sessions keyed by project cwd. User-installed skills target `~/.agents/skills`.

## Agent Events

The Pi adapter projects Pi events into stable renderer events:

- `message.updated`
- `message.part.updated`
- `session.status`
- `session.idle`
- `session.error`
- `session.updated`
- `session.diff`
- `file.watcher.updated`
- `project.updated`
- `question.asked`
- `question.replied`
- `question.rejected`

This keeps chat rendering, tool rendering, project-file diff badges, and the question UI independent of the underlying runtime.

## Session Lifecycle

1. The renderer selects or creates a project registered in `~/.dilag/state.sqlite`.
2. `bridge.agent.createSession({ directory: project.path })` creates or opens the matching Pi JSONL session for that project cwd.
3. The sessions list is derived from Pi sessions across SQLite-registered projects.
4. The first prompt is prefixed with the selected design skill, such as `/skill:web-design` or `/skill:mobile-design`.
5. Prompts are sent through `bridge.agent.prompt()` with the selected model and optional image attachments.
6. Pi streams normalized events back through `bridge.agent.onEvent()`.
7. Pi tools write generated screens into `{project-cwd}/.designs/`.
8. The design loader reads canonical `{project-cwd}/.designs/**/*.html` files, then legacy fallback `{project-cwd}/screens/**/*.html` files, and updates the canvas.

## Messages And Timeline

Persisted messages are loaded from the Pi session and projected into Dilag chat message shapes. Live message/tool updates use the same normalized event contract, so the chat UI does not render Pi SDK objects directly.

Tree navigation replaces the old revert/unrevert model. Timeline actions call `bridge.agent.navigateTree()` and then reload messages from the Pi session.

## Models And Auth

`bridge.agent.getProviderData()` reads authenticated provider/model availability from Pi's `ModelRegistry`. On first run, Dilag falls back to the first available authenticated model. API keys entered in the provider dialog are written to Pi auth storage under `~/.dilag/pi`.

## Generated Output

Generated screens are plain HTML files in the active project cwd. `.designs/**/*.html` is canonical for all new and updated output. `screens/**/*.html` is deprecated and loaded only as a legacy fallback so older or mistaken runs do not leave the canvas empty.

The canvas preview is runtime-independent. If valid screen files exist in those display locations, the renderer can display them regardless of which agent runtime produced them.

## Quality Gates

Use the root commands unless a narrower package command is enough:

```bash
bun run fmt:check
bun run lint
bun run typecheck
bun run test
bun run build
```
