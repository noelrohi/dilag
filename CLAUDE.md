# CLAUDE.md

See **AGENTS.md** for full project documentation.

## Quick Reference

```bash
bun run tauri dev    # Full app
bun run dev          # Frontend only
tsc --noEmit         # Type check
```

## Conventions

- **Imports:** `@/*` alias for `src/*`
- **Components:** Function components, `React.ComponentProps<>` intersection types
- **Styling:** `cn()` + Tailwind, `cva` for variants
- **Exports:** Named exports; default only for routes
- **Rust:** snake_case commands, `AppResult<T>` return type

## Key Locations

| Task | Location |
|------|----------|
| UI primitives | `src/components/ui/` |
| AI components | `src/components/ai-elements/` |
| Page sections | `src/components/blocks/` |
| Rust commands | `src-tauri/src/` (see `AGENTS.md` there) |
| State | `src/context/session-store.tsx` |
| SSE events | `src/context/global-events.tsx` |

## Docs

- `docs/architecture.md` - Technical flows
- `docs/platform.md` - UI/UX documentation
