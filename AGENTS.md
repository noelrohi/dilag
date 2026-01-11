# AGENTS.md

**Generated:** 2026-01-11 | **Branch:** main

## Overview

Dilag is an AI-powered design studio for mobile and web apps. This is a monorepo containing:
- **Desktop App** (`apps/desktop`): Tauri 2 desktop app (Rust backend + React 19 frontend)
- **Website** (`apps/web`): Next.js 16 marketing site + API for trial tracking
- **Shared** (`packages/shared`): Shared types and utilities

## Structure

```
dilag/
├── apps/
│   ├── desktop/              # Tauri desktop app
│   │   ├── src/              # React frontend
│   │   ├── src-tauri/        # Rust backend
│   │   └── docs/             # Architecture docs
│   └── web/                  # Next.js website + API
│       └── src/app/          # App router pages
├── packages/
│   └── shared/               # Shared types (trial API, etc.)
├── package.json              # Bun workspaces root
└── turbo.json                # Turborepo config
```

## Commands

```bash
# Root (monorepo)
bun install                   # Install all dependencies
bun run dev                   # Dev all apps (turbo)
bun run dev:desktop           # Dev desktop only
bun run dev:web               # Dev website only
bun run build                 # Build all

# Desktop app
cd apps/desktop
bun run tauri dev             # Full Tauri dev (frontend + Rust)
bun test                      # Vitest tests
cd src-tauri && cargo test    # Rust tests

# Website
cd apps/web
bun run dev                   # Next.js dev server
bun run build                 # Production build
```

## App-Specific Documentation

| App | AGENTS.md | Notes |
|-----|-----------|-------|
| Desktop | `apps/desktop/AGENTS.md` | Tauri, React, Rust patterns |
| Desktop (Rust) | `apps/desktop/src-tauri/src/AGENTS.md` | Rust backend patterns |
| Web | `apps/web/AGENTS.md` | Next.js, better-auth, Polar |

## Key Integrations

### Polar.sh (Licensing & Payments)
- **Desktop**: License key validation, trial tracking
- **Website**: better-auth integration, customer portal, trial registry API
- Trial abuse prevention via server-side device tracking

### OpenCode SDK (AI)
- Desktop app spawns OpenCode server for AI generation
- SSE streaming for real-time design updates

## Workspaces

| Package | Name | Description |
|---------|------|-------------|
| `apps/desktop` | `@dilag/desktop` | Tauri desktop app |
| `apps/web` | `@dilag/web` | Next.js website + API |
| `packages/shared` | `@dilag/shared` | Shared types |

## Conventions

- **Package manager**: Bun with workspaces
- **Build orchestration**: Turborepo
- **Desktop**: See `apps/desktop/AGENTS.md`
- **Web**: Next.js App Router, better-auth for auth
