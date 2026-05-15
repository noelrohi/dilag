# AGENTS.md

**Generated:** 2026-02-23 | **Branch:** main

## Overview

Dilag is an AI-powered design studio for mobile and web apps. This monorepo contains:

- **Desktop App** (`apps/desktop`): Electron desktop app (Electron main/preload + React 19 renderer)
- **Website** (`apps/web`): Next.js 16 public marketing site
- **Desktop Bridge** (`packages/desktop-bridge`): Shared renderer/preload IPC contract
- **UI Package** (`packages/ui`): Shared UI primitives/components

## Structure

```
dilag/
├── apps/
│   ├── desktop/              # Electron desktop app
│   │   ├── src/              # React frontend
│   │   ├── electron/         # Electron main/preload host
│   │   ├── src-tauri/        # Legacy Tauri backend kept during migration
│   │   └── docs/             # Architecture docs
│   └── web/                  # Next.js marketing site
│       └── src/app/          # App router pages
├── packages/
│   ├── desktop-bridge/       # Desktop IPC contract shared by Electron and React
│   └── ui/                   # Shared UI components
├── package.json              # Bun workspaces root
└── turbo.json                # Turborepo config
```

## Commands

```bash
# Root
bun install
bun run dev
bun run dev:desktop
bun run dev:web
bun run build
bun run typecheck
bun run test
bun run lint
bun run fmt:check
bun run fmt

# Desktop
cd apps/desktop
bun run dev
bun run typecheck
bun test

# Web
cd apps/web
bun run dev
bun run typecheck
bun run build
```

## App-Specific Documentation

| App | AGENTS.md            | Notes                      |
| --- | -------------------- | -------------------------- |
| Web | `apps/web/AGENTS.md` | Next.js marketing patterns |

## Key Integrations

### Pi SDK (AI)

- Desktop app embeds the Pi coding-agent SDK in Electron main
- Renderer talks to the runtime through `@dilag/desktop-bridge` as `bridge.agent`
- Pi data is isolated under `~/.dilag/pi`; session-local skills are written to `.agents/skills`

## Workspaces

| Package                   | Name                    | Description                   |
| ------------------------- | ----------------------- | ----------------------------- |
| `apps/desktop`            | `@dilag/desktop`        | Electron desktop app          |
| `apps/web`                | `@dilag/web`            | Next.js marketing website     |
| `packages/desktop-bridge` | `@dilag/desktop-bridge` | Renderer/preload IPC contract |
| `packages/ui`             | `@dilag/ui`             | Shared UI components          |

## Conventions

- **Package manager**: Bun with workspaces
- **Build orchestration**: Turborepo
- **Quality gate**: `bun run fmt:check`, `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`
- **Desktop**: Electron host + React renderer. Keep native-shell calls behind `@dilag/desktop-bridge`.
- **Web**: Public marketing pages only
- **Contracts**: Put renderer/preload IPC types in `packages/desktop-bridge`. Add `packages/contracts` only when desktop, web, and a backend share duplicated schemas.
