# Changelog

All notable changes to Dilag will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-07

### Added

- **Web Preview Mode**: Live Vite dev server integration with hot module replacement
- **Browser Frame**: Embedded iframe preview with viewport controls (Desktop/Tablet/Mobile)
- **Build Agent**: New skill-based agent for web application generation
- **Web Project Template**: Bundled Vite + React + TanStack Router + Tailwind CSS template
- **Error Boundary**: Runtime error catching in generated web projects
- **Bun Dependency Check**: Setup wizard now verifies Bun installation
- **Skill Tool**: Added frontend-design skill to tool registry
- **Session Title Sync**: Automatically sync titles from OpenCode via SSE events
- **Test Infrastructure**: Added Vitest with HappyDOM for component testing

### Changed

- **Architecture Shift**: Moved from mobile design canvas to web app builder
- **Agent System**: Replaced designer/web-designer agents with unified build agent
- **UI Copy**: Updated terminology from "design" to "build" throughout
- **Landing Page**: Redesigned suggestion buttons with color gradients
- **Project Cards**: Simplified layout with relative timestamps ("2h ago")
- **Empty States**: Streamlined placeholder text across views
- **Icon Library**: Switched web template from Lucide to Solar Icons

### Removed

- Mobile design canvas and iPhone frames
- DraggableScreen and MobileFrame components
- DesignCanvas infinite canvas with pan/zoom
- HTML file polling (replaced by Vite HMR)
- Designer agent prompt (replaced by skill system)

### Fixed

- Template path resolution now prioritizes dev paths for local development
- Session status updates are more reliable via SSE event subscription

## [0.0.16] - 2024-12-XX

- Previous mobile UI design studio release
