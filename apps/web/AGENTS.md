# AGENTS.md - Web App

Next.js 16 marketing website for Dilag.

## Commands

```bash
bun run dev           # Next.js dev with Turbopack
bun run build         # Production build
bun run lint          # ESLint
```

## Structure

```
apps/web/
├── src/
│   ├── app/                    # App Router pages
│   │   ├── api/                # Retired API stubs (410 Gone)
│   │   ├── page.tsx            # Landing page
│   │   ├── pricing/            # Free-forever pricing page
│   │   ├── download/           # Download page
│   │   ├── faq/                # FAQ
│   │   └── privacy/terms/cookies
│   ├── components/             # Marketing components
│   └── lib/
│       └── constants.ts
├── next.config.ts              # Redirects for legacy routes
└── .env.example                # Optional local env template
```

## Conventions

- App Router only
- Server Components by default
- Use `@/` path alias
- Keep site fully public and marketing-focused
- Do not add auth, billing, or account gating flows
