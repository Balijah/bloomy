# Bloomy — Finish-Line Audit

> **Date:** 2026-10-15
> **Scope:** Full codebase review of the Bloomy monorepo (`api-server`, `bloomy-web`, `bloomy-mobile`, `lib/*`, `scripts/`) to identify what must be resolved before a production launch.

---

## Build / Typecheck / Test Results (verified)

| Check | Result |
|---|---|
| `pnpm install` | **Pass** — 1,266 packages resolved, 0 errors |
| `pnpm run typecheck:libs` | **Pass** — 0 errors |
| `pnpm --filter @workspace/api-server typecheck` | **Pass** — 0 errors |
| `pnpm --filter @workspace/bloomy-web typecheck` | **Pass** — 0 errors |
| `pnpm --filter @workspace/bloomy-mobile typecheck` | **Pass** — 0 errors |
| `pnpm --filter @workspace/api-server build` | **Pass** — `dist/index.mjs` 4.9 MB bundle |
| `pnpm --filter @workspace/bloomy-web build` | **Pass** — 721 KB JS bundle (over 500 KB chunk warning) |
| `pnpm --filter @workspace/bloomy-web test` (vitest) | **Pass** — 54 / 54 tests (`benchmarkPlanner.test.ts`) |
| `pnpm --filter @workspace/bloomy-mobile test` (vitest) | **Pass** — 43 / 43 tests (`insuranceMath.test.ts`, `yieldForecast.test.ts`) |
| `pnpm audit` | **203 vulnerabilities** (12 low, 72 moderate, 102 high, 17 critical) |

---

## Punch List

### P0 — Must Fix Before Launch

#### 1. No Stripe Webhook Endpoint — Subscriptions Will Desync
**What:** There is no `/api/subscriptions/webhook` (or equivalent) route. Stripe lifecycle events (payment succeeded, subscription cancelled/renewed, invoice failed) are never received by the server. The `subscriptions` table has `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd` columns, but nothing ever writes to them after the initial checkout.
**Why:** Without a webhook, a user who cancels via Stripe's customer portal stays on a paid tier forever. A payment failure never downgrades the user. Revenue tracking is impossible.
**Files:** `artifacts/api-server/src/routes/subscriptions.ts`, `lib/db/src/schema/subscriptions.ts`
**Effort:** Medium — implement a `POST /api/subscriptions/webhook` route that (a) verifies the Stripe webhook signature via `stripe.webhooks.constructEvent()`, (b) handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and `invoice.payment_failed` events, (c) updates the `subscriptions` table accordingly. Add `STRIPE_WEBHOOK_SECRET` to `.env.example`.

