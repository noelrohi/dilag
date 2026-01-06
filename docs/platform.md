# Dilag Platform Documentation

> Dilag is an AI-powered design studio built as a native desktop app. It leverages OpenCode's AI coding capabilities to transform natural language prompts into production-ready UI designs. It supports two main modes: **Mobile Mode** (iPhone frames on an infinite canvas) and **Web Mode** (full Vite-powered web project with live preview).

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [Visual Sitemap](#visual-sitemap)
3. [Screens & Navigation](#screens--navigation)
4. [Core Components](#core-components)
5. [State Management](#state-management)
6. [Data Flow & Logic](#data-flow--logic)
7. [Backend Integration](#backend-integration)
8. [Tool Registry](#tool-registry)

---

## Application Overview

### Tech Stack at a Glance

```
+---------------------------------------------------------------------+
|                        PRESENTATION LAYER                            |
+---------------------------------------------------------------------+
|  React 19        |  Tailwind CSS v4    |  Radix UI / shadcn        |
|  TanStack Router |  Motion (Framer)    |  Lucide + Phosphor Icons  |
+---------------------------------------------------------------------+
|                         STATE LAYER                                  |
+---------------------------------------------------------------------+
|  Zustand         |  React Query        |  Immer (immutable)        |
|  (real-time)     |  (server state)     |  (state updates)          |
+---------------------------------------------------------------------+
|                        RUNTIME LAYER                                 |
+---------------------------------------------------------------------+
|  Vite 7          |  Tauri 2            |  OpenCode SDK             |
|  (bundler)       |  (desktop runtime)  |  (AI backend via SSE)     |
+---------------------------------------------------------------------+
```

### Key Files Map

```
dilag/
|
+-- src/
|   +-- main.tsx -------------------- Application entry point (bootstrap)
|   +-- router.tsx ------------------ TanStack Router configuration
|   |
|   +-- routes/
|   |   +-- __root.tsx -------------- Root layout (providers, sidebar)
|   |   +-- index.tsx --------------- Home/Landing screen
|   |   +-- studio.$sessionId.tsx --- Studio workspace
|   |   +-- projects.tsx ------------ All projects view
|   |   +-- settings.tsx ------------ Settings page
|   |
|   +-- components/
|   |   +-- ui/ --------------------- Base UI primitives (shadcn/ui)
|   |   +-- blocks/ ----------------- Composed page sections
|   |   +-- ai-elements/ ------------ AI/chat-specific components
|   |
|   +-- context/
|   |   +-- session-store.tsx ------- Zustand store for real-time state
|   |   +-- design-mode-store.ts ---- Design mode (mobile/web) state
|   |   +-- global-events.tsx ------- SSE event provider & SDK client
|   |   +-- menu-events.tsx --------- Native menu event handlers
|   |   +-- updater-context.tsx ----- App auto-update provider
|   |
|   +-- hooks/
|   |   +-- use-sessions.ts --------- Main session management hook
|   |   +-- use-designs.ts ---------- Design file polling hook
|   |   +-- use-models.ts ----------- AI model selection hook
|   |   +-- use-session-data.ts ----- React Query data layer
|   |   +-- use-mobile.ts ----------- Mobile viewport detection hook
|   |
|   +-- lib/
|       +-- tool-registry.tsx ------- Tool display configurations
|       +-- utils.ts ---------------- cn() and utility functions
|
+-- src-tauri/
    +-- src/lib.rs ------------------ Rust backend commands & agent config
    +-- tauri.conf.json ------------- Tauri configuration
```

---

## Visual Sitemap

### Application Navigation Structure

```
                                    +---------------+
                                    |   main.tsx    |
                                    |  (Bootstrap)  |
                                    +-------+-------+
                                            |
                            +---------------+---------------+
                            |                               |
                            v                               v
                    +---------------+               +---------------+
                    | OpenCode OK?  |               | SetupWizard   |
                    |     Yes       |               | (Not Installed)|
                    +-------+-------+               +---------------+
                            |
                            v
                    +---------------+
                    |  __root.tsx   |
                    | (RootLayout)  |
                    +-------+-------+
                            |
        +-------------------+-------------------+-------------------+
        |                   |                   |                   |
        v                   v                   v                   v
+---------------+   +---------------+   +---------------+   +---------------+
|   /           |   | /studio/:id   |   | /projects     |   | /settings     |
|   Home        |   | Studio        |   | All Projects  |   | Settings      |
+---------------+   +---------------+   +---------------+   +---------------+
```

### User Journey Overview

```
+-------------------------------------------------------------------------+
|                           USER JOURNEY                                   |
+-------------------------------------------------------------------------+
|                                                                          |
|   +-----------+      +-----------+      +-----------+      +-----------+ |
|   |   App     |      |  OpenCode |      |   Home    |      |  Studio   | |
|   |  Launch   | ---> |   Check   | ---> |  Screen   | ---> | Workspace | |
|   +-----------+      +-----------+      +-----------+      +-----------+ |
|        |                   |                  |                  |       |
|        |                   |                  |                  v       |
|        |                   v                  |           +-----------+  |
|        |           +-----------+              |           |  Design   |  |
|        |           |  Setup    |              |           |  Canvas   |  |
|        |           |  Wizard   |              |           +-----------+  |
|        |           +-----------+              |                  |       |
|        |                                      |                  v       |
|        |                                      |           +-----------+  |
|        +---- (returning user) --------------->+           | Generated |  |
|                                                           |  Screens  |  |
|                                                           +-----------+  |
|                                                                          |
+-------------------------------------------------------------------------+
```

---

## Screens & Navigation

### Screen Overview Table

| # | Screen | Route | File | Purpose |
|---|--------|-------|------|---------|
| 1 | Home | `/` | `routes/index.tsx` | Landing page with prompt composer and recent projects |
| 2 | Studio | `/studio/$sessionId` | `routes/studio.$sessionId.tsx` | Main design workspace with chat and canvas |
| 3 | Projects | `/projects` | `routes/projects.tsx` | Browse all projects with search and filtering |
| 4 | Settings | `/settings` | `routes/settings.tsx` | App configuration, theme, model selection, updates |
| 5 | Setup Wizard | (modal) | `blocks/setup-wizard.tsx` | OpenCode installation check/guidance |

---

### 1. Home Screen (`/`)

**File:** `src/routes/index.tsx`

> The landing page presents a clean, focused interface for starting new design sessions. Users enter natural language prompts describing their app idea, select an AI model, and are taken directly to the studio workspace. Recent projects appear at the bottom for quick access.

#### Visual Layout

```
+-------------------------------------------------------------------------+
|  +-----------------------------------------------------------------+    |
|  |                      TITLE BAR (drag region)                     |    |
|  |                                         [connection status]      |    |
|  +-----------------------------------------------------------------+    |
|                                                                          |
|                                                                          |
|                                                                          |
|                   +-------------------------------------+                 |
|                   |                                     |                 |
|                   |     "What would you like           |                 |
|                   |           to design?"               |                 |
|                   |                                     |                 |
|                   +-------------------------------------+                 |
|                                                                          |
|                   +-------------------------------------+                 |
|                   |  +-------------------------------+  |                 |
|                   |  |   Describe your app idea...   |  |                 |
|                   |  |                               |  |                 |
|                   |  |                               |  |                 |
|                   |  +-------------------------------+  |                 |
|                   |  [+] [attachment]      [Model v] [>]|                 |
|                   +-------------------------------------+                 |
|                                                                          |
|                                                                          |
|  +-- Recent projects -----------------------------------------------+    |
|  |                                                           [View all]  |
|  |  +-------------+  +-------------+  +-------------+  +-------------+   |
|  |  | [thumbnails]|  | [thumbnails]|  | [thumbnails]|  | [thumbnails]|   |
|  |  | Project 1   |  | Project 2   |  | Project 3   |  | Project 4   |   |
|  |  | Today     [x]| | Yesterday [x]| | 3 days ago[x]| | Last week[x]|   |
|  |  +-------------+  +-------------+  +-------------+  +-------------+   |
|  +-------------------------------------------------------------------+   |
+-------------------------------------------------------------------------+
```

#### UI Components Breakdown

| Section | Component | Description |
|---------|-----------|-------------|
| Title Bar | Native Tauri | macOS transparent title bar with drag region |
| Hero | Typography | Animated heading with gradient text |
| Composer | `<PromptInput>` | Multi-line input with attachment support |
| Model Selector | `<ModelSelector>` | Dropdown for Claude/GPT/Gemini selection |
| Submit | `<Button>` | Purple arrow button, enabled when input present |
| Projects Grid | `<ProjectCard>` | Clickable cards with screen thumbnails |

#### User Interactions

```
+-------------------------------------------------------------------------+
|                        INTERACTION FLOW                                  |
+-------------------------------------------------------------------------+
|                                                                          |
|  [User Types Prompt]                                                     |
|       |                                                                  |
|       v                                                                  |
|  +-----------------+     +-----------------+     +-----------------+     |
|  | Submit Button   | --> | Save to         | --> | Create Session  |     |
|  | Activates       |     | localStorage    |     | via SDK         |     |
|  +-----------------+     +-----------------+     +-----------------+     |
|                                                         |                |
|                                                         v                |
|                                                  +-----------------+     |
|                                                  | Navigate to     |     |
|                                                  | /studio/:id     |     |
|                                                  +-----------------+     |
|                                                                          |
|  [User Clicks Project Card]                                              |
|       |                                                                  |
|       v                                                                  |
|  +-----------------+                                                     |
|  | Navigate to     |                                                     |
|  | /studio/:id     |                                                     |
|  +-----------------+                                                     |
|                                                                          |
|  [User Clicks Delete (X)]                                                |
|       |                                                                  |
|       v                                                                  |
|  +-----------------+     +-----------------+                             |
|  | Confirm Delete  | --> | Remove Session  |                             |
|  | (immediate)     |     | from Tauri + RQ |                             |
|  +-----------------+     +-----------------+                             |
|                                                                          |
+-------------------------------------------------------------------------+
```

**Detailed Behaviors:**

1. **Prompt Submission:** When user enters text and clicks submit:
   - Saves prompt to `localStorage` key `dilag-initial-prompt`
   - Optionally saves attachments to `dilag-initial-files`
   - Calls `createSession()` which creates a Tauri directory + OpenCode session
   - Navigates to `/studio/$sessionId`
   - Triggers: `handleSubmit()` in `index.tsx:41`

2. **Model Selection:** User can pick from available AI models:
   - Models fetched via `useModels()` hook
   - Selection persisted in Zustand `useModelStore`
   - Grouped by provider (Anthropic, Google, OpenAI)

3. **Project Card Click:** Opens existing session in studio workspace
   - Triggers: `handleOpenProject()` in `index.tsx:55`

---

### 2. Studio Screen (`/studio/$sessionId`)

**File:** `src/routes/studio.$sessionId.tsx`

> The studio is the main workspace where design happens. A collapsible chat pane on the left handles conversation with the AI. On the right, the interface adapts based on the active **Design Mode**:
> - **Mobile Mode**: An infinite canvas displays generated screens as draggable iPhone frames.
> - **Web Mode**: A browser frame renders a live Vite dev server preview of a React web project.

#### Visual Layout

```
+-------------------------------------------------------------------------+
|  +-----------------------------------------------------------------+    |
|  |[<] [Chat Toggle] Session Title                                   |    |
|  +-----------------------------------------------------------------+    |
|  +---------------+ +-----------------------------------------------+    |
|  |               | |                                               |    |
|  |  CHAT PANE    | |              DESIGN CANVAS                    |    |
|  |  (360px)      | |              (flex-1)                         |    |
|  |               | |                                               |    |
|  | +----------+  | |    +--------+   +--------+   +--------+      |    |
|  | | User     |  | |    |iPhone  |   |iPhone  |   |iPhone  |      |    |
|  | | Message  |  | |    |Frame 1 |   |Frame 2 |   |Frame 3 |      |    |
|  | +----------+  | |    |        |   |        |   |        |      |    |
|  |               | |    |[HTML   |   |[HTML   |   |[HTML   |      |    |
|  | +----------+  | |    |Preview]|   |Preview]|   |Preview]|      |    |
|  | |*Thinking*|  | |    |        |   |        |   |        |      |    |
|  | |Assistant |  | |    +--------+   +--------+   +--------+      |    |
|  | |Response  |  | |                                               |    |
|  | |[tools]   |  | |              . . . . . . . . . . . .         |    |
|  | +----------+  | |              . . . . . . . . . . . .         |    |
|  |               | |              . . . . . . . . . . . .         |    |
|  | +----------+  | |                                               |    |
|  | |Composer  |  | | +-------------------------------------------+ |    |
|  | |[+][Model][>]| | | [Reset] [Fit]  | [-] 75% [+] | Drag/Zoom  | |    |
|  | +----------+  | | +-------------------------------------------+ |    |
|  +---------------+ +-----------------------------------------------+    |
+-------------------------------------------------------------------------+
```

#### UI Components Breakdown

| Section | Component | Description |
|---------|-----------|-------------|
| Title Bar | `<div data-tauri-drag-region>` | Session title + chat toggle button |
| Chat Pane | `<ChatView>` | Collapsible 360px pane with messages |
| Messages | `<Message>` | User/assistant message bubbles |
| Tool Display | `<MessagePart>` + `<ToolPart>` | Collapsible tool call details |
| Composer | `<PromptInput>` | Input with model selector |
| Canvas | `<DesignCanvas>` | DnD-enabled infinite canvas (Mobile Mode) |
| Browser Frame | `<BrowserFrame>` | Iframe with Vite dev server preview (Web Mode) |
| Screen Frames | `<DraggableScreen>` + `<MobileFrame>` | iPhone frames with live previews (Mobile Mode) |
| Controls | Canvas toolbar | Zoom (25%-200%), pan, reset |

#### User Interactions

```
+-------------------------------------------------------------------------+
|                        CHAT INTERACTION FLOW                             |
+-------------------------------------------------------------------------+
|                                                                          |
|   User enters prompt                                                     |
|        |                                                                 |
|        v                                                                 |
|   +----------------+     +----------------+     +----------------+       |
|   | sendMessage()  | --> | Set status     | --> | SDK prompt     |       |
|   | from hook      |     | to "running"   |     | fire & forget  |       |
|   +----------------+     +----------------+     +----------------+       |
|                                                        |                 |
|                                                        v                 |
|   +----------------+     +----------------+     +----------------+       |
|   | message.updated| <-- | SSE events     | <-- | OpenCode       |       |
|   | message.part   |     | stream back    |     | processes      |       |
|   +----------------+     +----------------+     +----------------+       |
|          |                                                               |
|          v                                                               |
|   +----------------+     +----------------+                              |
|   | Zustand store  | --> | React re-render|                              |
|   | updates        |     | messages       |                              |
|   +----------------+     +----------------+                              |
|                                                                          |
+-------------------------------------------------------------------------+

+-------------------------------------------------------------------------+
|                        CANVAS INTERACTION FLOW                           |
+-------------------------------------------------------------------------+
|                                                                          |
|   [Drag Screen]                                                          |
|        |                                                                 |
|        v                                                                 |
|   +----------------+     +----------------+     +----------------+       |
|   | DnD sensors    | --> | Calculate new  | --> | Update Zustand |       |
|   | detect move    |     | position/zoom  |     | screenPositions|       |
|   +----------------+     +----------------+     +----------------+       |
|                                                                          |
|   [Ctrl + Scroll]                                                        |
|        |                                                                 |
|        v                                                                 |
|   +----------------+     +----------------+                              |
|   | Update zoom    | --> | Re-render      |                              |
|   | (0.25 - 2.0)   |     | canvas scale   |                              |
|   +----------------+     +----------------+                              |
|                                                                          |
|   [Pan (drag background)]                                                |
|        |                                                                 |
|        v                                                                 |
|   +----------------+     +----------------+                              |
|   | Update         | --> | Translate      |                              |
|   | viewOffset     |     | canvas origin  |                              |
|   +----------------+     +----------------+                              |
|                                                                          |
+-------------------------------------------------------------------------+
```

**Detailed Behaviors:**

1. **Initial Prompt:** On mount, reads `dilag-initial-prompt` from localStorage, sends it via `sendMessage()` after 500ms delay, then clears localStorage
   - Triggers: `useEffect` in `studio.$sessionId.tsx:54`

2. **Chat Toggle:** Button toggles 360px chat pane visibility
   - Chat width animates via CSS transition

3. **Message Streaming:** Parts appear in real-time as SSE events arrive
   - Thinking indicator shows when streaming with no parts yet

4. **Design Detection:** `useDesigns()` polls every 2 seconds for new HTML files
   - New screens automatically get initial canvas positions

---

### 3. Projects Screen (`/projects`)

**File:** `src/routes/projects.tsx`

> A comprehensive view of all design projects, organized by time period with search and sorting capabilities. Provides a gallery-style overview of all work.

#### Visual Layout

```
+-------------------------------------------------------------------------+
|  +-----------------------------------------------------------------+    |
|  |                      TITLE BAR (drag region)                     |    |
|  +-----------------------------------------------------------------+    |
|                                                                          |
|     All projects                                                         |
|     X projects total                                                     |
|                                                                          |
|     +---------------------------+  +------------------+                  |
|     | [Search icon] Search...   |  | [Recent] [Name]  |                  |
|     +---------------------------+  +------------------+                  |
|                                                                          |
|     -- Today --------------------------------------------------------    |
|     +-------------+  +-------------+  +-------------+  +-------------+   |
|     | [thumbnails]|  | [thumbnails]|  |             |  |             |   |
|     | Project A   |  | Project B   |  |             |  |             |   |
|     | Today     [x]| | Today     [x]| |             |  |             |   |
|     +-------------+  +-------------+  +-------------+  +-------------+   |
|                                                                          |
|     -- Yesterday ----------------------------------------------------    |
|     +-------------+  +-------------+  +-------------+  +-------------+   |
|     | [thumbnails]|  |             |  |             |  |             |   |
|     | Project C   |  |             |  |             |  |             |   |
|     | Yesterday [x]| |             |  |             |  |             |   |
|     +-------------+  +-------------+  +-------------+  +-------------+   |
|                                                                          |
|     -- Last 7 days --------------------------------------------------    |
|     ...                                                                  |
|                                                                          |
+-------------------------------------------------------------------------+
```

#### User Interactions

1. **Search:** Filters projects by name (real-time)
2. **Sort Toggle:** Switch between "Recent" (grouped by time) and "Name" (alphabetical)
3. **Project Click:** Navigate to studio workspace
4. **Delete:** Remove project with immediate feedback

---

### 4. Settings Screen (`/settings`)

**File:** `src/routes/settings.tsx`

> Application settings organized into clear sections for appearance, AI model configuration, data management, and app information including update controls.

#### Visual Layout

```
+-------------------------------------------------------------------------+
|  +-----------------------------------------------------------------+    |
|  |                      TITLE BAR (drag region)                     |    |
|  +-----------------------------------------------------------------+    |
|                                                                          |
|     APPEARANCE                                                           |
|     +---------------------------------------------------------------+   |
|     | Theme                                                          |   |
|     | Choose your preferred color scheme                             |   |
|     |                                                                |   |
|     | +----------+  +----------+  +----------+                       |   |
|     | |   Light  |  |   Dark   |  |  System  |                       |   |
|     | +----------+  +----------+  +----------+                       |   |
|     +---------------------------------------------------------------+   |
|                                                                          |
|     DESIGN MODE                                                          |
|     +---------------------------------------------------------------+   |
|     | Default Mode                                                   |   |
|     | Choose between mobile and web design                          |   |
|     |                                                                |   |
|     | +------------+  +------------+                                 |   |
|     | |   Mobile   |  |     Web    |                                 |   |
|     | +------------+  +------------+                                 |   |
|     +---------------------------------------------------------------+   |
|                                                                          |
|     MODEL                                                                |
|     +---------------------------------------------------------------+   |
|     | Default Model                   +------------------------+     |   |
|     | Used when starting new sessions | [logo] Claude Sonnet v |     |   |
|     |                                 +------------------------+     |   |
|     +---------------------------------------------------------------+   |
|                                                                          |
|     DATA                                                                 |
|     +---------------------------------------------------------------+   |
|     | Storage Location               ~/.dilag                        |   |
|     | Storage Used                   12.4 MB                         |   |
|     | +------------------+                                           |   |
|     | | Reset All Data   |   Deletes all sessions, designs, settings |   |
|     | +------------------+                                           |   |
|     +---------------------------------------------------------------+   |
|                                                                          |
|     ABOUT                                                                |
|     +---------------------------------------------------------------+   |
|     | Version                         0.2.0                          |   |
|     | Updates           +------------------------+                   |   |
|     |                   | Check for Updates      |                   |   |
|     |                   +------------------------+                   |   |
|     | +----------+  +----------------+                               |   |
|     | | GitHub   |  | Documentation  |                               |   |
|     | +----------+  +----------------+                               |   |
|     +---------------------------------------------------------------+   |
|                                                                          |
+-------------------------------------------------------------------------+
```

#### User Interactions

1. **Theme Selection:** Click Light/Dark/System buttons
2. **Model Selection:** Opens model picker dropdown
3. **Reset Data:** Opens confirmation dialog, resets and restarts app
4. **Check Updates:** Queries Tauri updater plugin
5. **External Links:** Open GitHub/docs via `openUrl()`

---

## Core Components

### Component Architecture Overview

```
+-------------------------------------------------------------------------+
|                        COMPONENT HIERARCHY                               |
+-------------------------------------------------------------------------+
|                                                                          |
|                           +---------------+                              |
|                           |   main.tsx    |                              |
|                           |  (Bootstrap)  |                              |
|                           +-------+-------+                              |
|                                   |                                      |
|                                   v                                      |
|                           +---------------+                              |
|                           |  __root.tsx   |                              |
|                           |  (Providers)  |                              |
|                           +-------+-------+                              |
|                                   |                                      |
|              +--------------------+--------------------+                 |
|              |                    |                    |                 |
|              v                    v                    v                 |
|       +------------+       +------------+       +------------+           |
|       | AppSidebar |       | SidebarInset|      | Toaster    |           |
|       +------------+       +------+------+       +------------+           |
|                                   |                                      |
|                            +------+------+                               |
|                            |   Outlet    |                               |
|                            | (Routes)    |                               |
|                            +------+------+                               |
|                                   |                                      |
|       +---------------+-----------+-----------+---------------+          |
|       |               |                       |               |          |
|       v               v                       v               v          |
|  +----------+   +----------+           +----------+     +----------+    |
|  | Home     |   | Studio   |           | Projects |     | Settings |    |
|  | (index)  |   | (studio) |           |          |     |          |    |
|  +----+-----+   +----+-----+           +----------+     +----------+    |
|       |              |                                                   |
|       v              v                                                   |
|  +---------+    +---------+    +---------+                              |
|  |Prompt   |    |ChatView |    |Design   |                              |
|  |Input    |    |         |    |Canvas   |                              |
|  +---------+    +---------+    +---------+                              |
|       |              |              |                                    |
|       v              v              v                                    |
|   [UI Primitives: Button, Input, Card, Dialog, etc.]                     |
|                                                                          |
+-------------------------------------------------------------------------+
```

### UI Primitives (`src/components/ui/`)

> Base-level, atomic components from shadcn/ui built on Radix UI primitives.

| Component | File | Props | Description |
|-----------|------|-------|-------------|
| `Button` | `button.tsx` | `variant`, `size` | Primary action trigger with variants (default, outline, ghost, destructive) |
| `Input` | `input.tsx` | `type`, `placeholder` | Text input field with border styling |
| `Card` | `card.tsx` | `children` | Container with header, content, footer slots |
| `Dialog` | `dialog.tsx` | `open`, `onOpenChange` | Modal overlay dialog |
| `DropdownMenu` | `dropdown-menu.tsx` | `children` | Popover menu with items |
| `ScrollArea` | `scroll-area.tsx` | `className` | Custom scrollbar wrapper |
| `Select` | `select.tsx` | `value`, `onValueChange` | Dropdown selection |
| `Sidebar` | `sidebar.tsx` | `collapsible` | Collapsible navigation sidebar |
| `Tooltip` | `tooltip.tsx` | `content` | Hover information tooltip |
| `Tabs` | `tabs.tsx` | `value`, `onValueChange` | Tab panel switcher |
| `Collapsible` | `collapsible.tsx` | `open`, `onOpenChange` | Expandable content section |
| `Badge` | `badge.tsx` | `variant` | Small label/tag component |

### Block Components (`src/components/blocks/`)

> Composed components that combine UI primitives into reusable page sections.

```
+-------------------------------------------------------------------------+
|  BLOCK: ChatView                                                         |
|  File: src/components/blocks/chat-view.tsx                              |
+-------------------------------------------------------------------------+
|                                                                          |
|  +-------------------------------------------------------------------+  |
|  |  +--------------------------------------------------------------+ |  |
|  |  |  CONVERSATION AREA (scrollable)                              | |  |
|  |  |                                                              | |  |
|  |  |  +----------------------------------------------------------+| |  |
|  |  |  | User Message                                             || |  |
|  |  |  | "Design a fitness tracking app"                          || |  |
|  |  |  +----------------------------------------------------------+| |  |
|  |  |                                                              | |  |
|  |  |  +----------------------------------------------------------+| |  |
|  |  |  | [Sparkles] Assistant                                     || |  |
|  |  |  | [Tool: write screens/home.html]                          || |  |
|  |  |  | [Tool: write screens/workout.html]                       || |  |
|  |  |  | "I've created two screens for your fitness app..."       || |  |
|  |  |  +----------------------------------------------------------+| |  |
|  |  +--------------------------------------------------------------+ |  |
|  |                                                                   |  |
|  |  +--------------------------------------------------------------+ |  |
|  |  |  COMPOSER (PromptInput)                                      | |  |
|  |  |  +----------------------------------------------------------+| |  |
|  |  |  | [Attachments preview bar]                                || |  |
|  |  |  +----------------------------------------------------------+| |  |
|  |  |  | "Describe a design..."                                   || |  |
|  |  |  +----------------------------------------------------------+| |  |
|  |  |  | [+] Attach    |    spacer    | [Model v] [Submit ->]     || |  |
|  |  +--------------------------------------------------------------+ |  |
|  +-------------------------------------------------------------------+  |
|                                                                          |
|  Composed of: Conversation + Message + MessagePart + PromptInput        |
|                                                                          |
+-------------------------------------------------------------------------+
```

| Block | File | Purpose |
|-------|------|---------|
| `ChatView` | `chat-view.tsx` | Full chat interface with messages and composer |
| `DesignCanvas` | `design-canvas.tsx` | Infinite canvas with DnD, pan, zoom (Mobile) |
| `MobileFrame` | `mobile-frame.tsx` | iPhone frame wrapper with status indicators |
| `BrowserFrame` | `browser-frame.tsx` | Browser frame with Vite iframe (Web) |
| `ScreenPreview` | `screen-preview.tsx` | Iframe-based HTML preview renderer |
| `DraggableScreen` | `draggable-screen.tsx` | DnD wrapper for canvas screens |
| `MessagePart` | `message-part.tsx` | Renders different message part types (text, tool, reasoning) |
| `ToolPart` | `tool-part.tsx` | Collapsible tool call display with icons |
| `AppSidebar` | `app-sidebar.tsx` | Main navigation sidebar with links |
| `SetupWizard` | `setup-wizard.tsx` | OpenCode installation check UI |
| `UpdateDialog` | `update-dialog.tsx` | App update notification/download |
| `AuthSettings` | `auth-settings.tsx` | Provider connection dialog |

### AI Components (`src/components/ai-elements/`)

> Chat and AI-specific components for conversation UI.

| Component | File | Purpose |
|-----------|------|---------|
| `PromptInput` | `prompt-input.tsx` | Composable input with attachments, tools, footer |
| `ModelSelector` | `model-selector.tsx` | AI model picker with provider logos |
| `Conversation` | `conversation.tsx` | Scrollable conversation container |
| `Message` | `message.tsx` | Message bubble with role-based styling |
| `Loader` | `loader.tsx` | Animated loading indicators |
| `Reasoning` | `reasoning.tsx` | Collapsible chain-of-thought display |
| `CodeBlock` | `code-block.tsx` | Syntax-highlighted code with Shiki |

---

## State Management

### State Architecture Overview

```
+-------------------------------------------------------------------------+
|                        STATE MANAGEMENT FLOW                             |
+-------------------------------------------------------------------------+
|                                                                          |
|   +-------------+                                                        |
|   |  Component  |                                                        |
|   +------+------+                                                        |
|          |                                                               |
|          | useStore() / useQuery()                                       |
|          v                                                               |
|   +-------------------------------------------------------------------+ |
|   |                         STATE LAYER                                | |
|   +-------------------------------------------------------------------+ |
|   |                                                                     | |
|   |  +---------------+  +---------------+  +---------------+           | |
|   |  |  Session      |  |    Model      |  |  React Query  |           | |
|   |  |  Store        |  |    Store      |  |  Cache        |           | |
|   |  | (Zustand)     |  |  (Zustand)    |  |               |           | |
|   |  +-------+-------+  +-------+-------+  +-------+-------+           | |
|   |          |                  |                  |                    | |
|   |          | Persisted        | Persisted        | Cached             | |
|   |          v                  v                  v                    | |
|   |  +------------------------------------------------------------+   | |
|   |  |                   PERSISTENCE LAYER                         |   | |
|   |  |   localStorage    |   localStorage   |   Memory + Tauri     |   | |
|   |  +------------------------------------------------------------+   | |
|   |                                                                     | |
|   +-------------------------------------------------------------------+ |
|                                                                          |
+-------------------------------------------------------------------------+
```

### Session Store (`src/context/session-store.tsx`)

> Zustand store for client-only and real-time state. Handles SSE event updates.

**State Shape:**

```typescript
interface SessionState {
  // ================================================================
  // Client State (persisted to localStorage)
  // ================================================================
  currentSessionId: string | null;     // Active session
  screenPositions: Record<string, ScreenPosition[]>; // Canvas layout
  designMode: "mobile" | "web";        // Active design mode
  webViewport: "desktop" | "tablet" | "mobile"; // Web preview viewport

  // ================================================================
  // Real-time State (from SSE events)
  // ================================================================
  messages: Record<string, Message[]>; // Keyed by sessionId
  parts: Record<string, MessagePart[]>;// Keyed by messageId
  sessionStatus: Record<string, SessionStatus>; // idle/running/error
  sessionDiffs: Record<string, FileDiff[]>;     // File changes

  // ================================================================
  // Server Connection
  // ================================================================
  isServerReady: boolean;              // OpenCode server status
  error: string | null;                // Last error message

  // ================================================================
  // Debug
  // ================================================================
  debugEvents: Event[];                // Last 500 SSE events

  // ================================================================
  // Actions
  // ================================================================
  setCurrentSessionId: (id: string | null) => void;
  setScreenPositions: (sessionId: string, positions: ScreenPosition[]) => void;
  setMessages: (sessionId: string, messages: Message[]) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  updatePart: (messageId: string, part: MessagePart) => void;
  setSessionStatus: (sessionId: string, status: SessionStatus) => void;
  handleEvent: (event: Event) => void;
  resetRealtimeState: () => void;
}
```

**Selectors & Hooks:**

| Hook | Returns | Usage |
|------|---------|-------|
| `useCurrentSessionId()` | `string \| null` | Get active session ID |
| `useSessionMessages(sessionId)` | `Message[]` | Get messages for session |
| `useMessageParts(messageId)` | `MessagePart[]` | Get parts for message |
| `useSessionStatus(sessionId)` | `SessionStatus` | Get session status |
| `useScreenPositions(sessionId)` | `ScreenPosition[]` | Get canvas positions |
| `useIsServerReady()` | `boolean` | Check if OpenCode ready |

**State Flow Diagram:**

```
+------------+     +------------+     +------------+
| SSE Event  | --> | handleEvent| --> | Update     |
| Received   |     | (switch)   |     | Zustand    |
+------------+     +------------+     +------------+
                         |
         +---------------+---------------+
         |               |               |
         v               v               v
  +------------+  +------------+  +------------+
  | message.   |  | message.   |  | session.   |
  | updated    |  | part.      |  | status     |
  | addMessage |  | updated    |  | setStatus  |
  +------------+  +------------+  +------------+
```

### Model Store (`src/hooks/use-models.ts`)

> Separate Zustand store for AI model selection preference.

```typescript
interface ModelState {
  selectedModel: { providerID: string; modelID: string } | null;
  setSelectedModel: (model: { providerID: string; modelID: string } | null) => void;
}
```

**Default:** `opencode/big-pickle` (Free OpenCode model)

### React Query Usage

| Hook | Query Key | Purpose |
|------|-----------|---------|
| `useSessionsList()` | `["sessions", "list"]` | Fetch all sessions from Tauri |
| `useSessionDesigns(cwd)` | `["designs", "session", cwd]` | Poll for design files (2s interval) |
| `useProviderData()` | `["models", "providers"]` | Fetch available AI providers/models |

---

## Data Flow & Logic

### Session Creation Flow

```
+-------------------------------------------------------------------------+
|                    SESSION CREATION SEQUENCE                             |
+-------------------------------------------------------------------------+
|                                                                          |
|   USER                    FRONTEND                    BACKEND            |
|    |                         |                           |               |
|    |   1. Enter Prompt       |                           |               |
|    | ----------------------> |                           |               |
|    |                         |                           |               |
|    |   2. Click Submit       |                           |               |
|    | ----------------------> |                           |               |
|    |                         |                           |               |
|    |                         |   3. Save to localStorage |               |
|    |                         | -----------o              |               |
|    |                         |                           |               |
|    |                         |   4. Create Session Dir   |               |
|    |                         | ------------------------> |               |
|    |                         |                           |               |
|    |                         |   5. invoke("create_      |               |
|    |                         |      session_dir")        |               |
|    |                         |                    <------|               |
|    |                         |   Returns: /path/to/dir   |               |
|    |                         |                           |               |
|    |                         |   6. SDK session.create() |               |
|    |                         | ------------------------> |  OpenCode     |
|    |                         |                           |               |
|    |                         |   7. Save metadata        |               |
|    |                         | ------------------------> |  Tauri        |
|    |                         |                           |               |
|    |                         |   8. Update Zustand       |               |
|    |                         | -----------o              |               |
|    |                         |                           |               |
|    |   9. Navigate           |                           |               |
|    | <---------------------- |                           |               |
|    |   /studio/$sessionId    |                           |               |
|    |                         |                           |               |
+-------------------------------------------------------------------------+
```

**Step-by-Step Breakdown:**

| Step | Actor | Action | Details |
|------|-------|--------|---------|
| 1-2 | User | Enters prompt, clicks submit | Triggers `handleSubmit()` in `index.tsx:41` |
| 3 | Frontend | Saves to localStorage | Keys: `dilag-initial-prompt`, `dilag-initial-files` |
| 4-5 | Frontend | Creates session directory | Tauri command `create_session_dir` returns path |
| 6 | Frontend | Creates OpenCode session | `sdk.session.create({ directory })` |
| 7 | Frontend | Saves session metadata | Tauri command `save_session_metadata` |
| 8 | Frontend | Updates Zustand | `setCurrentSessionId`, `setMessages([])` |
| 9 | Frontend | Navigates | TanStack Router to `/studio/$sessionId` |

### Message Sending Flow

```
+-------------------------------------------------------------------------+
|                    MESSAGE SENDING SEQUENCE                              |
+-------------------------------------------------------------------------+
|                                                                          |
|   USER                    FRONTEND                    OPENCODE           |
|    |                         |                           |               |
|    |   1. Type message       |                           |               |
|    | ----------------------> |                           |               |
|    |                         |                           |               |
|    |   2. Click send         |                           |               |
|    | ----------------------> |                           |               |
|    |                         |                           |               |
|    |                         |   3. Set status="running" |               |
|    |                         | -----------o              |               |
|    |                         |                           |               |
|    |                         |   4. SDK session.prompt() |               |
|    |                         | ------------------------> |               |
|    |                         |   (fire and forget)       |               |
|    |                         |                           |               |
|    |                         |   5. SSE: message.updated |               |
|    |                         | <------------------------ |  (user msg)   |
|    |                         |                           |               |
|    |   6. Show user msg      |                           |               |
|    | <---------------------- |                           |               |
|    |                         |                           |               |
|    |                         |   7. SSE: message.updated |               |
|    |                         | <------------------------ | (assistant)   |
|    |                         |                           |               |
|    |   8. Show thinking      |                           |               |
|    | <---------------------- |                           |               |
|    |                         |                           |               |
|    |                         |   9. SSE: message.part    |               |
|    |                         | <------------------------ | (streaming)   |
|    |                         |                           |               |
|    |   10. Update parts      |                           |               |
|    | <---------------------- |                           | (repeat)      |
|    |                         |                           |               |
|    |                         |  11. SSE: session.idle    |               |
|    |                         | <------------------------ |               |
|    |                         |                           |               |
|    |   12. Status = idle     |                           |               |
|    | <---------------------- |                           |               |
|    |                         |                           |               |
+-------------------------------------------------------------------------+
```

### Design Detection Flow

```
+-------------------------------------------------------------------------+
|                    DESIGN DETECTION SEQUENCE                             |
+-------------------------------------------------------------------------+
|                                                                          |
|   OPENCODE              FILESYSTEM              FRONTEND                 |
|       |                      |                      |                    |
|       |   1. AI generates    |                      |                    |
|       | -------------------> |                      |                    |
|       |   write(screens/     |                      |                    |
|       |     home.html)       |                      |                    |
|       |                      |                      |                    |
|       |                      |   2. Poll every 2s   |                    |
|       |                      | <------------------- |                    |
|       |                      |   load_session_      |                    |
|       |                      |   designs            |                    |
|       |                      |                      |                    |
|       |                      |   3. Return designs  |                    |
|       |                      | -------------------> |                    |
|       |                      |   [{filename, html,  |                    |
|       |                      |     title, type}]    |                    |
|       |                      |                      |                    |
|       |                      |                      |   4. Compare with  |
|       |                      |                      |      existing      |
|       |                      |                      | --------o          |
|       |                      |                      |                    |
|       |                      |                      |   5. Add new       |
|       |                      |                      |      positions     |
|       |                      |                      | --------o          |
|       |                      |                      |                    |
|       |                      |                      |   6. Render        |
|       |                      |                      |      MobileFrames  |
|       |                      |                      | --------o          |
|       |                      |                      |                    |
+-------------------------------------------------------------------------+
```

### SSE Event Handling

**Provider:** `src/context/global-events.tsx`

```
+-------------------------------------------------------------------------+
|                    SSE CONNECTION SEQUENCE                               |
+-------------------------------------------------------------------------+
|                                                                          |
|   1. App mounts, GlobalEventsProvider initializes                        |
|                                                                          |
|   2. Read dynamic port from window.__DILAG__.port (injected by Rust)     |
|                                                                          |
|   3. Start OpenCode server:                                              |
|      invoke("start_opencode_server") --> returns dynamic port            |
|                                                                          |
|   4. Create SDK client:                                                  |
|      createOpencodeClient({ baseUrl: `http://127.0.0.1:${port}` })         |
|                                                                          |
|   5. Connect to SSE:                                                     |
|      sdk.global.event() --> async iterator                               |
|                                                                          |
|   6. Process events in async for-loop:                                   |
|      for await (const event of events.stream) {                          |
|        handlersRef.current.forEach(h => h(event.payload))                |
|      }                                                                   |
|                                                                          |
|   7. Reconnection on disconnect:                                         |
|      - Exponential backoff (3s initial, 30s max)                         |
|      - Unlimited retry attempts                                          |
|      - Bootstrap callback on reconnect                                   |
|                                                                          |
+-------------------------------------------------------------------------+
```

**Event Types Handled:**

| Event Type | Handler | Effect |
|------------|---------|--------|
| `message.updated` | `addMessage` / `updateMessage` | Add or complete message |
| `message.part.updated` | `updatePart` | Update part content/state |
| `session.status` | `setSessionStatus` | Update running/idle/error |
| `session.diff` | `setSessionDiffs` | Store file diff info |
| `session.idle` | `setSessionStatus("idle")` | Mark session complete |
| `session.error` | `setSessionStatus("error")` | Mark session failed |
| `global.disposed` | `bootstrap()` | Re-sync all state |

---

## Backend Integration

### Tauri Commands (`src-tauri/src/lib.rs`)

```
+-------------------------------------------------------------------------+
|                        TAURI COMMANDS                                    |
+-------------------------------------------------------------------------+
|                                                                          |
|   +-- OpenCode Server --------------------------------------------------+|
|   |                                                                      ||
|   |  check_opencode_installation() -> OpenCodeCheckResult               ||
|   |    Checks if OpenCode CLI is installed and returns version          ||
|   |                                                                      ||
|   |  start_opencode_server() -> Result<u16, String>                     ||
|   |    Spawns opencode serve on dynamic free port, returns port number  ||
|   |                                                                      ||
|   |  stop_opencode_server() -> Result<(), String>                       ||
|   |    Stops the running OpenCode server process                        ||
|   |                                                                      ||
|   +----------------------------------------------------------------------+|
|                                                                          |
|   +-- Session Management -----------------------------------------------+|
|   |                                                                      ||
|   |  create_session_dir(session_id: String) -> Result<String, String>   ||
|   |    Creates ~/.dilag/sessions/{id}/ directory, returns full path     ||
|   |                                                                      ||
|   |  save_session_metadata(session: SessionMeta) -> Result<(), String>  ||
|   |    Saves session to ~/.dilag/sessions.json                          ||
|   |                                                                      ||
|   |  load_sessions_metadata() -> Vec<SessionMeta>                       ||
|   |    Loads all sessions from ~/.dilag/sessions.json                   ||
|   |                                                                      ||
|   |  delete_session_metadata(session_id: String) -> Result<(), String>  ||
|   |    Removes session from JSON and deletes directory                  ||
|   |                                                                      ||
|   +----------------------------------------------------------------------+|
|                                                                          |
|   +-- Design Files -----------------------------------------------------+|
|   |                                                                      ||
|   |  load_session_designs(session_cwd: String) -> Vec<DesignFile>       ||
|   |    Scans session dir + screens/ for .html files                     ||
|   |    Extracts: filename, title, screen_type, html, modified_at        ||
|   |                                                                      ||
|   +----------------------------------------------------------------------+|
|                                                                          |
|   +-- Vite Server -----------------------------------------------------+|
|   |                                                                      ||
|   |  start_vite_server(session_cwd: String) -> Result<u16, String>      ||
|   |    Starts Vite dev server for a session, returns port               ||
|   |                                                                      ||
|   |  stop_vite_server() -> Result<(), String>                           ||
|   |    Stops the running Vite server process                            ||
|   |                                                                      ||
|   |  initialize_web_project(session_cwd: String) -> Result<(), String>  ||
|   |    Copies web template to session directory                         ||
|   |                                                                      ||
|   +----------------------------------------------------------------------+|
|                                                                          |
|   +-- App Management ---------------------------------------------------+|
|   |                                                                      ||
|   |  get_app_info() -> AppInfo                                          ||
|   |    Returns { version, data_dir, data_size_bytes }                   ||
|   |                                                                      ||
|   |  reset_all_data() -> Result<(), String>                             ||
|   |    Deletes ~/.dilag contents, restarts app                          ||
|   |                                                                      ||
|   +----------------------------------------------------------------------+|
|                                                                          |
+-------------------------------------------------------------------------+
```

### OpenCode SDK Usage

**Client Creation:**
```typescript
// Port injected by Rust via window.__DILAG__ = { port }
const port = window.__DILAG__?.port ?? 4096;
const sdk = createOpencodeClient({
  baseUrl: `http://127.0.0.1:${port}`,
  fetch: customFetch, // Disables timeout for SSE
});
```

**API Methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `sdk.session.create` | `{ directory }` | `{ id }` | Create new session |
| `sdk.session.get` | `{ sessionID, directory }` | Session details | Get session info |
| `sdk.session.delete` | `{ sessionID, directory }` | - | Delete session |
| `sdk.session.messages` | `{ sessionID, directory }` | `Message[]` | Get message history |
| `sdk.session.prompt` | `{ sessionID, directory, agent, model, parts }` | - | Send prompt (fire & forget) |
| `sdk.provider.list` | - | `{ all, connected }` | Get available providers |
| `sdk.global.event` | - | AsyncIterator | SSE event stream |

### AI Agent Configuration

The Rust backend embeds two agent configurations:

#### 1. Designer Agent (`designer`)
- **Focus:** Mobile UI generation
- **Tools:** Write-only (bash disabled)
- **Output:** HTML files in `screens/` directory
- **Styling:** Tailwind CSS v4 with custom `@theme` tokens
- **Templates:** iPhone 14 Pro (393x852)
- **Icons:** Iconify (Solar, Phosphor sets)

#### 2. Web Designer Agent (`web-designer`)
- **Focus:** Web application generation
- **Tools:** Full file system access (read/write/edit/bash)
- **Project Structure:** Vite + React + TanStack Router
- **Output:** Source code in `web-project/` directory
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React

---

## Tool Registry

**File:** `src/lib/tool-registry.tsx`

Defines how OpenCode tools are displayed in the UI.

### Registered Tools

| Tool | Icon | Description |
|------|------|-------------|
| `read` | `Glasses` | File read - shows preview with syntax highlighting |
| `edit` | `Code2` | File edit - shows diff with +/- counts |
| `write` | `FilePlus2` | File create - shows content with line count |
| `bash` | `Terminal` | Shell command - shows command and output |
| `glob` | `FolderSearch` | File pattern search - shows match count |
| `grep` | `Search` | Content search - shows match count |
| `list` | `FolderSearch` | Directory listing - shows item count |
| `webfetch` | `Globe` | URL fetch - shows hostname and content |
| `task` | `Bot` | Sub-agent task - shows tool summary |
| `todowrite` | `ListChecks` | Todo list - shows completion progress |
| `theme` | `Paintbrush` | Theme generation - shows color swatches |

### Tool State

Each tool progresses through states:
- `pending` - Waiting to execute
- `running` - Currently executing (shows elapsed timer)
- `completed` - Finished successfully
- `error` - Failed with error message

### Tool Display in `<ToolPart>`

```
+-------------------------------------------------------------------+
| [Icon] Tool Name - subtitle (path, counts)           [timer] [^v] |
+-------------------------------------------------------------------+
| Expandable content area:                                          |
| - Code preview with syntax highlighting                           |
| - Diff view with +/- line counts                                  |
| - Command output                                                  |
| - Progress/completion status                                      |
+-------------------------------------------------------------------+
```

- Default collapsed except `todowrite`
- Expandable via chevron button
- Status badge colors: blue (running), green (complete), red (error)

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
|----------|---------|--------|
| `Cmd+N` | Global | New session |
| `Cmd+,` | Global | Open settings |
| `Cmd+B` | Global | Toggle sidebar |
| `Cmd+\` | Studio | Toggle chat pane |
| `Ctrl+Scroll` | Canvas | Zoom in/out |
| `Enter` | Composer | Send message |
| `Shift+Enter` | Composer | New line |

---

## Theme System

```
+-------------------------------------------------------------------------+
|                        THEME TOKENS                                      |
+-------------------------------------------------------------------------+
|                                                                          |
|  Token              | Light          | Dark                              |
|  -------------------+----------------+----------------------------------  |
|  --background       | oklch(1 0 0)   | oklch(0.145 0.02 285.69)         |
|  --foreground       | oklch(0.2 0 0) | oklch(0.985 0 0)                 |
|  --primary          | oklch(0.55...)  | oklch(0.646 0.222 264.44)       |
|  --card             | oklch(1 0 0)   | oklch(0.205 0.015 285.69)        |
|  --muted            | oklch(0.97...)  | oklch(0.269 0.015 285.69)       |
|  --border           | oklch(0.92...)  | oklch(0.274 0.026 264.44)       |
|                                                                          |
+-------------------------------------------------------------------------+
```

Theme managed via `next-themes` with `ThemeProvider`:
- Stored in localStorage key: `dilag-theme`
- Options: `light`, `dark`, `system`

---

## File Structure Reference

```
src/
  components/
    ai-elements/        # AI/chat components (prompt, model, message)
    blocks/             # Page section components (chat-view, canvas)
    ui/                 # shadcn/ui primitives (button, card, dialog)
    theme-provider.tsx  # next-themes wrapper
  context/
    global-events.tsx   # SSE provider & SDK client
    session-store.tsx   # Zustand store for real-time state
    menu-events.tsx     # Native menu event handlers
    updater-context.tsx # App auto-update provider
  hooks/
    use-designs.ts      # Design file polling (React Query)
    use-models.ts       # Model selection (Zustand)
    use-sessions.ts     # Main session management hook
    use-session-data.ts # React Query data layer for sessions
    use-mobile.ts       # Mobile viewport detection hook
  lib/
    tool-registry.tsx   # Tool display configurations
    utils.ts            # cn() and utilities
  routes/
    __root.tsx          # Root layout with providers
    index.tsx           # Home page
    studio.$sessionId.tsx # Studio workspace
    projects.tsx        # All projects view
    settings.tsx        # Settings page

src-tauri/
  src/lib.rs            # Rust commands & designer agent config
  tauri.conf.json       # Tauri app configuration
```

---

## Key Interactions Summary

1. **Home -> Studio:** Prompt saved to localStorage, session created via Tauri + OpenCode SDK, navigate to studio
2. **Studio Load:** Read localStorage prompt, trigger `sendMessage()` after 500ms delay
3. **Chat Submit:** SDK `session.prompt()` fires, SSE events update Zustand in real-time
4. **Design Updates:** 2s polling via React Query detects new HTML files, renders in canvas
5. **Canvas Drag:** DnD updates `screenPositions` in Zustand (persisted to localStorage)
6. **Model Switch:** Updates `useModelStore`, affects next prompt call
7. **Session Switch:** Updates `currentSessionId`, loads messages from SDK
8. **Reconnection:** SSE auto-reconnects with backoff, bootstrap re-syncs state
