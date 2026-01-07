# Dilag Architecture

Technical documentation covering app initialization, data flow, and storage.

---

## Table of Contents

1. [App Startup Flow](#app-startup-flow)
2. [Storage & Persistence](#storage--persistence)
3. [SSE Event System](#sse-event-system)
4. [Session Lifecycle](#session-lifecycle)
5. [Licensing System](#licensing-system)
6. [Native Menu & Updater](#native-menu--updater)
7. [State Management](#state-management)

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
        │   ├── LicenseProvider       ← Checks license status
        │   ├── LicenseGate           ← Blocks UI if unlicensed
        │   ├── GlobalEventsProvider  ← TRIGGERS BACKEND INIT
        │   ├── NotificationProvider  ← Audio alerts
        │   ├── UpdaterProvider       ← Auto-update checks
        │   ├── MenuEventsProvider    ← Listens to native menu events
        │   └── SidebarProvider
       │
       └── Also renders: UpdateDialog, Toaster, ReactQueryDevtools

5. GLOBAL EVENTS PROVIDER INITIALIZES
   └── global-events.tsx: GlobalEventsProvider()
       │
       ├── Reads dynamic port from window.__DILAG__.port (injected by Rust setup)
       │
       ├── Creates OpenCode SDK client (baseUrl: http://127.0.0.1:${port})
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
            │   │   └── Contains "designer" and "web-designer" agents with system prompts
            │   ├── Spawn: opencode serve --port ${port} --hostname 127.0.0.1

           │   │   └── With XDG_CONFIG_HOME=~/.dilag (isolated config)
           │   ├── Wait 500ms for server to start
           │   └── Return dynamic port
           │
           ├── setIsServerReady(true)
           │
           ├── Connect to SSE: sdk.global.event()
           │   └── Opens persistent connection to http://127.0.0.1:${port}/events
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
       │   ├── Spawn OpenCode server on dynamic port
       │   └── Return dynamic port
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
├── license.json                     # License/trial state (see Licensing System)
├── opencode/
│   └── opencode.json               # OpenCode config (build agent)
└── sessions/
    └── {session-uuid}/             # Per-session working directory (Vite + React project)
        ├── src/                    # React source code
        │   ├── routes/
        │   └── components/
        ├── package.json
        └── vite.config.ts
```

**Bundled Resources:**
The app bundles a Vite + React template in `src-tauri/templates/web-project/`, which is copied to the session directory when creating a new project.

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

**opencode.json** - Created/updated on each launch with the build agent configuration including the frontend-design skill for web app generation.

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
    ├── Read port from window.__DILAG__.port (injected by Rust)
    │
    ├── Create SDK client (http://127.0.0.1:${port})
    │
    ├── connectToSSE() with reconnection loop:
    │   │
    │   └── while (mounted):
    │       │
    │       ├── setConnectionStatus("connecting" | "reconnecting")
    │       │
    │       ├── sdk.global.event()
    │       │   └── GET http://127.0.0.1:${port}/events (SSE)
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
    │     agent: "build",
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
        │   └── edit/write tools modify ~/.dilag/sessions/{id}/src/*
        ├── session.status (running → idle)
        └── session.idle
```

### Live Preview

```
Vite Dev Server (per-session)
    │
    ├── Started via invoke("start_vite_server", { sessionCwd })
    │   └── Returns dynamic port number
    │
    ├── BrowserFrame embeds iframe pointing to http://localhost:{port}
    │
    └── File changes trigger HMR:
        │
        ├── AI writes/edits files in {cwd}/src/
        ├── Vite detects file change
        └── HMR updates preview instantly (no page reload)
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

## Licensing System

### Overview

Dilag uses Polar.sh for license management with a 7-day trial period and license key activation.

### License States

| Status | Description |
|--------|-------------|
| `NoLicense` | Fresh install, no trial started |
| `Trial` | Trial active, includes `days_remaining` |
| `TrialExpired` | Trial period ended |
| `Activated` | Valid license key activated |
| `RequiresValidation` | License needs revalidation (>7 days offline) |
| `Error` | Error state with message |

### State Machine

```
NoLicense
    │
    └── [start_trial] (requires internet for server time)
            │
            ▼
Trial (7 days) ─────────────────────────────┐
    │                                        │
    │ days elapse                            │ [activate_license]
    ▼                                        │
TrialExpired ───────────────────────────────┼──► Activated
                                             │       │
                                             │       │ [validate_license every 24h]
                                             │       │
                                             │       ▼
                                             │   Online: Stays Activated
                                             │   Offline <7 days: Stays Activated (grace)
                                             │   Offline >7 days: RequiresValidation
                                             │
RequiresValidation ◄────────────────────────┘
    │
    └── [validate_license] success → Activated
```

### Storage (`~/.dilag/license.json`)

```json
{
  "license_key": "string|null",
  "activation_id": "polar_activation_id",
  "device_id": "machine_uid",
  "trial_start_utc": 1700000000,
  "last_validated_at": 1700000100,
  "activated_at": 1700000050,
  "is_activated": true,
  "last_server_time_check": 1700000200
}
```

### Trial Clock Manipulation Prevention

To prevent users from extending trials by changing system clock:

1. **Start trial**: Fetches server time from `worldtimeapi.org` (fallback: HTTP Date header from cloudflare.com/google.com)
2. **Check trial**: Compares current server time to `trial_start_utc`
3. **Offline fallback**: Uses `max(local_time, last_server_time_check)` to prevent clock rollback

### License Validation Flow

```
LicenseProvider mounts
    │
    ├── invoke("get_license_status")
    │   └── Returns current status
    │
    ├── invoke("get_purchase_url")
    │   └── Returns Polar checkout URL
    │
    └── If Activated: Start 24-hour validation interval
        │
        └── Every 24h: invoke("validate_license")
            │
            ├── Polar API validates key
            │   └── Updates last_validated_at
            │
            └── On failure: Check grace periods
                ├── <3 days offline: Allow (normal grace)
                ├── <7 days offline: Allow (extended grace)
                └── >7 days offline: RequiresValidation
```

### Tauri Commands

| Command | Purpose |
|---------|---------|
| `get_license_status` | Check current license state |
| `start_trial` | Begin 7-day trial (fetches server time) |
| `activate_license` | Activate with Polar API |
| `validate_license` | Re-validate active license |
| `get_purchase_url` | Get Polar checkout URL |
| `reset_license` | Delete license.json (for debugging) |

### Web Design Commands (Vite)

| Command | Purpose |
|---------|---------|
| `start_vite_server` | Starts Vite dev server for a session |
| `stop_vite_server` | Stops the running Vite server |
| `get_vite_status` | Checks if Vite server is running |
| `get_vite_port` | Returns the port Vite is listening on |
| `initialize_web_project` | Copies web template to session directory |

### Provider Integration

The `LicenseProvider` wraps the app and gates access via `LicenseGate`:

```
LicenseProvider
    └── LicenseGate
        │
        ├── NoLicense → Shows activation modal (start trial or enter key)
        ├── Trial → Shows app with trial banner
        ├── TrialExpired → Shows activation modal
        ├── Activated → Shows app normally
        └── RequiresValidation → Shows validation prompt
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
  sessionErrors: Record<string, { name: string; message: string } | null>;

  // Connection state
  isServerReady: boolean;
  error: string | null;
  debugEvents: Event[];  // Last 500 SSE events for debugging
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

#### Design Mode Store (`design-mode-store.ts`)

```typescript
interface DesignModeState {
  webViewport: "desktop" | "tablet" | "mobile";
}
```

**Persistence:** Stored in `localStorage` as `dilag-design-mode`.
- **Viewport Sizes:** Desktop (1280×800), Tablet (768×1024), Mobile (390×844)

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
│  │ Tauri Commands      │    │ OpenCode Server (dynamic)   │ │
│  │                     │    │                             │ │
│  │ - sessions.json     │    │ - SDK API calls             │ │
│  │ - design files      │    │ - SSE event stream          │ │
│  │ - server lifecycle  │    │ - Session management        │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│                                                             │
│  Storage: ~/.dilag/                                         │
└─────────────────────────────────────────────────────────────┘
```
