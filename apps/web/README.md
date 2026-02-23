# @dilag/web

Next.js marketing website for Dilag.

## Features

- Public marketing pages
- Download page
- FAQ, Privacy, Terms, Cookies pages
- Legacy API endpoints return `410 Gone`
- Legacy auth/app URLs redirect to `/download`

## Setup

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- @dilag/ui

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