#### 2. `.env` Not in `.gitignore` — Secret Leak Risk
**What:** The `.gitignore` file does not list `.env`. If a developer creates a `.env` with real `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `DATABASE_URL`, or `SENDGRID_API_KEY`, it can be accidentally committed and pushed.
**Why:** Leaked secrets in git history are extremely difficult to rotate out of, especially for Stripe and database credentials.
**Files:** `.gitignore`
**Effort:** Trivial — add `.env` (and `.env.local`, `.env.*.local`) to `.gitignore`. Verify no `.env` file is currently tracked (`git ls-files` confirmed only `.env.example` is tracked today).

#### 3. CORS Set to `origin: true` — Accepts All Origins
**What:** `app.ts` line 46: `app.use(cors({ credentials: true, origin: true }))`. This reflects any requesting origin in the `Access-Control-Allow-Origin` header while also allowing credentials.
**Why:** Any malicious site can make authenticated cross-origin requests to the Bloomy API on behalf of a signed-in user. This is a textbook CSRF/confused-deputy vector.
**Files:** `artifacts/api-server/src/app.ts`
**Effort:** Small — replace `origin: true` with an allowlist of the production domain(s) and `localhost` for development. The value can be driven by an env var like `ALLOWED_ORIGINS`.

#### 4. No Rate Limiting on Any API Route
**What:** There is no rate-limiting middleware (e.g. `express-rate-limit`) on any endpoint. The health check, auth-gated CRUD routes, the checkout endpoint, and the public weather endpoints are all unlimited.
**Why:** A single client can exhaust the Open-Meteo free-tier quota (10,000 req/day), generate unbounded database load, or brute-force the checkout flow. DDoS resilience is zero at the application layer.
**Files:** `artifacts/api-server/src/app.ts`
**Effort:** Small — add `express-rate-limit` as a dependency, configure a global limiter (e.g. 100 req/15 min per IP) and stricter per-route limiters on `/api/subscriptions/checkout` and `/api/weather/*`.

#### 5. No Security Headers (Helmet)
**What:** The Express server does not use `helmet` or set any security headers (`X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, `Content-Security-Policy`, etc.).
**Why:** Without these, the app is vulnerable to clickjacking, MIME-sniffing attacks, and missing HSTS in production.
**Files:** `artifacts/api-server/src/app.ts`
**Effort:** Trivial — `pnpm add helmet` and `app.use(helmet())` before the other middleware.

#### 6. Weather Routes Partially Unauthenticated
**What:** `GET /api/weather/current` and `GET /api/weather/forecast` do not call `requireAuth`. Only `GET /api/weather/hourly` is gated.
**Why:** These endpoints accept arbitrary `lat`/`lng` query params and proxy to Open-Meteo. Without authentication, any anonymous client can use the Bloomy server as an open weather proxy, burning through the free-tier API quota.
**Files:** `artifacts/api-server/src/routes/weather.ts`
**Effort:** Trivial — add `requireAuth` middleware to the `/weather/current` and `/weather/forecast` route handlers (or at minimum add rate limiting per §4).
**Owner decision needed:** Are these intentionally public for unauthenticated landing-page widgets? If so, at minimum rate-limit them aggressively.

#### 7. JSON Body Size Already Has a Default Limit (Not a Launch Blocker)
**What:** `app.use(express.json())` is called without a `limit` option. Express 5 defaults to 100 KB, which is usually acceptable, but the absence of an explicit limit signals that it wasn't considered.
**Why:** The existing 100 KB default already bounds JSON payload size. Setting it explicitly is optional documentation of that policy, not a missing security control.
**Files:** `artifacts/api-server/src/app.ts`
**Effort:** Trivial — `app.use(express.json({ limit: '100kb' }))`.

#### 8. Database Uses `push` Not Migrations — No Rollback Path
**What:** The `lib/db` package only has `drizzle-kit push` (and `push-force`). There is no `drizzle-kit generate` or `drizzle-kit migrate` workflow, no `migrations/` directory, no migration history table.
**Why:** `push` is suitable for prototyping but dangerous in production: it applies schema changes immediately with no rollback, no audit trail, and `push-force` can drop columns. A failed push on a production database with user data is unrecoverable without a manual backup.
**Files:** `lib/db/package.json`, `lib/db/drizzle.config.ts`
**Effort:** Medium — switch to `drizzle-kit generate` + `drizzle-kit migrate` workflow. Generate initial migration from current schema, add a `migrate` script, remove `push-force` or gate it behind `NODE_ENV !== 'production'`.

#### 9. No Privacy Policy, Terms of Service, or Data Deletion Mechanism
**What:** There is no privacy policy page, no terms of service, and no account/data deletion endpoint or UI flow anywhere in the codebase (web or mobile).
**Why:** Apple App Store and Google Play Store both require a privacy policy URL in the store listing. Apple additionally requires an account deletion mechanism (effective 2022 guideline 5.1.1(v)). GDPR/CCPA compliance is impossible without these. The app collects location data, email, farm data, and push tokens.
**Files:** N/A (files don't exist yet)
**Effort:** Medium — create a privacy policy page (can be a static route in the web app), add a data deletion API endpoint and corresponding UI in Settings, and configure the privacy policy URL in `app.json` for the mobile app.

#### 10. Critical Dependency Vulnerabilities
**What:** `pnpm audit` reports 17 critical vulnerabilities:
- **orval** (codegen tool): two RCE vulnerabilities via template injection (GHSA-p4cg-3328-rvfg, GHSA-...) — affects `lib/api-spec`; current `^8.5.2`, patched in `>=8.21.0`
- **vitest**: arbitrary file read/exec when UI server is listening (GHSA-5xrq-8626-4rwp) — patched in `>=3.2.6`; current `^3.0.0` (likely resolves to <3.2.6)
- **tar** (via `@expo/cli`): DoS — patched in `>=7.5.19`
- **shell-quote** (via `react-native`): newline escape — patched in `>=1.8.4`
- **undici** (via `@expo/cli` and `expo-server-sdk`): multiple issues
**Why:** The orval RCE vulnerabilities are especially dangerous — a malicious OpenAPI spec fed to codegen could execute arbitrary code. The vitest vulnerability is dev-only but still a risk on CI/shared dev environments.
**Files:** `pnpm-lock.yaml`, `lib/api-spec/package.json`, `artifacts/bloomy-web/package.json`, `artifacts/bloomy-mobile/package.json`
**Effort:** Small-to-medium — update `orval` to `>=8.21.0`, update `vitest` to `>=3.2.6`, run `pnpm update` for transitive deps. Some Expo/RN transitive deps may require waiting for upstream releases.

---

### P1 — Should Fix Before Launch

#### 11. Subscription Tier Enforcement Is Incomplete
**What:** The only server-side tier checks are:
- Free tier: max 1 location (`locations.ts` line 45–49)
- Hourly forecast: paid tier required (`weather.ts` line 45–48)

There is **no** server-side enforcement for: number of farm profiles, number of field notes, number of input costs, number of yield records, access to agriculture insights, spray window alerts, or peak risk alerts. The `grower` vs `grower_pro` tiers have no differentiated server-side behaviour at all.
**Why:** Any free-tier user can create unlimited farm profiles, field notes, yield records, and input costs. The paid tier is trivially bypassable for all features except hourly forecast and the 2nd+ location.
**Files:** `artifacts/api-server/src/routes/agriculture.ts`, `fieldNotes.ts`, `yieldRecords.ts`, `inputCosts.ts`, `alerts.ts`
**Effort:** Medium — define tier limits (e.g. free: 1 farm, 10 notes; grower: 5 farms, unlimited notes; grower_pro: unlimited) and add `requireTier()` middleware or per-route checks. Requires a product decision on what limits to enforce.

#### 12. Dashboard Returns Hardcoded Fake Weather When No Location Exists
**What:** `dashboard.ts` lines 42–61: when the user has no location, the API returns a 200 with hardcoded weather data (`temperature: 72`, `tempMax: 78`, etc.) rather than an empty/null response or a clear "add a location" signal.
**Why:** A new user sees realistic-looking weather data that doesn't correspond to any real location. This is misleading and could erode trust if noticed.
**Files:** `artifacts/api-server/src/routes/dashboard.ts`
**Effort:** Small — return `{ location: null, currentWeather: null, ... }` and handle the empty state in the web/mobile UI with an "Add your first location" prompt.

#### 13. `accumulatedGDD` Estimation Is Unreliable
**What:** In `weather.ts` lines 278–289, accumulated GDD since planting is estimated by multiplying `daysSincePlanting` by the average daily GDD from the current 15-day forecast. This assumes the entire growing season had the same GDD accumulation rate as the current 15-day window.
**Why:** GDD varies dramatically by month (e.g. early spring vs. midsummer). A June 15-day forecast applied retroactively to a March planting date will wildly overestimate accumulated GDD. This feeds into crop stage determination, yield forecasting, and insurance calculations.
**Files:** `artifacts/api-server/src/lib/weather.ts` (lines 278–289)
**Effort:** Medium — integrate historical weather data (Open-Meteo has a free Historical Weather API) to calculate actual GDD accumulation from planting date to today, then append the 15-day forecast for projected GDD.

#### 14. No Unsubscribe Link in Digest Email
**What:** The weekly digest email body includes text saying "open Settings → Notifications → Weekly Farm Digest in the app" but the "Open Bloomy" CTA links to `href="#"` (a dead link).
**Why:** CAN-SPAM Act requires a working unsubscribe mechanism. SendGrid may flag or throttle emails without a functional unsubscribe link. App store reviewers may also flag this.
**Files:** `artifacts/api-server/src/lib/digestEmail.ts` (line 169)
**Effort:** Small — replace `href="#"` with the production app URL. Consider adding a one-click email unsubscribe endpoint (`/api/unsubscribe?token=...`) to comply with CAN-SPAM/GDPR.

#### 15. Replit-Specific Coupling Blocks Deployment Elsewhere
**What:** Several Replit-specific items:
- `vite.config.ts` conditionally imports `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner` when `REPL_ID` is set — these are dev-only and won't break a non-Replit deploy, but add 3 Replit dependencies to the web package.
- `@replit/vite-plugin-runtime-error-modal` is imported unconditionally in the production Vite config.
- The mobile `dev` script in `package.json` references `$REPLIT_EXPO_DEV_DOMAIN`, `$REPLIT_DEV_DOMAIN`, `$REPL_ID` — hard-coded Replit env vars.
- The `.replit` file, `replit.md`, and Replit port mappings are committed.
- The `expo-router` plugin in `app.json` has `"origin": "https://replit.com/"`.
**Why:** Railway and Render deployment configs already exist, indicating the owner wants portability. The unconditional Replit runtime-error-modal will show dev-mode error overlays in production on non-Replit hosts. The Expo origin hardcodes Replit's domain for deep linking.
**Files:** `artifacts/bloomy-web/vite.config.ts`, `artifacts/bloomy-mobile/package.json` (dev script), `artifacts/bloomy-mobile/app.json` (expo-router origin), `.replit`
**Effort:** Small — make `@replit/vite-plugin-runtime-error-modal` conditional on `REPL_ID`, update the Expo router origin to be configurable, and document non-Replit dev setup in README.

#### 16. Web Bundle Is Over 700 KB (No Code Splitting)
**What:** The web production build produces a single 721 KB JS chunk. Vite itself warns about this.
**Why:** First-load performance will be poor, especially on mobile connections. The initial load downloads the entire application bundle; client-side route changes reuse that loaded bundle.
**Files:** `artifacts/bloomy-web/vite.config.ts`
**Effort:** Small — add `React.lazy()` + `Suspense` for page-level routes and configure `manualChunks` in Vite's Rollup options to split vendor libraries (recharts, radix, etc.) into separate chunks.

#### 17. No Automated Test Coverage for API Server
**What:** There are 0 test files in `artifacts/api-server/`. The only tests in the project cover the client-side math modules (`benchmarkPlanner`, `insuranceMath`, `yieldForecast`).
**Why:** There is no automated verification that API routes return correct status codes, enforce auth, validate input, or handle edge cases. Regressions will not be caught.
**Files:** `artifacts/api-server/`
**Effort:** Medium — set up `vitest` with a test database (or mock `db`) and add integration tests for at least the auth middleware, subscription checkout, location CRUD, and tier enforcement.

#### 18. No CI/CD Pipeline
**What:** There is no `.github/workflows/`, no CI configuration, no automated linting, typechecking, or test runs on push/PR.
**Why:** Every merge is a trust exercise. Typecheck regressions, test failures, or vulnerability introductions won't be caught before deploy.
**Files:** N/A (doesn't exist)
**Effort:** Small — add a GitHub Actions workflow that runs `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm test`, and `pnpm audit --audit-level=critical`.

#### 19. Alert Creation Runs in Background Without Error Propagation
**What:** In `agriculture.ts` lines 263–302, alert creation runs in a fire-and-forget `(async () => { ... })()` block with a bare `catch {}` that silently swallows all errors.
**Why:** If alert creation fails (e.g. database connection issue), no alerts are ever created and no one knows. This makes the alerting system unreliable with no observability.
**Files:** `artifacts/api-server/src/routes/agriculture.ts` (lines 263–302)
**Effort:** Trivial — add `logger.error(err, "Failed to create farm risk alert")` inside the catch block.

#### 20. Drizzle `push-force` Should Not Exist in Production
**What:** `lib/db/package.json` exposes `pnpm --filter @workspace/db push-force` which runs `drizzle-kit push --force`. This drops conflicting columns without confirmation.
**Why:** If run against a production database, this can irrecoverably destroy user data.
**Files:** `lib/db/package.json`
**Effort:** Trivial — remove the `push-force` script entirely, or gate it behind a `NODE_ENV=development` check.

---

### P2 — Nice to Have

#### 21. Benchmark Planner Data Is Static / Demo-Quality
**What:** The `benchmarkPlanner.ts` module uses hardcoded USDA ERS 2023 data for Iowa corn and soybeans only. The constant `BENCHMARK_DEMO_DISCLAIMER` explicitly says "Anonymized regional benchmark sample data for demo use." Only two crops are supported.
**Why:** This is fine for an MVP but should be expanded with more regions, crops, and current-year data. Users outside Iowa growing non-corn/soybean crops get no benchmarking. The disclaimer is appropriate but should be prominent in the UI.
**Files:** `artifacts/bloomy-web/src/lib/benchmarkPlanner.ts`
**Effort:** Large — requires sourcing current USDA ERS data for additional crops/regions, or integrating with a data API.

#### 22. Market Prices and RMA Projected Prices Are Hardcoded
**What:** `yieldGoal.ts` has `CROP_MARKET_PRICES` and `CROP_COST_HINTS` with static values. `insuranceMath.ts` has `RMA_PROJECTED_PRICES_2025` hardcoded for 2025.
**Why:** These values change annually (RMA projected prices) or daily (futures prices). Users making insurance or revenue decisions based on stale prices could be harmed.
**Files:** `artifacts/bloomy-mobile/lib/yieldGoal.ts`, `artifacts/bloomy-mobile/lib/insuranceMath.ts`
**Effort:** Medium — at minimum, add a "data as of" label to the UI and a mechanism to update these values. Ideally, integrate a market data API for current futures prices.

#### 23. Mobile App: EAS Project ID Is Hardcoded to Original Developer
**What:** `app.json` contains `"projectId": "6aef9635-5b02-46e4-b841-3b9f4f3d6e0a"` and `"owner": "balijah"`. The bundle identifiers are `com.bloomy.app` for both iOS and Android.
**Why:** To publish to your own App Store / Play Store accounts, the EAS project ID and owner must be changed. The bundle identifier should be verified as available / registered.
**Files:** `artifacts/bloomy-mobile/app.json`, `artifacts/bloomy-mobile/eas.json`
**Effort:** Small — create a new EAS project under the production Expo account, update `app.json`, and verify bundle ID availability.

#### 24. Mobile App: Duplicate `UIBackgroundModes` Entries
**What:** `app.json` iOS `infoPlist.UIBackgroundModes` contains duplicate entries: `"fetch"`, `"remote-notification"`, and `"location"` each appear twice.
**Why:** Not a blocker, but Apple's review team may flag it, and it signals sloppiness.
**Files:** `artifacts/bloomy-mobile/app.json`
**Effort:** Trivial — remove the duplicates.

#### 25. `SESSION_SECRET` in `.env.example` Is Vestigial
**What:** `.env.example` includes `SESSION_SECRET=change-me-to-a-long-random-string` but no code in the project references `SESSION_SECRET`. Authentication is fully handled by Clerk.
**Why:** This is confusing for someone setting up the project and may lead them to think session-based auth is used.
**Files:** `.env.example`
**Effort:** Trivial — remove the `SESSION_SECRET` entry from `.env.example`.

#### 26. No Logging / Monitoring / APM Beyond pino
**What:** The API server uses `pino` + `pino-http` for structured logging, which is good. However, there is no error tracking service (e.g. Sentry), no uptime monitoring, and no APM.
**Why:** In production, errors in the background digest cron, failed Stripe API calls, or Open-Meteo outages will only appear in server stdout logs, which are ephemeral on most PaaS platforms.
**Files:** `artifacts/api-server/src/lib/logger.ts`
**Effort:** Small — integrate Sentry or a similar error tracking service. Add health check monitoring.

#### 27. `node-fetch` Is a Redundant Dependency
**What:** `artifacts/api-server/package.json` lists `node-fetch@^3.3.2` as a dependency, but the codebase uses the global `fetch()` API (available in Node 18+). No imports of `node-fetch` were found in the source.
**Why:** Unnecessary dependency weight and a potential source of confusion.
**Files:** `artifacts/api-server/package.json`
**Effort:** Trivial — remove `node-fetch` from dependencies.

#### 28. `mockup-sandbox` Artifact Is Leftover
**What:** `artifacts/mockup-sandbox/` is a Vite app that appears to be a design mockup preview tool. It is not referenced by any other package and has its own `node_modules`.
**Why:** Dead code that increases install time and repo size.
**Files:** `artifacts/mockup-sandbox/`
**Effort:** Trivial — remove the directory and its entry from the workspace (it's included via the `artifacts/*` glob in `pnpm-workspace.yaml`).

#### 29. Open-Meteo API Has No Caching
**What:** Every dashboard load, every agriculture insights request, and every spray-window-alerts request makes live HTTP calls to the Open-Meteo API. There is no response caching.
**Why:** Open-Meteo's free tier has a 10,000 requests/day limit. With multiple farms per user and frequent page loads, this limit could be hit quickly. Weather data changes at most hourly, so caching for 15-60 minutes is safe.
**Files:** `artifacts/api-server/src/lib/weather.ts`
**Effort:** Small — add an in-memory cache (e.g. `Map` with TTL) or Redis cache keyed on `lat,lng` rounded to 2 decimal places.

#### 30. `precipitationDeficit` Calculation Uses a Fixed Average
**What:** `weather.ts` line 192: `const avgMonthlyPrecip = 1.5;` — the drought risk calculation compares actual precipitation against a hardcoded 1.5" monthly average regardless of location, crop, or time of year.
**Why:** 1.5"/month is reasonable for some Midwestern locations but very wrong for e.g. the Southeast (4-5"/month) or the arid West (< 0.5"/month). This will systematically undercount drought risk in wet climates and overcount in dry ones.
**Files:** `artifacts/api-server/src/lib/weather.ts`
**Effort:** Medium — use location-specific historical precipitation averages from Open-Meteo's Climate API or NOAA normals.

---

## Domain Math Module Review

### `benchmarkPlanner.ts` (Web)
- **Correctness:** Math is straightforward and correct: revenue = yield × price, margin = revenue − costs, comparisons against USDA ERS benchmark ranges. The 8% "near median" band is a reasonable heuristic.
- **Data quality:** USDA ERS 2023 Iowa data for corn and soybeans only. Explicitly labelled as demo/sample data. Suitable for MVP.
- **Test coverage:** 54 tests covering all public functions. Well-structured.

### `insuranceMath.ts` (Mobile)
- **Correctness:** RP, RPHPE, and YP formulas follow standard USDA RMA definitions. RP guarantee = APH × coverage × max(projected, harvest); RPHPE excludes harvest price uplift; YP = (guarantee − actual) × priceElection × projectedPrice. All verified against RMA documentation.
- **Caveat:** The "harvest price" is proxied by the user-entered `cropPrice` (market sale price), not the actual RMA-published harvest price, which is determined at the end of the insurance period. This is documented in the code but should be called out in the UI.
- **Test coverage:** 21 tests covering all plan types, status classification, and edge cases. Solid.

### `yieldForecast.ts` (Mobile)
- **Correctness:** Uses USDA national average baselines, applies stress penalties (frost, heat, drought, harvest disruption) with a 40% cap. Stage-based confidence bands narrow as the season progresses. Sound methodology for an estimation tool.
- **Concern:** The yield profiles use US national averages, but yields are highly regional. A corn farmer in Georgia will see Iowa-calibrated baselines. Consider labelling these as "US national average" in the UI.
- **Test coverage:** 22 tests covering invariants, stress penalties, stage confidence, and crop profiles. Good.

### `sprayWindow.ts` (Mobile)
- **Correctness:** Thresholds for wind, temperature, precipitation, and humidity are well-researched and differentiated by spray type (herbicide, pre-emergent, pesticide, foliar). Temperature inversion detection (calm wind < 2 mph) is a nice touch. Hourly slot scoring is correctly implemented.
- **No tests:** This module has zero test coverage despite being the most complex client-side module (485 lines). The scoring logic has many branching paths that should be covered.
- **Files:** `artifacts/bloomy-mobile/lib/sprayWindow.ts`

### `computeAgricultureInsights` (API Server)
- **Correctness:** GDD calculation follows the standard (Tmax+Tmin)/2 − Tbase formula. Crop-specific base temperatures are reasonable (corn: 50°F, winter wheat: 32°F, cotton: 60°F).
- **Concern about `accumulatedGDD`:** See P1 §13 above — the extrapolation method is unreliable.
- **No tests:** This server-side function has no test coverage.

---

## Security Review Summary

| Area | Status | Details |
|---|---|---|
| Auth on API routes | **Mostly good** | All CRUD routes use `requireAuth`. Weather current/forecast are public (see §6). Health endpoint is intentionally public. |
| Clerk token verification | **Good** | `@clerk/express` `clerkMiddleware` + `getAuth()` pattern is correctly applied. Proxy middleware is production-only and correctly passes `Clerk-Secret-Key` header. |
| Stripe webhook verification | **Missing** | No webhook endpoint exists (see §1). |
| Input validation | **Good** | All routes use Zod schemas from `@workspace/api-zod` via `.safeParse()` with proper 400 responses on failure. |
| Row-level authorization | **Good** | All queries include `eq(table.userId, userId)` to ensure users can only access their own data. Farm ownership is checked before field note/yield record/input cost operations. |
| CORS | **Bad** | `origin: true` reflects any origin (see §3). |
| Rate limiting | **Missing** | No rate limiting anywhere (see §4). |
| Security headers | **Missing** | No helmet/CSP/HSTS (see §5). |
| Secret management | **Mostly good** | Secrets are env vars, not hardcoded. `.env.example` has placeholder values. However, `.env` is not gitignored (see §2). Clerk publishable key in `.replit` is intentionally public. |
| Body size limits | **Default only** | Express 5 defaults to 100 KB; not explicitly configured (see §7). |
| SQL injection | **Not applicable** | Drizzle ORM is used throughout; no raw SQL. |

---

## What Could Not Be Verified

1. **Live Stripe integration:** No Stripe keys are available in this environment. Could not verify checkout session creation, portal session creation, or whether `STRIPE_PRICE_GROWER` / `STRIPE_PRICE_GROWER_PRO` are correctly configured in the Stripe dashboard.
2. **Database schema correctness:** No `DATABASE_URL` is set, so `drizzle-kit push` could not be run. Schema types were verified via code inspection only.
3. **SendGrid email delivery:** No `SENDGRID_API_KEY` available. The digest email HTML was reviewed but not rendered or send-tested.
4. **Clerk authentication flow end-to-end:** No Clerk keys available. Auth middleware code was reviewed but not tested live.
5. **Mobile app on real devices:** No iOS/Android simulator available. EAS build profiles and app.json were reviewed but not built.
6. **Open-Meteo API response shape:** API calls could not be made. The field mappings in `weather.ts` were cross-referenced against the Open-Meteo documentation and appear correct.
7. **Production deployment on Railway/Render:** Config files (`railway.json`, `render.yaml`) were reviewed but not deployed.

---

## Suggested PR Sequence

The following is a suggested order of PRs to minimize risk and maximize incremental progress:

1. **Security hardening** (§2, §3, §4, §5, §7): `.gitignore` fix, CORS allowlist, rate limiting, helmet, body size limit. These are all independent, low-risk changes that can ship together.

2. **Stripe webhook** (§1): Implement the webhook endpoint and test with Stripe CLI. This is the highest-impact functional gap.

3. **Database migration workflow** (§8, §20): Switch from `push` to `generate`+`migrate`, remove `push-force`. Do this before adding new schema changes.

4. **Subscription tier enforcement** (§11): Define and enforce tier limits server-side. Requires product decisions on limits. Depends on §2 (webhooks) so tiers can actually be downgraded on cancellation.

5. **Privacy policy + data deletion** (§9): Add privacy policy page, terms of service, and account deletion endpoint. Required for app store submission.

6. **Dashboard fake-data fix** (§12) + **weather auth/caching** (§6, §29): Fix the hardcoded fallback, add auth or rate limiting to weather routes, and add caching.

7. **Dependency updates** (§10): Update orval, vitest, and transitive deps.

8. **Replit decoupling** (§15): Make Replit plugins conditional, fix Expo router origin, document non-Replit setup.

9. **Mobile release prep** (§9, §23, §24): Update EAS project, fix duplicate background modes, privacy policy URL in app.json.

10. **Web performance** (§16): Code splitting and chunk optimization.

11. **API server tests + CI** (§17, §18): Add test infrastructure and CI pipeline.

12. **Nice-to-haves** (§19, §21–30): Background alert logging, benchmark data expansion, market price feeds, monitoring, caching, etc.

---

## Owner Decisions Needed

1. **Tier limits:** What features/limits should differentiate `free`, `grower`, and `grower_pro`? (§11)
2. **Weather endpoints:** Should `/weather/current` and `/weather/forecast` be public or require auth? (§6)
3. **Benchmark data:** Is Iowa corn/soybeans sufficient for launch, or do you need additional regions/crops? (§21)
4. **Market prices:** Are static 2025 prices acceptable for launch, or do you need live data? (§22)
5. **Deployment platform:** Replit, Railway, or Render? The codebase has config for all three. Choose one and remove the others to reduce confusion. (§15)
6. **AccumulatedGDD:** Is the current estimation method acceptable for launch with a "beta" label, or should historical weather integration be a launch requirement? (§13)
7. **Mobile launch:** Is the mobile app part of the initial launch scope, or web-only first? This affects the urgency of §9, §23, §24. (§9)
