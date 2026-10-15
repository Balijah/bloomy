# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Bloomy** is a weather and agricultural intelligence platform for growers. It is a pnpm monorepo deployed on Replit, consisting of:

- `artifacts/api-server` — Express 5 REST API (Node.js/TypeScript)
- `artifacts/bloomy-web` — React + Vite web frontend (TypeScript)
- `artifacts/bloomy-mobile` — Expo/React Native mobile app (TypeScript)
- `lib/db` — Drizzle ORM schema and PostgreSQL client (`@workspace/db`)
- `lib/api-spec` — OpenAPI spec (`openapi.yaml`) and Orval codegen config
- `lib/api-client-react` — Generated React Query hooks from OpenAPI (`@workspace/api-client-react`)
- `lib/api-zod` — Generated Zod validators from OpenAPI (`@workspace/api-zod`)
- `scripts/` — Utility scripts (run with `tsx`)

## Commands

All commands use `pnpm`. Run from the workspace root unless noted.

### API Server (`artifacts/api-server`)
```bash
pnpm --filter @workspace/api-server dev        # build + start in dev mode
pnpm --filter @workspace/api-server build      # esbuild bundle to dist/
pnpm --filter @workspace/api-server typecheck  # tsc type check
```

### Web Frontend (`artifacts/bloomy-web`)
```bash
pnpm --filter @workspace/bloomy-web dev        # Vite dev server on 0.0.0.0
pnpm --filter @workspace/bloomy-web build      # Vite production build
pnpm --filter @workspace/bloomy-web typecheck  # tsc type check
```

### Mobile App (`artifacts/bloomy-mobile`)
```bash
pnpm --filter @workspace/bloomy-mobile dev     # Expo dev server (Replit-specific env vars set)
pnpm --filter @workspace/bloomy-mobile typecheck  # tsc type check (skip during deploy)
```

### Database (`lib/db`)
```bash
pnpm --filter @workspace/db generate           # generate SQL migration from schema changes
pnpm --filter @workspace/db migrate            # apply pending migrations to DB (production)
pnpm --filter @workspace/db push               # push schema directly to DB (dev only)
pnpm --filter @workspace/db studio             # open Drizzle Studio for DB inspection
```

#### Migration Workflow (Production)
1. Edit schema files in `lib/db/src/schema/`
2. Run `pnpm --filter @workspace/db generate` to create a migration in `lib/db/migrations/`
3. Review the generated SQL — **commit it to git**
4. Deploy and run `pnpm --filter @workspace/db migrate` to apply
5. **Rollback**: write a reverse migration SQL and apply it manually, or restore from backup

#### First deployment to an existing database
Do not run the initial migration against an existing `drizzle-kit push` database.
Back up the database, then compare its tables, columns, defaults, and constraints
with `lib/db/migrations/0000_baseline.sql`. Resolve any differences first.
Only once they match, run:
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/baseline.sql
pnpm --filter @workspace/db migrate
```
The baseline records the old schema without changing application data. The next
migration creates `stripe_events`. Fresh databases need only `migrate`. Never
baseline a fresh database or a database with existing migration history.
CI tests both paths and repeats migrations to check that they are safe to rerun.

#### Dev Workflow
Use `pnpm --filter @workspace/db push` for rapid iteration (directly syncs schema to DB without migration files).

### API Codegen (`lib/api-spec`)
```bash
pnpm --filter @workspace/api-spec codegen      # regenerate api-client-react + api-zod from openapi.yaml
```

## Architecture

### Data Flow
1. **Schema** is defined in `lib/db/src/schema/` using Drizzle ORM tables
2. **API contract** is defined in `lib/api-spec/openapi.yaml`
3. **Codegen** (`orval`) generates React Query hooks → `lib/api-client-react/src/generated/` and Zod validators → `lib/api-zod/src/generated/`
4. **API server** implements routes in `artifacts/api-server/src/routes/`, validates with Zod from `@workspace/api-zod`, queries DB via `@workspace/db`
5. **Web/Mobile** clients import hooks from `@workspace/api-client-react` — never call fetch directly

### Key Patterns

**Never edit generated files** in `lib/api-client-react/src/generated/` or `lib/api-zod/src/generated/`. Edit `openapi.yaml` and run codegen.

**Authentication** uses Clerk. The API server applies `@clerk/express` middleware. The web frontend uses `@clerk/react` with wouter for routing. Clerk proxy middleware is at `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts`.

**Database** (`lib/db/src/index.ts`) exports a singleton `db` (Drizzle) and `pool` (pg.Pool). Each schema file also exports insert schemas (via `drizzle-zod`) and TypeScript types. Requires `DATABASE_URL` env var.

**API Server** uses Express 5 with pino for logging. All routes are mounted under `/api` (via the web frontend's Vite proxy). The server bundles with esbuild (`build.mjs`) into `dist/index.mjs`. Requires `PORT` env var.

**Web frontend** uses wouter for routing, TanStack Query for server state, shadcn/ui components (Radix + Tailwind v4), and Clerk for auth. Route is protected via `<Show when="signed-in">` pattern. Path alias `@/` maps to `src/`.

**Mobile app** (`artifacts/bloomy-mobile`) uses Expo Router (file-based routing under `app/`). Components in `components/` mirror the web feature cards. Platform-specific files use `.web.tsx` suffix (e.g., `FarmMap.web.tsx`, `LocationPicker.web.tsx`).

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `PORT` — API server port
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` — Clerk auth
- `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PROXY_URL` — Clerk for web
- `SENDGRID_API_KEY` — Email (weekly digest)
- `STRIPE_SECRET_KEY` — Subscriptions

### Supply Chain Security
`pnpm-workspace.yaml` enforces `minimumReleaseAge: 1440` (packages must be 1 day old before install). Do not disable this. Add exceptions only to `minimumReleaseAgeExclude`.

### Dependency audit baseline
`node scripts/check-audit.mjs` reports all audit severity totals and fails on new
high/critical advisory + installed-version pairs, registry errors, or invalid
reports. `scripts/security-audit-baseline.json` records existing unresolved debt
as of 2026-10-15; it is not a clean security audit. Do not automatically refresh
it to make CI green. Update dependencies to remove findings; assess any new
finding before merging. Some existing advisories have no patched release.
