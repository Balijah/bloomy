# Bloomy

**Precision agricultural intelligence for mid-scale crop farmers.**

Plan input costs, forecast yields, model crop insurance, and track growing conditions — all from the field.

---

## The Problem

Farmers evaluate expensive seed, fertilizer, and chemical purchase agreements without independent benchmarks for whether their field-level costs and projected margins are in line with regional peers. A 500–5,000 acre Midwest operation signing a fertilizer contract mid-season has no easy way to know if they're above or below the peer range — until after the contract is signed.

---

## What Bloomy Does

**Benchmark Planner** — Compare per-acre input costs and projected margins against anonymized Iowa/Corn Belt peer data (USDA ERS, 500–5,000 acre operations). Adjust seed, fertilizer, chemicals, yield, and crop price — margin and peer-comparison status updates live before you sign.

**Yield Forecast** — GDD-based yield range estimates across 10 crop types, with stage-based confidence intervals that tighten as the season progresses. Stress penalties applied for frost, heat, drought, and harvest disruption risk.

**Crop Insurance Calculator** — All three USDA RMA plan types (RP, RPHPE, YP) with indemnity scenarios at low/mid/high forecast yield, net farm position, and total liability.

**Spray Window Planner** — Multi-factor daily scoring for herbicide, pre-emergent, pesticide, and foliar application across a 7-day forecast. Accounts for wind, temperature, humidity, precipitation, and temperature inversion risk.

**Risk Alerts** — Automated weather risk detection (frost, heat stress, drought, high wind, hail, harvest disruption) with 12-hour throttle to prevent alert fatigue. Weekly digest emails via SendGrid; push notifications via Expo.

**Field Notes & Reports** — GPS-based farm location tracking, severity-tagged scouting logs, and shareable PDF crop reports.

---

## Platforms

| Platform | Stack |
|----------|-------|
| Web | React + Vite + Tailwind v4 + shadcn/ui |
| Mobile | Expo SDK 54 / React Native (iOS + Android via EAS Build) |

---

## Subscription Tiers

| Plan | Price | Includes |
|------|-------|---------|
| Free | $0/mo | 7-day forecast, 1 location, basic weather |
| Grower | $19/mo | 15-day forecast, 6-hourly data, agriculture dashboard, email alerts, 3 farm locations |
| Grower Pro | $39/mo | Everything in Grower + 5 farm locations, priority support |

---

## Getting Started

### Prerequisites

