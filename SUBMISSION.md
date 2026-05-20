# Bloomy Hackathon Submission

## Brief Description

Bloomy is a mobile-first farm planning app. For the Baseline challenge, the app
adds **Benchmark Planner** to the mobile farm detail screen so a farmer can
compare per-field input costs and projected margins against anonymized
Missouri/Midwest peer benchmark sample data before signing seed, fertilizer, or
chemical purchase agreements.

The feature is in the mobile app at:

```text
Fields -> <corn or soybean farm> -> Benchmark Planner
```

Benchmark Planner supports corn and soybeans for the Missouri/Midwest demo. It
uses clearly labeled static sample data:

```text
Anonymized regional benchmark sample data for demo use.
```

The benchmark data is not presented as live market data. It is included to show
the product workflow and decision support expected by the Baseline challenge.

## What To Demo

Use the mobile app for the submitted video. Benchmark Planner is implemented in
the mobile farm detail flow, not the web dashboard.

Recommended 3-5 minute demo flow:

1. Start from a fresh account or a fresh state with no farm profiles visible.
2. Create a Missouri/Midwest corn farm:
   - name: `Baseline Demo Farm`
   - crop: `Corn`
   - acreage: `234`
3. Open `Fields -> Baseline Demo Farm`.
4. Show `Benchmark Planner`.
5. Point out the demo-data disclaimer.
6. Adjust seed, fertilizer, chemicals, expected yield, and crop price.
7. Show projected margin and peer-status labels recalculating live.
8. Save a decision note.
9. Share/export the Benchmark Planner summary.
10. Show one edge case:
    - preferred: an unsupported crop shows the unsupported-state message
    - fallback: a partial-data farm shows editable benchmark defaults

## Demo Narration Outline

Opening:

> Bloomy is focused on the Baseline farm financial planning challenge. The
> problem is that farmers often evaluate expensive input quotes without an
> independent benchmark for whether their field-level costs and projected
> margins are in line with regional peers.

Fresh setup:

> I am starting from a fresh account state and creating a corn farm for the
> Missouri/Midwest demo.

Benchmark Planner:

> On the farm detail page, Benchmark Planner compares tracked or editable
> per-acre costs against anonymized regional benchmark sample data. The app
> calculates revenue from expected yield and crop price, then shows projected
> margin per acre against the peer median and range.

Decision moment:

> If a fertilizer quote increases, the margin changes immediately and the peer
> comparison updates before the farmer signs the purchase agreement. The farmer
> can save the decision note and share a concise summary.

Close:

> The submitted code contains the same Benchmark Planner implementation shown in
> this video. The data is clearly labeled as anonymized demo sample data, and the
> workflow demonstrates the Baseline objective directly.

## How To Run And Verify

Install dependencies from the repository root:

```sh
pnpm install --frozen-lockfile
```

Run the mobile typecheck:

```sh
./node_modules/.bin/tsc -p artifacts/bloomy-mobile/tsconfig.json --noEmit
```

Check the deployed API:

```sh
curl -sS https://earth-forecast--burhankhan5.replit.app/api/healthz
```

Expected response:

```json
{"status":"ok"}
```

For local mobile testing, run the Expo app with the deployed API origin and the
Clerk publishable key configured in the environment:

```sh
cd artifacts/bloomy-mobile
EXPO_PUBLIC_API_BASE_URL=https://earth-forecast--burhankhan5.replit.app \
EXPO_PUBLIC_DOMAIN=earth-forecast--burhankhan5.replit.app \
EXPO_PUBLIC_CLERK_PROXY_URL=https://earth-forecast--burhankhan5.replit.app/api/__clerk \
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<clerk publishable key> \
npx expo start
```

## Submission Checklist

- Code zip contains the mobile Benchmark Planner implementation.
- Code zip excludes dependency folders, build output, local caches, local env
  files, and unrelated local notes.
- Demo video shows behavior that exists in the submitted code.
- Code is submitted before May 21 at 10:00 AM CDT.
- Video is uploaded before May 21 at 1:00 PM CDT.
