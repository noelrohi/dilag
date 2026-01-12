# AGENTS.md - Web App

Next.js 16 marketing website and API for Dilag.

## Commands

```bash
bun run dev           # Next.js dev with Turbopack
bun run build         # Production build
bun run db:push       # Push schema to database
bun run db:studio     # Open Drizzle Studio
```

## Structure

```
apps/web/
├── src/
│   ├── app/                    # App Router
│   │   ├── (auth)/             # Auth pages (sign-in, sign-up)
│   │   ├── api/
│   │   │   ├── auth/[...all]/  # better-auth handler
│   │   │   └── trial/          # Trial registration API
│   │   ├── dashboard/          # User dashboard
│   │   └── page.tsx            # Landing page
│   ├── components/             # React components
│   ├── db/                     # Drizzle schema
│   └── lib/
│       ├── auth.ts             # better-auth config
│       ├── auth-client.ts      # Client-side auth
│       └── polar.ts            # Polar SDK setup
├── drizzle.config.ts           # Drizzle ORM config
└── .env.example                # Environment template
```

## Key Patterns

### Authentication (better-auth)

Auth is configured in `src/lib/auth.ts` with:
- Email/password authentication
- Google OAuth
- Polar.sh integration for payments
- Drizzle adapter for PostgreSQL

**Server-side session check:**
```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({
  headers: await headers(),
});
```

**Client-side auth:**
```typescript
import { authClient } from "@/lib/auth-client";

// Sign in
await authClient.signIn.email({ email, password });

// Get session
const { data: session } = await authClient.useSession();
```

### Polar.sh Integration

Polar handles licensing and payments:

1. **Customer creation** - Automatic on signup via better-auth plugin
2. **Checkout** - `auth.api.checkout()` for purchases
3. **Portal** - `auth.api.portal()` for subscription management
4. **Webhooks** - Handle order/subscription events

### Trial API

Desktop app calls `/api/trial` to register/check trials:

```typescript
// Register trial (POST)
const res = await fetch("/api/trial", {
  method: "POST",
  body: JSON.stringify({ device_id: "..." }),
});

// Check trial (GET)
const res = await fetch(`/api/trial?device_id=${deviceId}`);
```

Trials are tracked via Polar customers with `trial_start_utc` in metadata.

### Database (Drizzle)

Schema in `src/db/schema.ts`. Uses better-auth's schema tables:
- `user` - User accounts
- `session` - Auth sessions
- `account` - OAuth accounts
- `verification` - Email verification

## Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Purpose |
|----------|---------|
| `BETTER_AUTH_SECRET` | Token signing |
| `DATABASE_URL` | PostgreSQL connection |
| `POLAR_ACCESS_TOKEN` | Polar API access |
| `POLAR_ORG_ID` | Your Polar organization |

## Conventions

- Use App Router (not Pages Router)
- Server Components by default, `"use client"` only when needed
- Colocate components with routes when route-specific
- Use `@/` path alias for imports
- Tailwind CSS for styling
- React Query for client-side data fetching
