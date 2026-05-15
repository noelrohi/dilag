# Development

This is the evergreen development reference for the monorepo: toolchain, quality gates, package boundaries, and code ownership.

## Toolchain

Use Bun through the version pinned in `package.json` and `.mise.toml`.

```bash
bun install
```

## Completion Contract

Run these before handing off a broad change:

```bash
bun run fmt:check
bun run lint
bun run typecheck
bun run test
bun run build
```

CI runs the same checks, with `build:web` as the Linux-safe build target. Desktop packaging remains a release concern because signing and native packaging need platform credentials.

## Package Roles

| Package                   | Role                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop`            | Electron host, preload bridge, and React renderer for the native design studio.                                     |
| `apps/web`                | Public marketing site only.                                                                                         |
| `packages/desktop-bridge` | The renderer/preload contract: IPC method groups, event payloads, bootstrap values, and shared desktop data shapes. |
| `packages/ui`             | Presentational primitives shared by desktop and web.                                                                |

Keep native-shell transport details out of renderer hooks and routes. Renderer code should depend on `@dilag/desktop-bridge` types and call `src/lib/bridge.ts`; Electron-specific channel names stay under `apps/desktop/electron`.

Do not add `packages/contracts` until there are duplicated schemas consumed by desktop, web, and another runtime. One adapter is still hypothetical; shared contracts become worthwhile when at least two real consumers need the same interface.
