# AGENTS.md

## Build & Run Commands
- `bun run dev` - Start Vite dev server (frontend only)
- `bun run tauri dev` - Start full Tauri app (frontend + Rust backend)
- `bun run build` - Build frontend; `bun run tauri build` - Build desktop app
- No test framework configured; no lint commands available

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4 + TanStack Router
- **Backend:** Rust with Tauri v2
- **UI Components:** shadcn/ui (New York style) with Radix primitives
- **Package Manager:** Bun

## Code Style
- **TypeScript:** Strict mode enabled; no unused locals/parameters
- **Imports:** Use `@/*` alias for `src/*` paths (e.g., `import { cn } from "@/lib/utils"`)
- **Components:** Function components with explicit prop types using `React.ComponentProps<>`
- **Styling:** Use `cn()` utility for merging Tailwind classes; prefer `cva` for variants
- **Exports:** Named exports for components (`export { Button }`), default export for pages

## Project Structure
- **Pages:** Keep route pages minimal and readable; extract complex UI to `src/components/blocks/`
- **Blocks:** Reusable page sections/compositions live in `src/components/blocks/`
- **UI:** Primitive shadcn/ui components in `src/components/ui/`

## Tauri Commands
- Define Rust commands in `src-tauri/src/lib.rs` with `#[tauri::command]`
- Call from React via `invoke("command_name", { args })` from `@tauri-apps/api/core`
- Register commands in `invoke_handler(tauri::generate_handler![...])`
