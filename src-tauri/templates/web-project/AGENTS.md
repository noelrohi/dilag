# AGENTS.md

**Generated:** 2025-01-10 | **Project:** web-project (Vite + React + TanStack Router + Tailwind v4)

## Overview

Vite 6 + React 19 + TanStack Router + Tailwind CSS v4 web app template. This is a generated project template for Dilag's mobile UI design studio.

## Tech Stack

- **Vite 6.0.0** - Dev server & build tool
- **React 19.0.0** - UI framework with TypeScript 5.7.2
- **TanStack Router 1.93.0** - File-based routing with auto code splitting
- **Tailwind CSS v4.0.0** - Utility-first CSS with CSS theme variables
- **Lucide React 0.469.0** - Icon library

## Build/Test/Lint Commands

```bash
# Development
bun run dev              # Start Vite dev server (port 5173)
bun run build            # Production build (tsc -b && vite build)
bun run preview          # Preview production build locally

# Type Checking (PRIMARY validation)
tsc --noEmit             # TypeScript type check (no lint configured)

# Testing
bun test                 # Run Vitest tests (if test files exist)
bun test --run           # Single run mode
bun test --coverage      # Generate coverage report
```

**Important:** No ESLint/Prettier configured. Use `tsc --noEmit` for all type validation before completing tasks.

## Project Structure

```
web-project/
├── src/
│   ├── routes/              # File-based routing (TanStack Router)
│   │   ├── __root.tsx       # Root layout with ErrorBoundary
│   │   ├── index.tsx        # Home page (/)
│   │   └── about.tsx        # /about (example)
│   ├── components/          # Reusable components
│   │   └── error-boundary.tsx  # React error boundary
│   ├── index.css            # Tailwind + theme variables
│   ├── main.tsx             # App entry point
│   └── routeTree.gen.ts     # Auto-generated route tree
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript config (strict mode)
├── vite.config.ts           # Vite config with plugins
└── AGENTS.md               # This file
```

## Code Style Guidelines

### Imports

**ALWAYS use relative imports** (this is a standalone template, not the main Dilag project):

```typescript
// React/core imports first
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { type ReactNode } from "react"

// Third-party libraries
import { createFileRoute } from "@tanstack/react-router"
import { Home, Settings, User } from "lucide-react"

// Internal imports (relative)
import { ErrorBoundary } from "./components/error-boundary"
```

**Import Ordering:**
1. React/core imports
2. Third-party libraries  
3. Internal relative imports

### Components

**Function components with TypeScript interfaces:**

```typescript
import { type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  className?: string
}

export function MyComponent({ 
  children, 
  fallback, 
  className = "",
  ...props 
}: Props & React.ComponentProps<"div">) {
  return (
    <div className={`base-styles ${className}`} {...props}>
      {children || fallback}
    </div>
  )
}
```

### Naming Conventions

| Type | Convention | Examples |
|------|------------|----------|
| Files | kebab-case | `error-boundary.tsx`, `my-component.tsx` |
| Components | PascalCase | `ErrorBoundary`, `MyComponent` |
| Functions/Variables | camelCase | `handleSubmit`, `isLoading` |
| Hooks | `use` prefix | `useData`, `useAuth` |
| Types/Interfaces | PascalCase | `Props`, `SessionData` |
| Constants | UPPER_SNAKE_CASE | `API_BASE_URL`, `DEFAULT_TIMEOUT` |

### Exports

```typescript
// Components - named exports
export function Button() { }
export type ButtonProps = { }

// Routes - export Route object
export const Route = createFileRoute("/")({ component: HomePage })

// Types - named exports
export type SessionStatus = "idle" | "loading" | "error"

// Utilities - named exports
export function formatBytes(bytes: number) { }
export const API_URL = "https://api.example.com"
```

**Default exports:** Only for route page components, not for reusable components.

### TypeScript Patterns

**Strict mode configuration:**
```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

**Component props pattern:**
```typescript
// Extend native element props when appropriate
interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: "primary" | "secondary"
  loading?: boolean
}