- [Node.js 22+](https://nodejs.org/) (LTS recommended)
- [pnpm 10+](https://pnpm.io/)
- PostgreSQL 16+ database

### Environment Variables

Copy the example file and fill in your values:

```sh
cp .env.example .env
```

**Required for the API server:**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Port for the Express API server (e.g. `8080`) |
| `CLERK_SECRET_KEY` | Server-side Clerk secret key ([dashboard.clerk.com](https://dashboard.clerk.com)) |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |

**Required for the web frontend (baked into the Vite build):**

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Same as `CLERK_PUBLISHABLE_KEY` |
| `VITE_CLERK_PROXY_URL` | Clerk proxy URL, e.g. `https://your-domain.com/api/__clerk` |

**Optional (features degrade gracefully without them):**

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key for subscription checkout |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_GROWER` | Stripe Price ID for the Grower plan |
| `STRIPE_PRICE_GROWER_PRO` | Stripe Price ID for the Grower Pro plan |
| `SENDGRID_API_KEY` | SendGrid API key for weekly digest emails |
| `SENDGRID_FROM_EMAIL` | Verified sender email for digest emails |
| `APP_URL` | Base URL of the web app (used in email links, Stripe return URLs) |
| `CORS_ORIGIN` | Comma-separated allowed origins (defaults to same-origin in production) |

See `.env.example` for the full list including mobile-specific variables.

### Setup

```sh
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Configure environment
cp .env.example .env
# Edit .env with your values (see table above)

# 3. Set up the database
# For development (direct schema push, no migration files):
pnpm --filter @workspace/db push

# For production (applies committed migration files):
pnpm --filter @workspace/db migrate

# 4. Start the API server
pnpm --filter @workspace/api-server dev

# 5. Start the web frontend
pnpm --filter @workspace/bloomy-web dev

# 6. (Optional) Start the mobile app
pnpm --filter @workspace/bloomy-mobile dev
```

### Deploy to Render

A `render.yaml` Blueprint is included. Connect this repo to [Render](https://render.com), create a new Blueprint, and set the env vars marked `sync: false` in the Render dashboard before the first deploy.

```sh
# Production build (used by render.yaml buildCommand)
pnpm run build:deploy

# Production start (used by render.yaml startCommand)
pnpm run start:deploy
```

The production API server serves the built web frontend from `artifacts/bloomy-web/dist/public/` when `NODE_ENV=production`.

---

## Running Tests

```sh
# All tests (119 across 3 packages)
pnpm test

# Benchmark Planner financial math (web — 54 tests)
pnpm --filter @workspace/bloomy-web test

# Yield forecast + crop insurance math (mobile lib — 43 tests)
pnpm --filter @workspace/bloomy-mobile test

# API server (auth, billing, tier enforcement, webhooks — 22 tests)
pnpm --filter @workspace/api-server test
```

---

## Architecture

```
artifacts/
  bloomy-web/       — React + Vite web frontend (Tailwind v4, shadcn/ui)
  bloomy-mobile/    — Expo + React Native mobile app (Expo Router v6)
  api-server/       — Express 5 REST API (pino, Zod v4)
lib/
  api-spec/         — OpenAPI spec (openapi.yaml) + Orval codegen config
  api-client-react/ — Generated React Query hooks (@workspace/api-client-react)
  api-zod/          — Generated Zod validation schemas
  db/               — Drizzle ORM schema + PostgreSQL client (@workspace/db)
```

**Data flow:** Drizzle schema → OpenAPI spec → Orval codegen → typed React Query hooks → web/mobile clients. Type-safe API contracts between frontend and backend eliminate entire categories of runtime errors.

### Security

- **Authentication**: Clerk (server middleware + web/mobile SDKs)
- **Rate limiting**: `express-rate-limit` on all `/api` routes (300 req/15 min, healthcheck exempt)
- **Security headers**: Helmet (HSTS, X-Content-Type-Options, X-Frame-Options, etc.)
- **CORS**: Allowlist-based via `CORS_ORIGIN` env var (rejects all cross-origin in production if not set)
- **Body size limits**: 1 MB max JSON/URL-encoded payloads
- **Row-level authorization**: All queries scoped to authenticated user's ID
- **Stripe webhooks**: Signature verification via `stripe.webhooks.constructEvent()`
- **Supply chain security**: `pnpm minimumReleaseAge: 1440` (packages must be published ≥1 day before install)

### Database Migrations

For production, use the migration workflow (not `push`):

```sh
# 1. Edit schema files in lib/db/src/schema/
# 2. Generate migration SQL
pnpm --filter @workspace/db generate
# 3. Review and commit the migration
# 4. Apply on deploy
pnpm --filter @workspace/db migrate
```

---

## Domain Computation Modules

14 pure-TypeScript computation modules in `artifacts/bloomy-mobile/lib/`:

| Module | What it computes |
|--------|-----------------|
| `benchmarkPlanner.ts` | Per-acre cost benchmarking, margin vs. peer range, scenario modeling |
| `insuranceMath.ts` | USDA RP/RPHPE/YP indemnity, net farm position, total liability |
| `yieldForecast.ts` | GDD-based yield range, 10 crop types, stage confidence, stress penalties |
| `sprayWindow.ts` | Multi-factor application scoring: wind, temperature, humidity, inversion |
| `cropStages.ts` | GDD-based growth stage progression per crop |
| `plantingCalendar.ts` | Days in field, GDD progress bar, projected harvest date |
| `diseaseRisk.ts` | Disease pressure scoring from temperature/humidity/precipitation |
| `frostRisk.ts` | Frost probability and freeze severity classification |
| `irrigation.ts` | Soil moisture deficit and irrigation scheduling |
| `soilHealth.ts` | Composite soil health scoring from multiple factors |

Unit tests cover core financial and insurance calculations:
- `artifacts/bloomy-web/src/lib/__tests__/` (54 tests)
- `artifacts/bloomy-mobile/lib/__tests__/` (43 tests)
- `artifacts/api-server/src/__tests__/` (22 tests)

---

## Tech Stack

- **Monorepo**: pnpm workspaces, OpenAPI → typed client codegen (Orval)
- **Web**: React 19, Vite 7, Tailwind v4, TanStack Query v5, shadcn/ui, Wouter, Clerk
- **Mobile**: Expo SDK 54, React Native 0.81, Expo Router v6, Clerk
- **API**: Express 5, TypeScript, Zod v4, pino
- **Database**: PostgreSQL, Drizzle ORM, drizzle-zod
- **Payments**: Stripe (Grower $19/mo, Grower Pro $39/mo)
- **Email**: SendGrid (weekly digest)
- **Weather**: [Open-Meteo API](https://open-meteo.com/) (free tier, no key required)
- **CI**: GitHub Actions (typecheck, test, build, security audit)

---

## Commands Reference

```sh
pnpm run typecheck              # Typecheck all packages
pnpm test                       # Run all tests
pnpm run build:deploy           # Production build (API + web)

pnpm --filter @workspace/api-spec run codegen    # Regenerate API hooks/schemas from openapi.yaml
pnpm --filter @workspace/db push                 # Push DB schema (dev only)
pnpm --filter @workspace/db generate             # Generate migration SQL
pnpm --filter @workspace/db migrate              # Apply migrations (production)
```

---

## License

MIT
