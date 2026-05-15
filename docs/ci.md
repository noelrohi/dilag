# CI

CI is intentionally small and mirrors the local quality gates.

## Pull requests and main

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:

```bash
bun install --frozen-lockfile
bun run fmt:check
bun run lint
bun run typecheck
bun run test
bun run build:web
```

Use the broader local build before handing off desktop changes when practical:

```bash
bun run build
```

## Releases

`.github/workflows/release.yml` is the source of truth for tagged release automation. Keep release details in the workflow unless they are stable enough to document here.
