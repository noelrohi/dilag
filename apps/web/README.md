# @dilag/web

Next.js marketing website and API for Dilag.

## Features

- Marketing landing page
- User authentication (better-auth + Google OAuth)
- License management via Polar.sh
- Trial registration API for desktop app

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Fill in the required values:

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `BETTER_AUTH_SECRET` | Auth token secret | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Same as above |
| `POLAR_ACCESS_TOKEN` | Polar API token | [Polar Settings](https://polar.sh/settings/tokens) |
| `POLAR_ORG_ID` | Your Polar org ID | Polar dashboard |
| `NEXT_PUBLIC_POLAR_PRODUCT_ID` | Pro license product | Polar dashboard |
| `POLAR_WEBHOOK_SECRET` | Webhook verification | [Polar Webhooks](https://polar.sh/settings/webhooks) |
| `DATABASE_URL` | PostgreSQL connection | Your database provider |

### 3. Setup Database

```bash
# Push schema to database
bun run db:push

# Or generate and run migrations
bun run db:generate
bun run db:migrate
```

### 4. Run Development Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Routes

### Authentication

- `POST /api/auth/*` - better-auth endpoints (sign in, sign up, etc.)

### Trial Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trial` | POST | Register device for trial |
| `/api/trial?device_id=xxx` | GET | Check trial status |

**Request body (POST):**
```json
{ "device_id": "unique-device-identifier" }
```

**Response:**
```json
{
  "allowed": true,
  "trial_start_utc": 1704067200,
  "message": "Trial active, 7 days remaining"
}
```

## Tech Stack

- **Next.js 16** - App Router with Turbopack
- **React 19** - With React Compiler
- **better-auth** - Authentication
- **Polar.sh** - Payments and licensing
- **Drizzle ORM** - Database
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - Components

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:generate` | Generate migrations |
| `bun run db:migrate` | Run migrations |
| `bun run db:push` | Push schema (dev) |
| `bun run db:studio` | Open Drizzle Studio |
