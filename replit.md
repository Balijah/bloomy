# Bloomy — Weather & Agriculture Platform

## Overview

Bloomy is a U.S.-focused weather and agriculture platform with a freemium subscription model. Built as a pnpm monorepo with a React+Vite web frontend, Express API server, Expo mobile app, and PostgreSQL database.

## Architecture

```
artifacts/
  bloomy-web/     — React+Vite web app (port 20612, path /)
  bloomy-mobile/  — Expo (React Native) mobile app (port 21239, path /bloomy-mobile/)
  api-server/     — Express 5 API server (port 8080, path /api)
  mockup-sandbox/ — Design preview server (port 8081, path /__mockup)
lib/
  api-spec/       — OpenAPI spec (openapi.yaml) + Orval codegen config
  api-client-react/ — Generated React Query hooks (used by both web + mobile)
  api-zod/        — Generated Zod validation schemas
  db/             — Drizzle ORM schema + DB client
```

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24, **TypeScript**: 5.9
- **Web Frontend**: React + Vite, Tailwind v4, shadcn/ui, wouter routing
- **Mobile**: Expo SDK 54, Expo Router v6, React Native 0.81
- **Auth**: Clerk (`@clerk/react` for web, `@clerk/expo` for mobile)
- **API**: Express 5, pino logging
- **Database**: PostgreSQL + Drizzle ORM + drizzle-zod
- **Validation**: Zod v4
- **API Codegen**: Orval (OpenAPI → React Query hooks + Zod schemas)
- **Payments**: Stripe (configured via env vars)
- **Email**: SendGrid (configured via env vars)
- **Weather data**: Open-Meteo API (free, no key required)

## Design Tokens (shared web ↔ mobile)

- **Font**: Outfit (400/500/600/700)
- **Primary**: `#366441` light / `#4D8A5E` dark (forest green)
- **Background**: `#FAF8F5` light / `#1A201A` dark (warm cream / dark green)
- **Secondary**: `#CC9133` (amber)
- **Radius**: 12px

## Mobile App Screens (bloomy-mobile)

- `app/_layout.tsx` — Root: ClerkProvider + Outfit fonts + QueryClient
- `app/index.tsx` — Auth gate (redirects to sign-in or tabs)
- `app/sign-in.tsx` — Email/password sign-in + sign-up + OTP verify
- `app/(tabs)/index.tsx` — Dashboard: hero weather, hourly strip, 7/15-day forecast
- `app/(tabs)/agriculture.tsx` — Farm profiles list with crop emoji + meta chips
- `app/(tabs)/alerts.tsx` — Alerts list (mark read / delete)
- `app/(tabs)/settings.tsx` — Profile, locations, subscription tier, sign out
- `app/agriculture/[id].tsx` — Farm detail: GDD, risk cards, soil moisture, recommendations
- `components/WeatherIcon.tsx` — WMO code → Ionicons/MaterialCommunityIcons
- `constants/colors.ts` — Bloomy brand palette (light + dark)
- `utils/tokenCache.ts` — Clerk secure token cache (SecureStore on native, in-memory on web)

## Subscription Tiers

- **Free**: 7-day forecast, 1 location, basic weather
- **Grower ($19/mo)**: 15-day forecast, 6-hourly, agriculture dashboard, email alerts, 3 locations
- **Grower Pro ($39/mo)**: Everything + 5 farm locations, priority support

## Database Schema (lib/db/src/schema/)

- `users` — clerkUserId, email, firstName, lastName
- `locations` — userId, name, lat, lng, city, state, isDefault
- `farm_profiles` — userId, locationId, name, cropType, acreage, soilType, plantingDate, harvestDate, notes
- `field_notes` — userId, farmProfileId, date, category, severity, title, note, photoUri
- `push_tokens` — userId, token, platform (ios|android); unique on (userId, token)
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
- `POST /notifications/push-token` — register Expo push token (upsert)
- `DELETE /notifications/push-token` — unregister push token (on sign-out)

## Environment Variables / Secrets

