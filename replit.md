# Bloomy — Weather & Agriculture Platform

## Overview

Bloomy is a U.S.-focused weather and agriculture platform with a freemium subscription model. Built as a pnpm monorepo with a React+Vite web frontend, Express API server, and PostgreSQL database.

## Architecture

```
artifacts/
  bloomy-web/     — React+Vite web app (port 20612, path /)
  api-server/     — Express 5 API server (port 8080, path /api)
  mockup-sandbox/ — Design preview server (port 8081, path /__mockup)
lib/
  api-spec/       — OpenAPI spec (openapi.yaml) + Orval codegen config
  api-client-react/ — Generated React Query hooks
  api-zod/        — Generated Zod validation schemas
  db/             — Drizzle ORM schema + DB client
```

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24, **TypeScript**: 5.9
- **Frontend**: React + Vite, Tailwind v4, shadcn/ui, wouter routing
- **Auth**: Clerk (Replit-managed, `setupClerkWhitelabelAuth()` called)
- **API**: Express 5, pino logging
- **Database**: PostgreSQL + Drizzle ORM + drizzle-zod
- **Validation**: Zod v4
- **API Codegen**: Orval (OpenAPI → React Query hooks + Zod schemas)
- **Payments**: Stripe (configured via env vars)
- **Email**: SendGrid (configured via env vars)
- **Weather data**: Open-Meteo API (free, no key required)

## Subscription Tiers

- **Free**: 7-day forecast, 1 location, basic weather
- **Grower ($19/mo)**: 15-day forecast, 6-hourly, agriculture dashboard, email alerts, 3 locations
- **Grower Pro ($39/mo)**: Everything + 5 farm locations, priority support

## Database Schema (lib/db/src/schema/)

- `users` — clerkUserId, email, firstName, lastName
- `locations` — userId, name, lat, lng, city, state, isDefault
- `farm_profiles` — userId, locationId, name, cropType, acreage, soilType, plantingDate, harvestDate, notes
- `alerts` — userId, locationId, farmProfileId, type, severity, title, message, isRead, triggeredAt
- `alert_preferences` — userId, emailEnabled, alertTypes[], frostThreshold, heatThreshold, precipThreshold, windThreshold
- `subscriptions` — userId, tier, status, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd

## Crop Types
corn, soybeans, winter_wheat, cotton, almonds, grapes, apples, potatoes, rice, other

## Alert Types
frost, hard_freeze, extreme_heat, heat_stress, heavy_precipitation, flash_flood, drought, high_wind, hail, harvest_disruption, late_season_frost, winter_storm

## API Routes (all under /api)

- `GET /healthz`
- `GET/PATCH /users/me`
- `GET/POST /locations`, `GET/PATCH/DELETE /locations/:id`
- `GET /weather/current?lat&lng`
- `GET /weather/forecast?lat&lng`
- `GET /weather/hourly?lat&lng` (paid tier)
- `GET/POST /agriculture/farm-profiles`, `GET/PATCH/DELETE /agriculture/farm-profiles/:id`
- `GET /agriculture/insights/:farmProfileId`
- `GET /alerts`, `GET /alerts/active`, `PATCH /alerts/:id/read`, `DELETE /alerts/:id`
- `GET/PUT /alert-preferences`
- `GET /subscriptions/current`, `POST /subscriptions/checkout`, `POST /subscriptions/portal`
- `GET /dashboard/summary?locationId`

## Environment Variables / Secrets

Auto-provisioned:
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- `DATABASE_URL`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGHOST`
- `SESSION_SECRET`

Required (set manually):
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_GROWER`, `STRIPE_PRICE_GROWER_PRO`
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm run typecheck:libs` — rebuild composite libs (db, api-spec, etc.)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks/schemas from OpenAPI
- `cd lib/db && pnpm drizzle-kit push --force` — push DB schema changes
