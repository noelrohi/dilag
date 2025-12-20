# Dilag Architecture

Technical documentation covering app initialization, data flow, and storage.

---

## Table of Contents

1. [App Startup Flow](#app-startup-flow)
2. [Storage & Persistence](#storage--persistence)
3. [SSE Event System](#sse-event-system)
4. [Session Lifecycle](#session-lifecycle)
5. [Native Menu & Updater](#native-menu--updater)
6. [State Management](#state-management)

---

## App Startup Flow

### New User (First Launch)

```
1. TAURI BACKEND INITIALIZES
   └── lib.rs: run()
       ├── Registers plugins (shell, opener, updater, process)
       ├── Sets up native menu (App, File, Edit, View, Help)
       ├── Creates AppState { opencode_pid: None }
       ├── Creates main window with transparent title bar
       └── Registers all Tauri commands

2. REACT BOOTSTRAP (main.tsx)
   └── bootstrap() async function
       │
       ├── invoke("check_opencode_installation")
       │   │
       │   │   TAURI BACKEND searches for OpenCode in:
       │   ├── ~/.opencode/bin/opencode
       │   ├── ~/.npm-global/bin/opencode
       │   ├── ~/.bun/bin/opencode
       │   ├── /opt/homebrew/bin/opencode
       │   └── /usr/local/bin/opencode
       │
       ├── IF installed:
       │   └── Render full app with RouterProvider
       │
       └── IF NOT installed:
           └── Render SetupWizard
               ├── Shows installation instructions
               └── On complete: re-runs bootstrap()

3. ROUTER MOUNTS (if OpenCode installed)
   └── RouterProvider mounts __root.tsx

4. ROOT LAYOUT MOUNTS
   └── __root.tsx: RootLayout()
       ├── Creates QueryClient (React Query)
       │   └── Default: staleTime=1min, retry=1, no refetchOnWindowFocus
       │
       ├── Provider hierarchy (outer to inner):
       │   ├── ErrorBoundary
       │   ├── ThemeProvider (storageKey: "dilag-theme")
       │   ├── QueryClientProvider
       │   ├── GlobalEventsProvider  ← TRIGGERS BACKEND INIT
       │   ├── MenuEventsProvider    ← Listens to native menu events
       │   └── SidebarProvider
       │
       └── Also renders: UpdateDialog, Toaster, ReactQueryDevtools

5. GLOBAL EVENTS PROVIDER INITIALIZES
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

6. HOME PAGE LOADS
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

7. UI RENDERS
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
1-4. SAME AS NEW USER (OpenCode already installed)

5. GLOBAL EVENTS PROVIDER INITIALIZES
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
       └── setConnectionStatus("connected")

6. HOME PAGE LOADS
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

7. ZUSTAND HYDRATES FROM LOCALSTORAGE
   └── Restores persisted state:
       ├── currentSessionId (last selected)
       ├── screenPositions (canvas positions per session)
       └── selectedModel (from dilag-model-store)

8. UI RENDERS
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
| `dilag-initial-files` | Temporary | File attachments (JSON array) passed from home to studio |
| `dilag-theme` | ThemeProvider | `"dark" \| "light" \| "system"` |

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
    "providerID": "opencode",
    "modelID": "big-pickle"
  }
}
```

Default is `opencode/big-pickle` (free tier model).

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
    ├── Create SDK client (http://127.0.0.1:4096)
    │
    ├── connectToSSE() with reconnection loop:
    │   │
    │   └── while (mounted):
    │       │
    │       ├── setConnectionStatus("connecting" | "reconnecting")
    │       │
    │       ├── sdk.global.event()
    │       │   └── GET http://127.0.0.1:4096/events (SSE)
    │       │
    │       ├── On success:
    │       │   ├── Reset attempt counter
    │       │   ├── setConnectionStatus("connected")
    │       │   └── If reconnection: trigger bootstrap()
    │       │
    │       ├── Process event stream:
    │       │   for await (const event of events.stream) {
    │       │       ├── Notify global handlers
    │       │       └── Notify session-specific handlers
    │       │   }
    │       │
    │       └── On disconnect/error:
    │           ├── Exponential backoff: 3s → 6s → 12s → ... → 30s max
    │           └── Retry indefinitely
```

### Connection States

| State | Description |
|-------|-------------|
| `disconnected` | No connection, not attempting |
| `connecting` | First connection attempt |
| `connected` | Active SSE stream |
| `reconnecting` | Lost connection, retrying |

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

---

## Native Menu & Updater

### Menu Events Flow

```
Rust backend defines native menu (lib.rs: setup_menu())
    │
    ├── App menu: About, Settings (Cmd+,), Check Updates, Quit
    ├── File menu: New Session (Cmd+N), Close Window
    ├── Edit menu: Standard clipboard operations
    ├── View menu: Toggle Sidebar (Cmd+B), Toggle Chat (Cmd+\), Fullscreen
    └── Help menu: Docs, GitHub, Report Issue
        │
        └── Menu item clicked
            │
            ├── on_menu_event handler (lib.rs)
            │   └── app.emit("menu-event", event_id)
            │
            └── MenuEventsProvider (menu-events.tsx)
                │
                ├── listen("menu-event")
                │
                └── Switch on event_id:
                    ├── "settings" → navigate("/settings")
                    ├── "new-session" → createSession() + navigate to studio
                    ├── "toggle-sidebar" → callback from registered component
                    ├── "toggle-chat" → callback from registered component
                    └── "check-updates" → checkForUpdates()
```

### Updater Flow

```
UpdaterProvider mounts
    │
    └── useEffect (3s delay)
        │
        └── checkForUpdates(silent=true)
            │
            ├── check() from @tauri-apps/plugin-updater
            │
            ├── IF update available:
            │   ├── Show toast with "Update Now" action
            │   └── Set updateInfo state
            │
            └── IF no update: silent (no toast on auto-check)

User clicks "Update Now" (toast or Settings)
    │
    └── installUpdate()
        │
        ├── update.downloadAndInstall()
        │   └── Progress events update downloadProgress state
        │
        └── relaunch() from @tauri-apps/plugin-process
```

### Theme Synchronization (macOS)

```
ThemeProvider detects theme change
    │
    ├── Apply "dark" or "light" class to document.documentElement
    │
    └── invoke("set_titlebar_theme", { isDark })
        │
        └── Tauri command (lib.rs: set_titlebar_theme)
            │
            └── objc2 API to set NSWindow backgroundColor
                ├── Dark: oklch(0.14 0.01 250) → rgb(31, 32, 40)
                └── Light: oklch(0.975 0.008 75) → rgb(247, 245, 242)
```

This ensures the native macOS titlebar (transparent style) matches the app's theme.

---

## State Management

Dilag uses a hybrid approach (TkDodo/KCD pattern):
- **React Query**: Server state (sessions list, provider data)
- **Zustand**: Client state (UI preferences) and real-time state (SSE data)

### Zustand Stores

#### Session Store (`session-store.tsx`)

```typescript
interface SessionState {
  // Persisted (localStorage: dilag-session-store)
  currentSessionId: string | null;
  screenPositions: Record<string, ScreenPosition[]>;

  // Real-time (from SSE, not persisted)
  messages: Record<string, Message[]>;      // sessionId → messages
  parts: Record<string, MessagePart[]>;     // messageId → parts
  sessionStatus: Record<string, SessionStatus>;
  sessionDiffs: Record<string, FileDiff[]>;

  // Connection state
  isServerReady: boolean;
  error: string | null;
}
```

**Persistence:** Only `currentSessionId` and `screenPositions` are persisted.
Real-time data is cleared on page reload and refetched via SSE.

#### Model Store (`use-models.ts`)

```typescript
interface ModelState {
  selectedModel: { providerID: string; modelID: string } | null;
}
```

**Persistence:** Stored in `localStorage` as `dilag-model-store`.
Default: `{ providerID: "opencode", modelID: "big-pickle" }`

### React Query Keys

```typescript
// Sessions
sessionKeys.all      // ["sessions"]
sessionKeys.list()   // ["sessions", "list"]
sessionKeys.detail(id) // ["sessions", "detail", id]

// Designs
designKeys.all       // ["designs"]
designKeys.session(cwd) // ["designs", "session", cwd]

// Models/Providers
modelKeys.all        // ["models"]
modelKeys.providers() // ["models", "providers"]
```

### Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                        │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐ │
│  │ React Query │    │   Zustand   │    │  localStorage   │ │
│  │             │    │             │    │                 │ │
│  │ - sessions  │◄───│ - messages  │───►│ - session-store │ │
│  │ - providers │    │ - parts     │    │ - model-store   │ │
│  │ - designs   │    │ - status    │    │ - theme         │ │
│  └──────┬──────┘    └──────▲──────┘    └─────────────────┘ │
│         │                  │                                │
│         │ invoke()         │ SSE events                     │
└─────────┼──────────────────┼────────────────────────────────┘
          │                  │
          ▼                  │
┌─────────────────────────────────────────────────────────────┐
│                   TAURI (Rust Backend)                      │
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │ Tauri Commands      │    │ OpenCode Server (port 4096) │ │
│  │                     │    │                             │ │
│  │ - sessions.json     │    │ - SDK API calls             │ │
│  │ - design files      │    │ - SSE event stream          │ │
│  │ - server lifecycle  │    │ - Session management        │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│                                                             │
│  Storage: ~/.dilag/                                         │
└─────────────────────────────────────────────────────────────┘
```
