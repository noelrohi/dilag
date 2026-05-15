# Dilag

> AI-powered design studio for mobile and web. Describe your app in natural language and watch AI design production-ready screens in real-time.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Electron](https://img.shields.io/badge/Built%20with-Electron-47848f?logo=electron)](https://www.electronjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178c6?logo=typescript)](https://www.typescriptlang.org)

![Dilag - AI Design Studio](../web/public/hero-dark.png)

## Overview

Dilag is a desktop application that transforms ideas into polished mobile and web designs. Simply describe what you want to design—"a habit tracking app," "a recipe finder with search"—and AI generates production-ready screens as HTML files. Iterate in real-time by chatting with the AI to refine and improve your designs.

Perfect for:

- 🚀 Rapid prototyping and UI design
- 💡 Turning ideas into polished screens without design tools
- 🔄 Iterating on designs through conversation
- 📱 Mobile and web screen generation
- ⚡ Accelerating the idea-to-design workflow

## Features

✨ **Natural Language Design** – Describe your app and get polished UI screens

🖥️ **Live Preview** – See your designs rendered in real-time on an infinite canvas

💬 **Iterative Design** – Chat with AI to refine and improve your screens

🤖 **Multi-Model Support** – Choose from Claude, GPT, Gemini, and more

📚 **Project History** – Save, organize, and revisit all your designs

🎨 **Production-Ready Output** – Generated screens use Tailwind CSS and modern HTML

## Quick Start

### Prerequisites

- **Node.js** 18+ and **Bun**
- **VS Code** (recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/noelrohi/dilag.git
cd dilag

# Install dependencies
bun install

# Start the desktop app
bun run dev
```

### Development Commands

```bash
# Vite dev server (frontend only)
bun run dev

# Full Electron app
bun run dev

# Type checking
bun run typecheck

# Production build
bun run build
```

## Architecture

### Frontend Stack

- **React 19** – UI framework
- **TypeScript** – Type safety
- **Vite** – Build tool
- **Tailwind CSS** – Styling
- **shadcn/ui** – Component library (Radix UI based)
- **Zustand** – Client state management
- **React Query** – Server state management
- **TanStack Router** – File-based routing

### Backend Stack

- **Electron** – Desktop runtime and native host
- **Pi SDK** – Embedded coding-agent runtime

### Data Flow

```
User Prompt
    ↓
Session Creation
    ↓
AI Processing (Pi)
    ↓
Screen Generation (HTML + Tailwind)
    ↓
Live Preview on Canvas
    ↓
Iterative Refinement via Chat
```

## Project Structure

```
dilag/
├── src/                          # React frontend
│   ├── components/
│   │   ├── ai-elements/         # Chat and AI UI components
│   │   ├── blocks/              # Page layouts and sections
│   │   └── ui/                  # shadcn/ui primitives
│   ├── context/
│   │   ├── global-events.tsx    # Agent event provider
│   │   └── session-store.tsx    # Zustand store
│   ├── hooks/
│   │   ├── use-designs.ts       # Design file polling
│   │   ├── use-models.ts        # Model selection
│   │   └── use-sessions.ts      # Session management
│   ├── routes/
│   │   ├── index.lazy.tsx       # Home screen
│   │   └── studio.$sessionId.lazy.tsx # Design studio
│   └── lib/
│       ├── tool-registry.tsx    # Tool display configs
│       └── utils.ts             # Utilities
├── electron/                     # Electron main/preload host
│   ├── ipc/                     # Native IPC handlers
│   ├── main.ts                  # Main process entry
│   └── preload.ts               # Preload bridge
├── docs/
│   ├── architecture.md          # Technical architecture
│   └── platform.md              # UI and platform docs
└── package.json
```

## Usage

### Creating Your First Design

1. **Launch the app** and land on the home screen
2. **Describe your app** in the prompt box:
   ```
   A habit tracking app with a dashboard showing daily streaks,
   a habit list, and settings page
   ```
3. **Select your AI model** (Claude, GPT, etc.)
4. **Hit submit** and watch your screens get designed in real-time
5. **Iterate** by chatting with the AI to refine your designs

### Working with Designs

- **Live Preview** – Your screens render on an infinite canvas
- **Viewport Modes** – Switch between desktop, tablet, and mobile views
- **Iterate** – Type in the chat pane to refine designs or add screens
- **Auto-Save** – All designs are automatically saved locally

## Data Storage

Dilag stores everything locally on your machine:

```
~/.dilag/
├── state.sqlite               # Project registry and app state
├── skills/                    # Dilag design skills loaded by Pi
└── pi/
    ├── auth.json              # Pi provider credentials
    └── sessions/              # Pi JSONL session data keyed by project cwd

{project-cwd}/
└── .designs/**/*.html         # Generated HTML screens
```

Sensitive data for the embedded Pi runtime is stored under `~/.dilag/pi/` and generated screens are stored in the project cwd.

## Development

### Code Style Guide

```typescript
// Imports: Use @/* alias for src/*
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Components: Function components with TypeScript
export function MyComponent({ prop }: { prop: string }) {
  return <div className={cn("base", "class")} />
}

// Naming conventions
// - Components: PascalCase (MyComponent.tsx)
// - Functions: camelCase (myFunction)
// - Files: kebab-case (my-component.tsx)
// - CSS: Tailwind with cn() utility
```

### Type Checking

```bash
tsc --noEmit
```

### Adding New Features

1. Check `../../docs/architecture.md` for current data flow
2. Update Zustand store if adding new state
3. Create components in appropriate `src/components/*` folder
4. Use `@/*` imports and TypeScript types
5. Test type checking: `tsc --noEmit`

## Documentation

- **[Platform Docs](../../docs/platform.md)** – UI screens, components, user flows, tool registry
- **[Architecture Docs](../../docs/architecture.md)** – App startup, storage, agent events, session lifecycle
- **[AGENTS.md](./AGENTS.md)** – Development setup and conventions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Server won't start

```bash
# Clear cached data
rm -rf ~/.dilag/pi
bun run dev
```

### Preview not loading

1. Check that Bun is installed (`bun --version`)
2. Check `{project-cwd}/.designs/` for generated HTML files
3. Check browser console for errors (DevTools in Electron dev mode)

## License

MIT © 2024-2026 Dilag

## Acknowledgments

- [Electron](https://www.electronjs.org) – Desktop runtime
- [Pi](https://github.com/earendil-works/pi) – Embedded coding-agent runtime
- [shadcn/ui](https://ui.shadcn.com) – Component library
- [React](https://react.dev) – UI framework

---

**Made with ❤️ for designers and developers**
