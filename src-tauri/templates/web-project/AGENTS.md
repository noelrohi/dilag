# AGENTS.md

Vite + React 19 + TanStack Router + Tailwind CSS v4 web app.

## Stack

- **Vite 6** - Dev server & build
- **React 19** - UI framework
- **TanStack Router** - File-based routing
- **Tailwind CSS v4** - Styling with CSS theme variables
- **Solar Icons** - Icons (`@solar-icons/react`)

## Structure

```
src/
├── routes/           # File-based routing (TanStack Router)
│   ├── __root.tsx    # Root layout with ErrorBoundary
│   ├── index.tsx     # Home page (/)
│   └── about.tsx     # /about (example)
├── components/       # Reusable components
│   └── error-boundary.tsx  # Catches React errors
├── index.css         # Tailwind + theme variables
└── main.tsx          # App entry point
```

## Adding Pages

Create a file in `src/routes/`:

```tsx
// src/routes/settings.tsx -> /settings
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return <div>Settings</div>;
}
```

Nested routes use folders:
- `src/routes/dashboard/index.tsx` -> `/dashboard`
- `src/routes/dashboard/stats.tsx` -> `/dashboard/stats`

## Styling

Use Tailwind utility classes. Theme colors are CSS variables:

```tsx
// Use semantic color tokens
<div className="bg-background text-foreground">
<div className="bg-card text-card-foreground">
<button className="bg-primary text-primary-foreground">
<span className="text-muted-foreground">
```

Available colors: `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`

Radius tokens: `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`

## Icons

Solar Icons with `weight` prop for style variants:

```tsx
import { House, Settings, User } from "@solar-icons/react";

<House size={20} />                    // Default weight
<House size={20} weight="Linear" />    // Outline style
<House size={20} weight="Bold" />      // Filled style
<Settings size={20} weight="Outline" />
<User size={20} weight="BoldDuotone" />
```

Weights: `Linear`, `Bold`, `Outline`, `Broken`, `LineDuotone`, `BoldDuotone`

Browse icons by category: `users`, `building`, `settings`, `arrows`, `ui`, `notifications`, etc.

## Patterns

```tsx
// Conditional classes
<div className={`p-4 ${isActive ? "bg-primary" : "bg-muted"}`}>

// Component with variants
function Button({ variant = "default", children }) {
  const styles = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    ghost: "hover:bg-muted",
  };
  return <button className={`px-4 py-2 rounded-lg ${styles[variant]}`}>{children}</button>;
}
```

## Commands

```bash
bun run dev      # Start dev server
bun run build    # Production build
```
