# CLAUDE.md

See **AGENTS.md** for full project documentation.

## Quick Reference

```bash
bun run dev           # Full Electron app
bun run dev:renderer  # Vite renderer only
bun run typecheck     # Type check
```

## Conventions

- **Imports:** `@/*` alias for `src/*`
- **Components:** Function components, `React.ComponentProps<>` intersection types
- **Styling:** `cn()` + Tailwind, `cva` for variants
- **Exports:** Named exports; default only for routes
- **Native host:** keep Electron IPC behind `@dilag/desktop-bridge`

## Key Locations

| Task          | Location                         |
| ------------- | -------------------------------- |
| UI primitives | `src/components/ui/`             |
| AI components | `src/components/ai-elements/`    |
| Page sections | `src/components/blocks/`         |
| Electron host | `electron/`                      |
| Bridge types  | `../../packages/desktop-bridge/` |
| State         | `src/context/session-store.tsx`  |
| Agent events  | `src/context/global-events.tsx`  |

## Docs

- `../../docs/README.md` - Documentation index
- `../../docs/architecture.md` - Technical flows
- `../../docs/platform.md` - UI/UX documentation
