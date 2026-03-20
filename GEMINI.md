# GEMINI.md - ucloudsync

## Project Overview
**ucloudsync** is a Cloudflare Workers application designed to synchronize academic assignments from the **BUPT UCloud** platform to **Dida365 (TickTick)**. It provides a web interface for users to authenticate with both platforms and configure synchronization settings.

### Key Technologies
- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) (Node.js compatibility enabled)
- **Web Framework**: [Hono](https://hono.dev/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite-based)
- **Authentication**: `@byrdocs/bupt-auth` (for BUPT UCloud) and OAuth 2.0 (for Dida365)
- **Tooling**: [Wrangler](https://developers.cloudflare.com/workers/wrangler/), [Biome](https://biomejs.dev/) (linting/formatting), [Vitest](https://vitest.dev/) (testing)

## Architecture
The project follows a service-oriented structure:
- **`src/index.ts`**: The main entry point. It defines the Hono application for the web UI, handles OAuth callbacks, and implements the `scheduled` handler for periodic synchronization.
- **`src/services/sync.ts`**: Contains the core business logic for the synchronization process, including fetching undone assignments from UCloud, mapping them to Dida365 tasks, and updating the local D1 database.
- **`src/adapters/`**: contains adapters for external services.
    - `ticktick.ts`: Client for interacting with the Dida365 (TickTick) Open API.
- **`src/clients/`**:
    - `ucloud.ts`: Client for interacting with the BUPT UCloud internal API.
- **`src/types/`**: TypeScript definitions for API requests and responses.
- **`migrations/`**: SQL files for managing the D1 database schema.

### Database Schema
- **`users`**: Stores user credentials (encrypted/secured by Cloudflare), tokens, and sync preferences.
- **`synced_tasks`**: Tracks the mapping between UCloud activity IDs and Dida365 task IDs to prevent duplicates and handle status updates.

## Building and Running

### Development
To start the local development server with support for testing scheduled events:
```bash
npm run dev
```

### Deployment
To deploy the worker to Cloudflare:
```bash
npm run deploy
```

### Type Generation
After modifying `wrangler.jsonc` bindings, regenerate TypeScript types:
```bash
npm run cf-typegen
```

### Linting and Formatting
The project uses Biome for code quality:
```bash
npm run check  # Lint, format, and fix
npm run format # Format only
npm run lint   # Lint only
```

### Testing
Run the test suite using Vitest:
```bash
npx vitest
```

## Development Conventions
- **Functional Components**: UI is rendered using Hono's `html` template literal with functional components.
- **Error Handling**: Use `try/catch` blocks around API calls, especially in the sync service, to ensure one user's failure doesn't stop the entire sync process.
- **Database Operations**: Prefer prepared statements using the `DB` binding (D1Database).
- **Date Formatting**: TickTick requires a specific ISO-8601-like format (`yyyy-MM-dd'T'HH:mm:ssZ`), handled by `formatTickTickDate` in `src/adapters/ticktick.ts`.
- **Scheduled Tasks**: The sync runs every 3 hours as defined in `wrangler.jsonc`. Ensure any heavy operations are handled within `ctx.waitUntil`.

## Important Documentation Links
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Hono Documentation](https://hono.dev/docs/)
- [Dida365 API Reference](https://developer.dida365.com/docs/)
