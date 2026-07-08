# Dilag Platform Documentation

Dilag is an AI-powered design studio for mobile and web apps. The desktop app turns natural-language prompts into editable HTML screens with live canvas previews, then lets users iterate through chat.

## Product Model

A Dilag project is a local folder registered in SQLite with:

- project metadata in `~/.dilag/state.sqlite`
- canonical generated screen files in `{project-cwd}/.designs/**/*.html` (`screens/**/*.html` is legacy fallback display only)
- chat history backed by the embedded agent runtime under `~/.dilag/pi`
- Dilag design skills loaded from `~/.dilag/skills`

## Tech Stack

```text
Presentation: React 19, TanStack Router, Tailwind CSS 4, Radix UI, shadcn/ui
State:        Zustand, Immer, React Query
Desktop:      Electron main/preload, @dilag/desktop-bridge
Agent:        Embedded Pi coding-agent SDK in Electron main
Web:          Next.js 16 marketing site
```

## Primary Screens

- **Home**: prompt entry, platform choice, recent chats (shown on the project landing view).
- **Studio**: canvas preview, chat, timeline, file/project navigation, model selector, skill management.
- **Settings/dialogs**: provider selection, API-key connection, updates, exports.

## Core User Flow

1. User launches the desktop app.
2. User connects at least one AI provider and selects a model.
3. User describes a mobile or web app idea on Home.
4. Dilag creates or selects a project cwd and starts an agent session there.
5. The first prompt activates the matching design skill.
6. The agent writes HTML screens into `{project-cwd}/.designs/`.
7. The canvas renders `.designs/**/*.html`, plus legacy `screens/**/*.html` fallback files when present.
8. User continues iterating through chat in Studio.

## Runtime Flow

1. Renderer calls `bridge.agent.start()`.
2. `GlobalEventsProvider` subscribes to `bridge.agent.onEvent()`.
3. Projects are loaded from `~/.dilag/state.sqlite`.
4. The Electron host creates or opens an agent session in the selected project cwd.
5. First prompt is prefixed with `/skill:web-design` or `/skill:mobile-design`.
6. Agent tools write HTML into `{project-cwd}/.designs/`.
7. The design loader reads canonical `.designs/**/*.html` files, falls back to legacy `screens/**/*.html` display files, and refreshes the canvas.
8. Follow-up chat prompts update or add screens in the same project cwd.

## Agent Bridge

The renderer uses the product-level `agent` bridge:

```ts
bridge.agent.getProviderData()
bridge.agent.setApiKey({ providerID, apiKey })
bridge.agent.createSession({ directory })
bridge.agent.getMessages({ sessionID, directory })
bridge.agent.prompt({ sessionID, directory, text, images, model })
bridge.agent.abort({ sessionID })
bridge.agent.getTree({ sessionID })
bridge.agent.navigateTree({ sessionID, targetId })
```

The bridge intentionally hides SDK-specific types from React components.

## Provider Connection And Model Selection

The provider dialog stores API keys through the agent bridge. The model selector reads connected providers and models from the embedded runtime. If the user has not selected a model, Dilag uses the first authenticated model reported by the runtime.

Expected behavior to preserve during feature testing:

- provider list loads without an external runtime process
- API-key connection succeeds or returns a clear error
- connected providers appear in setup and Studio
- model selector shows available models for authenticated providers
- selected model persists across sessions when applicable

## Chat And Sessions

Studio chat uses normalized message and event shapes from the bridge. The UI should support:

- loading persisted messages for an existing session
- sending a prompt with optional attachments
- streaming assistant text and tool updates
- showing session status/idle/error states
- aborting an in-flight prompt
- continuing a session after app restart

## Questions

Dilag keeps its question UI by registering a runtime-backed `question` tool. The tool emits `question.asked`, waits for the renderer response, and resolves back into the tool call. The UI should continue to support answering and rejecting questions from the chat pane.

## Permissions

Runtime permission prompts are intentionally skipped for the Pi path. Tool scope, project cwd isolation, design skills, and prompt guardrails are the enforcement model.

## Generated Output

Generated screens are plain HTML files in the active project cwd. `.designs/**/*.html` is canonical for all new and updated output. `screens/**/*.html` is deprecated and loaded only as a legacy fallback.

The preview system is runtime-independent: if files exist in those display locations and validate, the canvas can render them.

## Session Tree

Timeline navigation uses the runtime's session tree. Timeline actions call `bridge.agent.navigateTree()` and reload messages from the session file. Product copy should describe this as timeline/history navigation rather than exposing runtime internals.

## Feature Test Checklist

Use this checklist when validating the desktop app:

- App boots and `bridge.agent.start()` completes.
- Provider dialog can save an API key.
- Model list refreshes after connecting a provider.
- Home can create a new web-design session.
- Home can create a new mobile-design session.
- Studio loads the created session and existing messages.
- A prompt streams assistant output and tool activity.
- Generated `.designs/**/*.html` files appear and render on the canvas.
- Legacy `screens/**/*.html` files still render as fallback display files.
- Follow-up chat updates or adds screens.
- Question prompts can be answered or rejected.
- Abort stops an in-flight prompt cleanly.
- App restart preserves sessions and provider/model state.

## Maintained Docs

- `docs/README.md` is the documentation index.
- `docs/architecture.md` is the technical runtime reference.
- `docs/platform.md` is the product/platform behavior reference.
- `docs/development.md` is the local development and quality-gate reference.
