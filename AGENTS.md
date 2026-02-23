# AGENTS.md

**Generated:** 2026-02-23 | **Branch:** main

## Overview

Dilag is an AI-powered design studio for mobile and web apps. This monorepo contains:
- **Desktop App** (`apps/desktop`): Tauri 2 desktop app (Rust backend + React 19 frontend)
- **Website** (`apps/web`): Next.js 16 public marketing site
- **UI Package** (`packages/ui`): Shared UI primitives/components

## Structure

```
dilag/
├── apps/
│   ├── desktop/              # Tauri desktop app
│   │   ├── src/              # React frontend
│   │   ├── src-tauri/        # Rust backend
│   │   └── docs/             # Architecture docs
│   └── web/                  # Next.js marketing site
│       └── src/app/          # App router pages
├── packages/
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
bun run test
bun run lint

# Desktop
cd apps/desktop
bun run tauri dev
bun test
cd src-tauri && cargo test

# Web
cd apps/web
bun run dev
bun run build
```

## App-Specific Documentation

| App | AGENTS.md | Notes |
|-----|-----------|-------|
| Desktop (Rust) | `apps/desktop/src-tauri/src/AGENTS.md` | Rust backend patterns |
| Web | `apps/web/AGENTS.md` | Next.js marketing patterns |

## Key Integrations

### OpenCode SDK (AI)
- Desktop app spawns OpenCode server for AI generation
- SSE streaming for real-time design updates

## Workspaces

| Package | Name | Description |
|---------|------|-------------|
| `apps/desktop` | `@dilag/desktop` | Tauri desktop app |
| `apps/web` | `@dilag/web` | Next.js marketing website |
| `packages/ui` | `@dilag/ui` | Shared UI components |

## Conventions

- **Package manager**: Bun with workspaces
- **Build orchestration**: Turborepo
- **Desktop**: Tauri + React + Rust modules
- **Web**: Public marketing pages only
