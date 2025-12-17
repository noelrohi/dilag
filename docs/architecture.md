# Dilag Architecture

Technical documentation covering app initialization, data flow, and storage.

---

## Table of Contents

1. [App Startup Flow](#app-startup-flow)
2. [Storage & Persistence](#storage--persistence)
3. [SSE Event System](#sse-event-system)
4. [Session Lifecycle](#session-lifecycle)

---

## App Startup Flow

### New User (First Launch)

```
1. TAURI BACKEND INITIALIZES
   └── lib.rs: run()
       ├── Registers plugins (shell, opener)
       ├── Creates AppState { opencode_pid: None }
       └── Registers all Tauri commands

2. REACT APP MOUNTS
   └── main.tsx
       └── RouterProvider mounts __root.tsx

3. ROOT LAYOUT MOUNTS
   └── __root.tsx: RootLayout()
       ├── Creates QueryClient (React Query)
       ├── Wraps app in QueryClientProvider
       └── Wraps app in GlobalEventsProvider  ← TRIGGERS BACKEND INIT

4. GLOBAL EVENTS PROVIDER INITIALIZES
   └── global-events.tsx: GlobalEventsProvider()
       │
       ├── Creates OpenCode SDK client (baseUrl: http://127.0.0.1:4096)
       │
       └── useEffect runs init():
           │
           ├── invoke("start_opencode_server")
           │   │
           │   │   TAURI BACKEND (lib.rs):
           │   ├── Check if already running (no)
           │   ├── Create ~/.dilag/ directory
           │   ├── Create ~/.dilag/sessions/ directory
           │   ├── Create ~/.dilag/opencode/opencode.json config
           │   │   └── Contains "designer" agent with system prompt
           │   ├── Spawn: opencode serve --port 4096 --hostname 127.0.0.1
           │   │   └── With XDG_CONFIG_HOME=~/.dilag (isolated config)
           │   ├── Wait 500ms for server to start
           │   └── Return port 4096
           │
           ├── setIsServerReady(true)
           │
           ├── Connect to SSE: sdk.global.event()
           │   └── Opens persistent connection to http://127.0.0.1:4096/events
           │
           ├── setIsConnected(true)
           │
           └── Start event loop (for await...of events.stream)
               └── Dispatches events to all subscribers

5. HOME PAGE LOADS
   └── index.lazy.tsx: LandingPage()
       │
       └── useSessions() hook initializes
           │
           ├── useSessionsList() → React Query fetches sessions
           │   └── invoke("load_sessions_metadata")
           │       └── Reads ~/.dilag/sessions.json (empty for new user)
           │       └── Returns []
           │
           ├── Subscribe to global events (SSE)
           │
           └── useEffect: no sessions to auto-select

6. UI RENDERS
   └── Home screen displays:
       ├── Header: "dilag" + "connecting..." (briefly)
       ├── Composer: Empty textarea, model selector
       ├── Recent Projects: Empty (no sessions)
       └── Model selector fetches models via sdk.provider.list()
```

**What gets created on first launch:**

| Path | Purpose |
|------|---------|
| `~/.dilag/` | App data root |
| `~/.dilag/sessions/` | Session working directories |
| `~/.dilag/sessions.json` | Session metadata (empty) |
| `~/.dilag/opencode/opencode.json` | OpenCode config with designer agent |

---

### Existing User (Returning)

```
1-3. SAME AS NEW USER

4. GLOBAL EVENTS PROVIDER INITIALIZES
   └── useEffect runs init():
       │
       ├── invoke("start_opencode_server")
       │   │
       │   │   TAURI BACKEND:
       │   ├── ~/.dilag/ already exists ✓
       │   ├── ~/.dilag/sessions/ already exists ✓
       │   ├── Overwrites opencode.json (ensures agent prompt is current)
       │   ├── Spawn OpenCode server
       │   └── Return port 4096
       │
       ├── setIsServerReady(true)
       ├── Connect to SSE stream
       └── setIsConnected(true)

5. HOME PAGE LOADS
   └── useSessions() hook initializes
       │
       ├── useSessionsList() → fetches sessions
       │   └── invoke("load_sessions_metadata")
       │       └── Returns existing sessions array
       │
       ├── Subscribe to global events
       │
       └── useEffect for auto-select:
           ├── sessions.length > 0 ✓
           ├── currentSessionId === null
           ├── Auto-select most recent session
           └── Load messages: sdk.session.messages()

6. ZUSTAND HYDRATES FROM LOCALSTORAGE
   └── Restores persisted state:
       ├── currentSessionId (last selected)
       └── screenPositions (canvas positions per session)

7. UI RENDERS
   └── Home screen with Recent Projects
       │
       └── For each project card:
           └── invoke("load_session_designs", { sessionCwd })
               └── Loads HTML from ~/.dilag/sessions/{id}/screens/
               └── Renders thumbnail previews
```

**Key differences from new user:**

| Aspect | New User | Existing User |
|--------|----------|---------------|
| `~/.dilag/` | Created | Exists |
| `sessions.json` | Empty `[]` | Has session data |
| Recent Projects | Hidden | Shows up to 4 cards |
| Zustand hydration | Defaults | Restores state |
| Thumbnails | None | Loads from disk |

---

## Storage & Persistence

### File System (`~/.dilag/`)

```
~/.dilag/
├── sessions.json                    # Session metadata index
├── opencode/
│   └── opencode.json               # OpenCode config (designer agent)
└── sessions/
    └── {session-uuid}/             # Per-session working directory
        └── screens/
            ├── home-screen.html    # Generated design files
            ├── profile.html
            └── ...
```

**sessions.json schema:**
```json
{
  "sessions": [
    {
      "id": "uuid-string",
      "name": "Building meditation app",
      "created_at": "2025-12-17T06:48:00.000Z",
      "cwd": "/Users/name/.dilag/sessions/uuid-string"
    }
  ]
}
```

**opencode.json** - Created/updated on each launch with the designer agent configuration including the full system prompt for UI generation.

---

### LocalStorage

| Key | Store | Contents |
|-----|-------|----------|
| `dilag-session-store` | Zustand | `{currentSessionId, screenPositions}` |
| `dilag-model-store` | Zustand | `{selectedModel: {providerID, modelID}}` |
| `dilag-initial-prompt` | Temporary | Prompt passed from home to studio (cleared after use) |

**Session store schema:**
```json
{
  "currentSessionId": "uuid-string",
  "screenPositions": {
    "session-uuid": [
      { "id": "home-screen.html", "x": 100, "y": 100 },
      { "id": "profile.html", "x": 440, "y": 100 }
    ]
  }
}
```

**Model store schema:**
```json
{
  "selectedModel": {
    "providerID": "anthropic",
    "modelID": "claude-sonnet-4-20250514"
  }
}
```

---

### OpenCode Data (External)

OpenCode stores its own data separately:

| Path | Purpose |
|------|---------|
| `~/.local/share/opencode/` | Auth tokens, credentials |
| `~/.dilag/opencode/` | Config only (via XDG_CONFIG_HOME override) |

This separation allows Dilag to use isolated config while sharing auth across OpenCode installations.

---

## SSE Event System

### Connection Flow

```
GlobalEventsProvider mounts
    │
    ├── sdk.global.event()
    │   └── GET http://127.0.0.1:4096/events (SSE)
    │
    └── Async iterator processes events:
        │
        for await (const event of events.stream) {
            │
            ├── Notify global handlers (all subscribers)
            │   └── handlersRef.current.forEach(h => h(event))
            │
            └── Notify session-specific handlers
                └── sessionHandlersRef.current.get(sessionId)?.forEach(h => h(event))
        }
```

### Event Types

| Event | Trigger | Handler Action |
|-------|---------|----------------|
| `message.updated` | New/updated message | Add/update in Zustand `messages` |
| `message.part.updated` | Streaming content | Update in Zustand `parts` |
| `session.status` | Status change | Update `sessionStatus` |
| `session.diff` | File changes | Update `sessionDiffs` |
| `session.idle` | Processing complete | Set status to "idle" |
| `session.error` | Error occurred | Set status to "error" |

### Subscription Pattern

```typescript
// Global subscription (all events)
const unsubscribe = subscribe((event) => {
  handleEvent(event);
});

// Session-specific subscription
const unsubscribe = subscribeToSession(sessionId, (event) => {
  // Only receives events for this session
});
```

---

## Session Lifecycle

### Creation

```
User submits prompt on Home screen
    │
    ├── Save prompt to localStorage("dilag-initial-prompt")
    │
    ├── createSession()
    │   ├── Generate UUID
    │   ├── invoke("create_session_dir") → ~/.dilag/sessions/{uuid}/
    │   ├── sdk.session.create({ directory })
    │   ├── Save metadata to sessions.json
    │   └── Update Zustand state
    │
    └── Navigate to /studio/{sessionId}
        │
        └── Studio mounts
            ├── Read localStorage prompt
            ├── Clear localStorage
            └── sendMessage(prompt) after 500ms
```

### Message Flow

```
sendMessage(content)
    │
    ├── Set sessionStatus = "running"
    │
    ├── sdk.session.prompt({
    │     sessionID,
    │     directory,
    │     agent: "designer",
    │     model: { providerID, modelID },
    │     parts: [{ type: "text", text: content }]
    │   })
    │
    └── SSE events stream back:
        │
        ├── message.updated (user message created)
        ├── message.updated (assistant message created)
        ├── message.part.updated (text streaming)
        ├── message.part.updated (tool calls)
        │   └── write tool creates ~/.dilag/sessions/{id}/screens/*.html
        ├── session.status (running → idle)
        └── session.idle
```

### Design Detection

```
useSessionDesigns hook (polling every 2s)
    │
    └── invoke("load_session_designs", { sessionCwd })
        │
        └── Tauri scans:
            ├── {cwd}/*.html
            └── {cwd}/screens/*.html
                │
                └── For each HTML file:
                    ├── Extract data-title attribute
                    ├── Extract data-screen-type attribute
                    ├── Read file content
                    └── Return DesignFile object
        │
        └── Returns array sorted by modified_at (newest first)
```

### Deletion

```
User clicks delete on project card
    │
    ├── sdk.session.delete({ sessionID, directory })
    │
    ├── invoke("delete_session_metadata", { sessionId })
    │   ├── Remove from sessions.json
    │   └── Delete ~/.dilag/sessions/{id}/ directory
    │
    └── Clear Zustand state for session
```
