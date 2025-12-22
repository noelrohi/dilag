# CLAUDE.md

## Documentation
- `docs/platform.md` - UI screens, components, user flows, tool registry
- `docs/architecture.md` - App startup, storage, SSE events, session lifecycle

## Build & Run
- `bun run dev` - Vite dev server (frontend only)
- `bun run tauri dev` - Full Tauri app (frontend + Rust)
- `bun run build` / `bun run tauri build` - Production builds
- No test/lint configured; type-check with `tsc --noEmit`

## Code Style
- **Imports:** Use `@/*` alias for `src/*` (e.g., `import { cn } from "@/lib/utils"`)
- **Components:** Function components, props via `React.ComponentProps<>` intersection types
- **Styling:** `cn()` for class merging; `cva` for variant components
- **Exports:** Named exports for components; default exports only for route pages
- **Naming:** PascalCase components, camelCase functions/variables, kebab-case files
- **Error handling:** Rust commands return `Result<T, String>`; React uses try/catch

## Project Structure
- `src/components/ui/` - shadcn/ui primitives (Radix-based)
- `src/components/blocks/` - Composed page sections
- `src/components/ai-elements/` - AI/chat-specific components
- `src/routes/` - TanStack Router pages (keep minimal, delegate to blocks)

## Tauri Commands
- Define in `src-tauri/src/lib.rs` with `#[tauri::command]`
- Call via `invoke("cmd", { args })` from `@tauri-apps/api/core`

## Licensing
- Licensing module: `src-tauri/src/licensing.rs`
- Uses Polar.sh for license key validation
- 7-day free trial with server-validated timestamps
- Run tests: `cd src-tauri && cargo test`

## Versioning
- Version reset to 0.0.1 with licensing system introduction
- Previous 0.2.x versions were pre-release/internal builds
- Will follow semver after initial public release
- Keep versions in sync: `package.json`, `Cargo.toml`, `tauri.conf.json`