Auto-provisioned:
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- `DATABASE_URL`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGHOST`
- `SESSION_SECRET`

Mobile (injected via dev script):
- `EXPO_PUBLIC_DOMAIN` → from `$REPLIT_DEV_DOMAIN`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` → from `$CLERK_PUBLISHABLE_KEY`

Required (set manually):
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_GROWER`, `STRIPE_PRICE_GROWER_PRO`
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm run typecheck:libs` — rebuild composite libs (db, api-spec, etc.)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks/schemas from OpenAPI
- `pnpm --filter @workspace/db run push` — push DB schema changes

## Push Notifications

Server-side weekly digest cron (`artifacts/api-server/src/lib/weeklyDigest.ts`):
- Runs every **Sunday at 19:00 UTC** via `node-cron`
- Starts from **all users with farms** (not just push-token holders), then filters by `weeklyDigestEnabled`
- For each opted-in user: counts farms, recent critical/high alerts (7 days), critical/high field notes (30 days) filtered by `digestMinSeverity`
- **Email channel** (`artifacts/api-server/src/lib/digestEmail.ts`): branded HTML email via SendGrid (`@sendgrid/mail`) — per-farm table with alert/note counts, "All Clear" vs critical summary banner, plain-text fallback
- **Push channel**: Expo push notification to registered devices — single-farm personalised or multi-farm aggregate; chunked 100/request
- Logs: `usersProcessed`, `emailSent`, `emailFailed`, `pushSuccess`, `pushFail`, `badTokens`

## Planting Date Tracker (mobile)

`lib/plantingCalendar.ts` — pure computation (no extra API calls):
- `computePlantingCalendar()` — takes `cropType`, `plantingDate`, `harvestDate`, `accumulatedGDD`, `growingDegreeDaysForecast`
- Derives: days since planting, GDD progress (fraction 0–1), remaining GDD, projected days-to-harvest, projected harvest date, daily GDD rate (~forecast/15), `harvestWindowReached` flag
- Harvest GDD threshold comes from the last stage's `gddMax` in `cropStages.ts`

`components/PlantingDateCard.tsx` — hero tracker card placed above Growth Stage on farm detail screen:
- **No planting date**: empty state with "Set Planting Date" CTA linking to edit form
- **Active state**: 3 stat pills (planted date, days in field, target harvest or daily GDD rate), animated GDD progress bar with harvest flag marker, harvest countdown (big number + projected calendar date + GDD/day rate), disclaimer footer
- **Harvest window reached**: amber "Harvest Window Reached" banner instead of countdown
- "Edit dates" button routes to edit form

`components/DatePickerField.tsx` — cross-platform date picker replacing bare text inputs in edit form:
- iOS: pressable field → native spinner in a modal bottom sheet with Done/Clear actions
- Android: native date picker dialog
- Web: plain `TextInput` with YYYY-MM-DD format
- Accepts `minDate`/`maxDate` constraints; harvest date minimum is set to the recorded planting date

Package added: `@react-native-community/datetimepicker`

## PDF Exports (mobile only)

Farm Report (`lib/farmReport.ts` + farm detail screen share button):
- Full-page PDF: season progress, current conditions, risk table, 7-day forecast grid, recommendations
- Uses `expo-print` + `expo-sharing`; inline styles only (no network required for render)

Scouting Report (`lib/scoutingReport.ts` + `ScoutingLogCard` "Share" button):
- Filters to **critical and high** severity notes only, sorted by severity then newest first
- Per-note: date, category badge, severity badge, full body text, photo attachment note
- Includes action checkbox + sign-off block for spray crew / agronomist
- Empty-state guard: shows alert if no critical/high notes exist
- Note count subtitle updates to show e.g. "5 notes · 2 critical/high"
- `farmName` prop added to `ScoutingLogCard`; passed from farm detail screen

## Mobile (`app/_layout.tsx` → `PushTokenBridge`):
- Calls `Notifications.getExpoPushTokenAsync()` on sign-in, registers with API
- Unregisters token on sign-out (clean `push_tokens` table)
- Token stored in AsyncStorage under `bloomy_push_token` key
- Notification tap routes: `data.screen === "farm"` → farm detail; `"agriculture"` → farms tab