// Use intersection for custom props
interface CardProps {
  title: string
  children: ReactNode
}
```

**Union types for variants:**
```typescript
type Status = "idle" | "loading" | "success" | "error"
type Theme = "light" | "dark" | "system"
```

### Error Handling

**Try-catch with type checking:**
```typescript
async function fetchData(): Promise<Data> {
  try {
    const response = await fetch("/api/data")
    return await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("Failed to fetch data:", message)
    throw new Error(`Failed to fetch data: ${message}`)
  }
}
```

**Error boundaries:**
```typescript
export class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo)
  }
}
```

## Styling with Tailwind v4

### Theme Variables

**Use semantic color tokens:**
```tsx
<div className="bg-background text-foreground">
<div className="bg-card text-card-foreground">
<button className="bg-primary text-primary-foreground">
<span className="text-muted-foreground">
```

**Available colors:** `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`

**Radius tokens:** `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`

### Component Styling

**Conditional classes:**
```tsx
<div className={`p-4 ${isActive ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
```

**Variant patterns:**
```tsx
function Button({ variant = "default", children, className = "" }: ButtonProps) {
  const variants = {
    default: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
    ghost: "hover:bg-muted text-muted-foreground"
  }
  
  return (
    <button className={`px-4 py-2 rounded-lg transition-colors ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}
```

### Icons

**Lucide React imports:**
```tsx
import { Home, Settings, User, ChevronRight, Search, Plus, X } from "lucide-react"

<Home size={20} />
<Settings size={20} strokeWidth={1.5} />
<User className="text-muted-foreground" />
<ChevronRight className="size-4" />
```

**Common icons:** `Home`, `Settings`, `User`, `Search`, `Menu`, `X`, `Plus`, `Minus`, `Check`, `ChevronLeft/Right/Up/Down`, `ArrowLeft/Right`, `Mail`, `Bell`, `Heart`, `Star`, `Trash`, `Edit`, `Copy`, `Download`, `Upload`, `Filter`, `Calendar`, `Clock`, `Eye`, `EyeOff`, `Lock`, `Unlock`

## Routing with TanStack Router

### File-based Routing

**Route structure:**
```tsx
// src/routes/settings.tsx -> /settings
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  return <div>Settings</div>
}
```

**Nested routes:**
```tsx
// src/routes/dashboard/index.tsx -> /dashboard
// src/routes/dashboard/stats.tsx -> /dashboard/stats
// src/routes/users/$userId.tsx -> /users/:userId
```

### Route Patterns

**Route with parameters:**
```tsx
export const Route = createFileRoute("/users/$userId")({
  component: UserPage,
  loader: ({ params }) => fetchUser(params.userId),
})

function UserPage() {
  const { userId } = Route.useParams()
  const user = Route.useLoaderData()
  // ...
}
```

**Lazy-loaded routes:**
```tsx
export const Route = createFileRoute("/heavy-page")({
  component: lazy(() => import("./heavy-page").then(m => ({ default: m.HeavyPage }))),
})
```

## Development Workflow

### Adding Features

1. **Create route:** Add file in `src/routes/`
2. **Add component:** Create in `src/components/`
3. **Type check:** Run `tsc --noEmit`
4. **Test:** Run `bun test` if tests exist
5. **Build:** Run `bun run build` to verify production build

### Before Completing Work

**CRITICAL:** Always run `bun run build` before finishing any task to catch errors:

1. Run `bun run build`
2. If build fails, fix all errors (TypeScript, import issues, etc.)
3. Re-run build until it succeeds
4. Only then consider the task complete

**Common build issues to watch for:**
- Missing imports or typos in component names
- TypeScript type errors
- Unused variables (treated as errors in strict mode)
- Invalid JSX syntax
- Missing route exports

## Testing (Optional)

**If tests are added:**
```bash
bun test                 # Run all tests
bun test --run           # Single run (no watch)
bun test --coverage      # With coverage
bun test my-test.test.ts # Run specific test
```

**Test file pattern:** `src/**/*.test.{ts,tsx}`

**Example test:**
```tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MyComponent } from "./my-component"

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent>Test</MyComponent>)
    expect(screen.getByText("Test")).toBeInTheDocument()
  })
})
```

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| `as any`, `@ts-ignore` | Fix types properly |
| Default exports for components | Use named exports |
| Inline styles | Use Tailwind classes |
| `console.log` in production | Use proper logging |
| Missing error handling | Add try-catch with type checking |
| Hardcoded values | Extract to constants |
| Unused imports | Remove or organize imports |

## Configuration Files

- `tsconfig.json` - TypeScript strict mode configuration
- `vite.config.ts` - Vite with React, Tailwind, and TanStack Router plugins
- `package.json` - Dependencies and build scripts
- `tailwind.config.js` - Not present (uses Tailwind v4 CSS config)

## Browser Support

- Targets modern browsers (ES2020)
- Uses Vite's default browser targets
- No legacy browser support needed