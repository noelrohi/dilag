# AGENTS.md

**Generated:** 2025-12-31 | **Commit:** fb652d1 | **Branch:** main

## Overview

Dilag is an AI-powered mobile UI design studio. Tauri 2 desktop app (Rust backend) + React 19 frontend. Users describe app ideas in natural language; AI generates Tailwind-styled HTML screens rendered on an infinite canvas.

## Documentation

| Doc | Contents |
|-----|----------|
| `docs/architecture.md` | App startup, storage, SSE events, session lifecycle, licensing, native menu, state management |
| `docs/platform.md` | UI screens, components, user flows, tool registry, data flow diagrams |

## Where to Look

| Task | Location | Notes |
|------|----------|-------|
| Add UI primitive | `src/components/ui/` | shadcn/ui (Radix-based), use `npx shadcn@latest add` |
| Add AI/chat component | `src/components/ai-elements/` | Message, prompt, model selector, streaming |
| Add page section | `src/components/blocks/` | Composed from ui/ + ai-elements/ |
| Add route/page | `src/routes/` | TanStack Router, default export, minimal logic |
| Add Tauri command | `src-tauri/src/` | See `src-tauri/src/AGENTS.md` for Rust patterns |
| Add React hook | `src/hooks/` | Custom hooks, React Query wrappers |
| Add context/provider | `src/context/` | Zustand stores, React contexts |
| Modify SSE handling | `src/context/global-events.tsx` | SDK client, event subscription |
| Modify session state | `src/context/session-store.tsx` | Zustand + immer + persist |

## Structure

```
dilag/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn primitives (31 files)
│   │   ├── ai-elements/  # AI/chat components (31 files)
│   │   └── blocks/       # Page sections (22 files)
│   ├── context/          # Zustand stores, React contexts
│   ├── hooks/            # Custom hooks, React Query
│   ├── lib/              # utils.ts, tool-registry.tsx
│   └── routes/           # TanStack Router pages
├── src-tauri/src/        # Modular Rust backend (12 files)
├── docs/                 # architecture.md, platform.md
└── scripts/              # Version sync, test scripts
```

## Commands

```bash
bun run dev          # Vite dev server (frontend only)
bun run tauri dev    # Full Tauri app (frontend + Rust)
bun run build        # Production build
tsc --noEmit         # Type check (no lint configured)
bun test             # Vitest (limited coverage)
cd src-tauri && cargo test  # Rust tests
```

## Conventions

### Imports
```typescript
// ALWAYS use @/* alias for src/*
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
```

### Components
```typescript
// Function components with React.ComponentProps intersection
export function MyComponent({
  className,
  ...props
}: React.ComponentProps<"div"> & { custom?: string }) {
  return <div className={cn("base", className)} {...props} />
}
```

### Naming
- **Files:** kebab-case (`my-component.tsx`)
- **Components:** PascalCase (`MyComponent`)
- **Functions/variables:** camelCase
- **Exports:** Named exports; default only for route pages

### Styling
- `cn()` for class merging (Tailwind)
- `cva` for variant components
- OKLCH color tokens in CSS variables

### State Management (TkDodo pattern)
| Type | Tool | Example |
|------|------|---------|
| Server state | React Query | `useSessionsList()`, `useProviderData()` |
| Client state | Zustand + persist | `useModelStore`, `useSessionStore` |
| Real-time state | Zustand (no persist) | messages, parts, status from SSE |

### Tauri Commands
```typescript
// Frontend: invoke from @tauri-apps/api/core
import { invoke } from "@tauri-apps/api/core"
const result = await invoke("command_name", { arg1, arg2 })

// Backend: snake_case, return Result<T, String> or AppResult<T>
// See src-tauri/src/AGENTS.md for Rust patterns
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| `as any`, `@ts-ignore` | Fix types properly |
| Default exports (non-routes) | Named exports |
| Direct localStorage | Zustand persist middleware |
| Inline Tauri logic in routes | Extract to hooks/context |
| Remove `#[cfg_attr(...)]` in main.rs | DO NOT REMOVE - prevents Windows console |

## Data Storage

```
~/.dilag/
├── sessions.json              # Session metadata index
├── license.json               # License/trial state (Polar.sh)
├── opencode/opencode.json     # OpenCode agent config
└── sessions/{uuid}/screens/   # Generated HTML designs
```

## Key Integrations

### OpenCode SDK (AI)
- Server runs on `localhost:4096`
- SSE streaming for real-time updates
- Agent "designer" with UI generation prompt
- Config isolated via `XDG_CONFIG_HOME=~/.dilag/opencode/`

### Polar.sh (Licensing)
- 7-day trial with server time validation
- License activation via API
- Grace period for offline use

## Testing

```bash
bun test                        # Vitest (frontend)
cd src-tauri && cargo test      # Rust tests
```

- Colocated tests: `*.test.ts`
- jsdom environment
- Mocks: Tauri API, localStorage, matchMedia, ResizeObserver
- Focus on Zustand store testing

## Release Process

- Version bump: `bumpp` (syncs package.json → Cargo.toml → tauri.conf.json)
- CI: GitHub Actions on `v*.*.*` tags only
- macOS only (aarch64, x86_64), Apple code signing
- Auto-updater via Tauri plugin
