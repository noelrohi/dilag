# AGENTS.md

Dilag is an AI-powered design studio for mobile and web apps. The repo is a Bun/Turborepo monorepo.

## Product

- Desktop app: local-first Electron app where users prompt an embedded Pi agent to generate HTML screens.
- Web app: public marketing site only.
- Generated desktop session data lives under `~/.dilag`; Pi runtime data is isolated under `~/.dilag/pi`.

## Repository map

- `apps/desktop` — Electron main/preload host plus React renderer.
- `apps/web` — Next.js marketing site.
- `packages/desktop-bridge` — shared renderer/preload IPC contract and desktop data shapes.
- `packages/ui` — shared presentational UI primitives.
- `docs/` — evergreen project docs.

## Architecture context

- Renderer code talks to native/runtime capabilities through `@dilag/desktop-bridge`.
- Electron main embeds the Pi coding-agent SDK and normalizes runtime events for the renderer.
- Session-local design skills are written to `.agents/skills` inside each session workspace.
- User-installed skills live under `~/.agents/skills`.

## Docs

- `docs/README.md` — documentation index.
- `docs/architecture.md` — desktop runtime architecture and data boundaries.
- `docs/platform.md` — product behavior, screens, flows, and feature checklist.
- `docs/development.md` — toolchain, package roles, and quality gates.
