# @dilag/shared

Shared TypeScript types for the Dilag monorepo.

## Installation

This package is automatically available to other workspace packages:

```json
{
  "dependencies": {
    "@dilag/shared": "workspace:*"
  }
}
```

## Usage

```typescript
import type { 
  TrialRegisterRequest, 
  TrialRegisterResponse,
  TrialCheckRequest,
  TrialCheckResponse 
} from "@dilag/shared"
```

## Types

### Trial API

Types for the trial registration API between desktop app and web server:

| Type | Description |
|------|-------------|
| `TrialRegisterRequest` | Request to register a device trial |
| `TrialRegisterResponse` | Response with trial status |
| `TrialCheckRequest` | Request to check trial status |
| `TrialCheckResponse` | Response with trial details |

## Development

```bash
# From monorepo root
bun install

# Types are exported from src/index.ts
```
