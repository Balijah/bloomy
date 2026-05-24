# Bloomy

**Precision agricultural intelligence for mid-scale crop farmers.**

Plan input costs, forecast yields, model crop insurance, and track growing conditions — all from the field.

**Live deployment:** https://earth-forecast--burhankhan5.replit.app

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

| Platform | URL |
|----------|-----|
| Web | https://earth-forecast--burhankhan5.replit.app |
| Mobile | Expo/React Native (iOS + Android via EAS Build) |

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

- [Node.js 24+](https://nodejs.org/)
- [pnpm 10+](https://pnpm.io/)
- PostgreSQL database

### Setup

```sh
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Push database schema
pnpm --filter @workspace/db push

# 4. Start the API server
pnpm --filter @workspace/api-server dev

# 5. Start the web frontend
pnpm --filter @workspace/bloomy-web dev

# 6. (Optional) Start the mobile app
pnpm --filter @workspace/bloomy-mobile dev
```

### Verify the deployment

```sh
curl -sS https://earth-forecast--burhankhan5.replit.app/api/healthz
# Expected: {"status":"ok"}
```

---

## Running Tests

```sh
# All tests
pnpm test

# Benchmark Planner financial math (web)
pnpm --filter @workspace/bloomy-web test

# Yield forecast + crop insurance math (mobile lib)
pnpm --filter @workspace/bloomy-mobile test
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

For full architecture detail see [replit.md](./replit.md). For the demo narration and verification commands see [SUBMISSION.md](./SUBMISSION.md).

---

## Domain Computation Modules

The core of Bloomy's value is 14 pure-TypeScript computation modules in `artifacts/bloomy-mobile/lib/` — original domain engineering that requires real agricultural expertise to replicate:

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

Core financial and insurance calculations are covered by unit tests in:
- `artifacts/bloomy-web/src/lib/__tests__/`
- `artifacts/bloomy-mobile/lib/__tests__/`

---

## Tech Stack

- **Monorepo**: pnpm workspaces, OpenAPI → typed client codegen (Orval)
- **Web**: React 19, Vite 7, Tailwind v4, TanStack Query v5, shadcn/ui, Wouter, Clerk
- **Mobile**: Expo SDK 54, React Native 0.81, Expo Router v6, Clerk
- **API**: Express 5, TypeScript, Zod v4, pino
- **Database**: PostgreSQL, Drizzle ORM, drizzle-zod
- **Payments**: Stripe (Grower $19/mo, Grower Pro $39/mo)
- **Email**: SendGrid (weekly digest)
- **Weather**: Open-Meteo API (free tier, no key required)
- **Supply chain security**: `pnpm minimumReleaseAge: 1440` enforced workspace-wide

---

## Commands Reference

```sh
# Typecheck all packages
pnpm run typecheck

# Regenerate API hooks/schemas from openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# Push DB schema
pnpm --filter @workspace/db push

# Run all tests
pnpm test
```
