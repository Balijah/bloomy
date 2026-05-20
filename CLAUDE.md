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
pnpm --filter @workspace/db push               # drizzle-kit push schema to DB
pnpm --filter @workspace/db push-force         # force push (drops conflicting columns)
```

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
