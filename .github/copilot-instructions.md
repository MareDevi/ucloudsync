# Copilot Instructions for `ucloudsync`

## Build, test, and lint commands

This repository does not define a dedicated build script.

- Install deps: `bun install`
- Local dev (includes scheduled trigger testing): `bun run dev`
- Deploy Worker: `bun run deploy`
- Regenerate Worker binding types after `wrangler.jsonc` binding changes: `bun run cf-typegen`
- Lint: `bun run lint`
- Format: `bun run format`
- Biome check + autofix: `bun run check`
- Run all tests: `npx vitest run`
- Run a single test file: `npx vitest run path/to/file.test.ts`
- Run a single test case by name: `npx vitest run -t "test name"`

Useful D1 migration commands from project docs:

- Apply local migrations: `npx wrangler d1 migrations apply ucloudsync_db --local`
- Apply remote migrations: `npx wrangler d1 migrations apply ucloudsync_db --remote`

## High-level architecture

- **Runtime entrypoint**: `src/index.tsx` exports both `fetch` (Hono app) and `scheduled` handler. Manual sync (`/sync`) and cron sync (`triggers.crons` in `wrangler.jsonc`, every 3 hours) both go through `SyncService`.
- **Integration flow**:
  - User logs in with UCloud credentials (`/login`), password is encrypted with `CryptoHelper` before DB storage.
  - User binds TickTick via OAuth (`/oauth/ticktick/*`) and selects a destination project.
  - User can optionally bind Ketangpai via QR flow (`/dashboard/bind-ketangpai` + polling API).
  - Sync engine pulls pending assignments from enabled sources (UCloud and/or Ketangpai) and mirrors them to TickTick.
- **Core sync engine** (`src/services/sync.ts`):
  - Loads all prior mappings from `synced_tasks`.
  - Fetches current TickTick project state once, then reconciles source tasks.
  - Creates/updates TickTick tasks and marks completion when source items are no longer pending.
  - Uses per-user fault isolation (`Promise.allSettled` at multi-user level and per-source `try/catch`) so one failure does not stop global sync.
- **State model** (migrations in `migrations/*.sql`):
  - `users`: auth tokens, encrypted UCloud password, per-source enable flags, sync metadata.
  - `synced_tasks`: source-aware mapping table keyed by `(source, activity_id, user_id)` to prevent duplicate task creation across UCloud/Ketangpai.
- **Service boundaries**:
  - `src/clients/`: source-platform clients (`ucloud.ts`, `ketangpai.ts`)
  - `src/adapters/`: destination adapter (`ticktick.ts`)
  - `src/views/`: server-rendered Hono JSX UI pages
  - `src/utils/`: cross-cutting helpers (date normalization, crypto)

## Key conventions in this codebase

- **Always route sync logic through `SyncService`** instead of adding sync behavior directly in route handlers or scheduled handler.
- **Preserve source identity in sync records** using `source` + `activity_id` + `user_id`; this is foundational for dual-source reconciliation.
- **Keep date handling explicit for China timezone workflows**:
  - Parse UCloud and Ketangpai input with `parseUcloudDate` / `parseKetangpaiDate`.
  - Format outgoing TickTick due dates with `formatTickTickDate` (returns `+0800` format expected by TickTick).
- **UCloud auth is EAFP-style** in sync: try existing token first, then refresh/login only when needed.
- **User-facing toggles are DB-driven flags** (`ucloud_enabled`, `ketangpai_enabled`, `ticktick_enabled`) and sync must respect them.
- **UI is server-rendered with Hono JSX functional components** (`src/views/*`) rather than client-side SPA patterns.
- **Use prepared D1 statements** (`prepare().bind()`) for all DB access, matching existing code patterns.
- **When changing Worker bindings/config, regenerate types** (`bun run cf-typegen`) so `worker-configuration.d.ts` stays aligned.
- **For Cloudflare Worker platform/API work, consult current Cloudflare docs first** (especially product limits pages) before implementing assumptions.
