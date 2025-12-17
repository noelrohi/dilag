# Dilag Platform Documentation

Dilag is a Tauri-based desktop application for AI-powered mobile UI design. It integrates with OpenCode to provide an AI coding assistant that generates mobile screen designs through natural language prompts.

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [Screens & Navigation](#screens--navigation)
3. [Core Components](#core-components)
4. [State Management](#state-management)
5. [Data Flow & Logic](#data-flow--logic)
6. [Backend Integration](#backend-integration)
7. [Tool Registry](#tool-registry)

---

## Application Overview

**Tech Stack:**
- **Frontend:** React 18 + TypeScript + Vite
- **Desktop Runtime:** Tauri (Rust backend)
- **Routing:** TanStack Router (file-based)
- **State:** Zustand (client/real-time) + React Query (server state)
- **Styling:** Tailwind CSS + shadcn/ui components
- **AI Backend:** OpenCode SDK (SSE event streaming)

**Key Files:**
- `src/routes/index.lazy.tsx` - Home/Landing page
- `src/routes/studio.$sessionId.lazy.tsx` - Studio workspace
- `src/context/session-store.tsx` - Zustand store for real-time state
- `src/context/global-events.tsx` - SSE event provider
- `src/hooks/use-sessions.ts` - Session management hook

---

## Screens & Navigation

### 1. Home Screen (`/`)

**File:** `src/routes/index.lazy.tsx`

The landing page users see when launching the app.

**UI Elements:**
- **Header:** App name "dilag" (top-left), connection status indicator
- **Composer:** Centered prompt input with:
  - Textarea placeholder: "A dashboard for tracking daily habits..."
  - Model selector dropdown (Claude, GPT, Gemini, etc.)
  - Submit button (arrow icon, activates when text is entered)
- **Recent Projects:** Grid of up to 4 project cards showing:
  - Thumbnail previews of screens (horizontally scrollable)
  - Project title and date
  - Delete button (X) on hover

**Behavior:**
1. User types a design prompt in the composer
2. On submit:
   - Prompt is saved to `localStorage` key: `dilag-initial-prompt`
   - A new session is created via `createSession()`
   - Navigation to `/studio/$sessionId`
3. Clicking a project card navigates to its studio view
4. Delete button removes the session

---

### 2. Studio Screen (`/studio/$sessionId`)

**File:** `src/routes/studio.$sessionId.lazy.tsx`

The main workspace for designing and viewing screens.

**Layout:**
```
+------------------+----------------------------------------+
|  Home | Title    |                          Hide Chat    |
+------------------+----------------------------------------+
|                  |                                        |
|  Chat Pane       |         Design Canvas                  |
|  (360px width)   |         (remaining space)              |
|                  |                                        |
|  - Messages      |   [Screen 1]  [Screen 2]  [Screen 3]   |
|  - Tool outputs  |                                        |
|  - Composer      |                                        |
|                  |                                        |
+------------------+----------------------------------------+
                   |     [Zoom Controls: Reset | -/+ | %]   |
                   +----------------------------------------+
```

**Header Elements:**
- Home button (navigates to `/`)
- Session title
- Toggle button: "Hide Chat" / "Show Chat"

**Chat Pane (Left - 360px, collapsible):**
- Conversation area with user/assistant messages
- Each message displays parts (text, tools, reasoning)
- Thinking indicator during AI processing
- Composer at bottom with:
  - Model selector
  - Text input
  - Submit button (purple when active)

**Design Canvas (Right - flexible):**
- Dotted grid background
- Draggable mobile screen frames
- Pan: Click and drag on background, or scroll
- Zoom: Ctrl+scroll (25% to 200%)
- Control bar at bottom:
  - Reset view button
  - Fit to screen button
  - Zoom controls (-/+) with percentage display

**Screen Frames:**
- iPhone 14 frame (280x572px visual)
- Title bar with status indicator (generating/streaming/success/error)
- Grip handle for drag positioning
- Live HTML preview rendered in iframe

---

## Core Components

### UI Components (`src/components/ui/`)

shadcn/ui primitives built on Radix UI:
- `button.tsx` - Button with variants
- `card.tsx` - Container component
- `dialog.tsx` - Modal dialogs
- `dropdown-menu.tsx` - Dropdown menus
- `command.tsx` - Command palette
- `collapsible.tsx` - Collapsible sections
- `scroll-area.tsx` - Custom scrollbars
- `tooltip.tsx` - Hover tooltips

### Block Components (`src/components/blocks/`)

Composed page sections:
- `chat-view.tsx` - Full chat interface with messages and composer
- `design-canvas.tsx` - Zoomable, pannable canvas with DnD support
- `mobile-frame.tsx` - iPhone frame wrapper with status
- `screen-preview.tsx` - Iframe-based HTML preview
- `draggable-screen.tsx` - DnD wrapper for screens
- `message-part.tsx` - Renders different message part types
- `tool-part.tsx` - Collapsible tool call display

### AI Components (`src/components/ai-elements/`)

Chat and AI-specific components:
- `prompt-input.tsx` - Composable prompt input system
- `model-selector.tsx` - AI model selection dropdown
- `conversation.tsx` - Conversation container with scroll
- `message.tsx` - Message bubble with role styling
- `reasoning.tsx` - Collapsible reasoning display
- `shimmer.tsx` - Loading shimmer effect
- `tool.tsx` - Tool call visualization

---

## State Management

### Architecture

Hybrid approach following TkDodo/KCD patterns:
- **Zustand:** Client-only and real-time state
- **React Query:** Server state fetching and caching

### Zustand Store (`src/context/session-store.tsx`)

```typescript
interface SessionState {
  // Client state (persisted to localStorage)
  currentSessionId: string | null;
  screenPositions: Record<string, ScreenPosition[]>;

  // Real-time state (from SSE events)
  messages: Record<string, Message[]>;
  parts: Record<string, MessagePart[]>;
  sessionStatus: Record<string, SessionStatus>;
  sessionDiffs: Record<string, FileDiff[]>;

  // Server connection
  isServerReady: boolean;
  error: string | null;
}
```

**Key Selectors:**
- `useCurrentSessionId()` - Current session ID
- `useSessionMessages(sessionId)` - Messages for session
- `useMessageParts(messageId)` - Parts for a message
- `useSessionStatus(sessionId)` - Session status (idle/running/error)
- `useScreenPositions(sessionId)` - Canvas positions

### React Query Usage

- `useSessionsList()` - Fetch all sessions (from Tauri)
- `useSessionDesigns(cwd)` - Poll for design files (every 2s)
- `useProviderData()` - Fetch available AI models

### Model Store (`src/hooks/use-models.ts`)

Separate Zustand store for model selection:
```typescript
interface ModelState {
  selectedModel: { providerID: string; modelID: string } | null;
  setSelectedModel: (model) => void;
}
```
Default model: `anthropic/claude-sonnet-4-20250514`

---

## Data Flow & Logic

### Session Creation Flow

```
1. User enters prompt on Home screen
2. handleSubmit() called:
   - Save prompt to localStorage ("dilag-initial-prompt")
   - Call createSession() from useSessions hook
3. createSession():
   - Generate UUID for session directory
   - Create directory via Tauri: invoke("create_session_dir")
   - Create session in OpenCode: sdk.session.create({ directory })
   - Save session metadata to Tauri storage
   - Update Zustand: setCurrentSessionId, setMessages
4. Navigate to /studio/$sessionId
5. Studio page mounts:
   - useEffect reads localStorage for initial prompt
   - Clears localStorage
   - Calls sendMessage(initialPrompt) after 500ms delay
```

### Message Sending Flow

```
1. User enters prompt in chat composer
2. sendMessage(content) called:
   - Get selected model from store
   - Set session status to "running"
   - Call sdk.session.prompt({
       sessionID,
       directory,
       agent: "designer",
       model,
       parts: [{ type: "text", text: content }]
     })
3. SSE events stream back:
   - message.updated: Add/update message in Zustand
   - message.part.updated: Update message parts
   - session.status: Update running/idle/error
4. Parts render in real-time via useMessageParts(messageId)
5. On first message, update session title after 2s delay
```

### Design Detection Flow

```
1. AI generates HTML files in session directory
2. useSessionDesigns hook polls every 2s:
   - Calls invoke("load_session_designs", { sessionCwd })
   - Returns array of DesignFile objects
3. Studio receives updated designs array
4. New designs get initial canvas positions
5. Each design renders in MobileFrame with ScreenPreview
```

### SSE Event Handling

**Provider:** `src/context/global-events.tsx`

```
1. App mounts, GlobalEventsProvider initializes
2. Start OpenCode server: invoke("start_opencode_server")
3. Connect to SSE: sdk.global.event()
4. Process events in async for-loop
5. Dispatch to:
   - Global handlers (all subscribers)
   - Session-specific handlers (by sessionID)
6. useSessions subscribes and routes to handleEvent()
7. handleEvent updates Zustand based on event type
```

**Event Types Handled:**
- `message.part.updated` - Update part content/state
- `message.updated` - Add or update message
- `session.status` - Update session status
- `session.diff` - File diff information
- `session.idle` - Mark session as idle
- `session.error` - Mark session as error

---

## Backend Integration

### Tauri Commands (`src-tauri/src/lib.rs`)

```rust
#[tauri::command]
fn start_opencode_server() -> Result<u16, String>
// Starts the OpenCode server, returns port (4096)

#[tauri::command]
fn create_session_dir(dir_id: String) -> Result<String, String>
// Creates session directory, returns full path

#[tauri::command]
fn load_session_designs(session_cwd: String) -> Result<Vec<DesignFile>, String>
// Loads HTML design files from session's screens/ folder

#[tauri::command]
fn save_session_metadata(session: SessionMeta) -> Result<(), String>
// Saves session metadata to JSON

#[tauri::command]
fn load_sessions() -> Result<Vec<SessionMeta>, String>
// Loads all session metadata

#[tauri::command]
fn delete_session_metadata(session_id: String) -> Result<(), String>
// Deletes session metadata and directory
```

### OpenCode SDK Usage

**Client Creation:**
```typescript
const sdk = createOpencodeClient({
  baseUrl: "http://127.0.0.1:4096",
});
```

**API Methods:**
- `sdk.session.create({ directory })` - Create new session
- `sdk.session.get({ sessionID, directory })` - Get session details
- `sdk.session.delete({ sessionID, directory })` - Delete session
- `sdk.session.messages({ sessionID, directory })` - Get message history
- `sdk.session.prompt({ sessionID, directory, agent, model, parts })` - Send prompt
- `sdk.provider.list()` - Get available providers and models
- `sdk.global.event()` - SSE event stream

---

## Tool Registry

**File:** `src/lib/tool-registry.tsx`

Defines how OpenCode tools are displayed in the UI.

### Registered Tools

| Tool | Icon | Description |
|------|------|-------------|
| `read` | Glasses | File read - shows preview with syntax highlighting |
| `edit` | Code2 | File edit - shows diff with +/- counts |
| `write` | FilePlus2 | File create - shows content with line count |
| `bash` | Terminal | Shell command - shows command and output |
| `glob` | FolderSearch | File pattern search - shows match count |
| `grep` | Search | Content search - shows match count |
| `list` | FolderSearch | Directory listing - shows item count |
| `webfetch` | Globe | URL fetch - shows hostname and content |
| `task` | Bot | Sub-agent task - shows tool summary |
| `todowrite` | ListChecks | Todo list - shows completion progress |
| `theme` | Paintbrush | Theme generation - shows color swatches |

### Tool State

Each tool can be in one of these states:
- `pending` - Waiting to execute
- `running` - Currently executing (shows timer)
- `completed` - Finished successfully
- `error` - Failed with error message

### Tool Display

Tools render in `<ToolPart>` as collapsible rows:
- Header: Icon, title, subtitle (file path, counts), elapsed time
- Content: Expandable details (code preview, diff, output)
- `todowrite` expands by default

---

## File Structure Reference

```
src/
  components/
    ai-elements/       # AI/chat components
    blocks/            # Page section components
    ui/                # shadcn/ui primitives
  context/
    global-events.tsx  # SSE provider
    session-store.tsx  # Zustand store
  hooks/
    use-designs.ts     # Design file polling
    use-models.ts      # Model selection
    use-sessions.ts    # Session management
    use-session-data.ts # React Query data layer
  lib/
    tool-registry.tsx  # Tool display configs
    utils.ts           # cn() and utilities
  routes/
    __root.tsx         # Root layout
    index.lazy.tsx     # Home page
    studio.$sessionId.lazy.tsx # Studio page
```

---

## Key Interactions Summary

1. **Home -> Studio:** Prompt saved to localStorage, session created, navigate
2. **Studio Load:** Read localStorage prompt, trigger sendMessage
3. **Chat Submit:** SDK prompt call, SSE events update Zustand in real-time
4. **Design Updates:** 2s polling detects new HTML files, renders in canvas
5. **Canvas Drag:** DnD updates screen positions in Zustand (persisted)
6. **Model Switch:** Updates model store, affects next prompt call
7. **Session Switch:** Updates currentSessionId, loads messages from SDK
