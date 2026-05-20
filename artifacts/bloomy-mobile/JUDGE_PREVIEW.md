# Internal Judge Preview QA Notes

This file is retained as an internal QA reference only. The hackathon
submission is evaluated through the code zip and demo video, not through live
judge access, TestFlight, or an APK install link.

This preview release is the full Bloomy mobile app with the Baseline challenge
feature included. It is not a stripped-down Benchmark Planner demo.

Judges should receive:

- iOS TestFlight invite or public TestFlight link
- Android APK install link from EAS
- private demo login credentials
- this short test path: `Fields -> Baseline_Test -> Benchmark Planner`

## Build Profiles

The judge profiles in `eas.json` are:

- `judge-android`: internal Android APK for direct install
- `judge-testflight`: iOS store build suitable for App Store Connect/TestFlight

The older `preview-simulator` profile remains simulator-only and should not be
used for judge distribution.

## Required Preview Environment

Set these values in the EAS `preview` environment before building:

```sh
EXPO_PUBLIC_API_BASE_URL=https://earth-forecast--burhankhan5.replit.app
EXPO_PUBLIC_DOMAIN=earth-forecast--burhankhan5.replit.app
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<clerk publishable key>
EXPO_PUBLIC_CLERK_PROXY_URL=https://earth-forecast--burhankhan5.replit.app/api/__clerk
```

Useful EAS commands:

```sh
eas env:list preview
eas env:update preview --variable-name EXPO_PUBLIC_API_BASE_URL --value https://earth-forecast--burhankhan5.replit.app --visibility plaintext --non-interactive
eas env:create preview --name EXPO_PUBLIC_DOMAIN --value earth-forecast--burhankhan5.replit.app --visibility plaintext --non-interactive --force
eas env:update preview --variable-name EXPO_PUBLIC_CLERK_PROXY_URL --value https://earth-forecast--burhankhan5.replit.app/api/__clerk --visibility plaintext --non-interactive
eas env:create preview --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value <clerk publishable key> --visibility sensitive --non-interactive --force
```

Do not commit real keys or judge passwords to the repo.

## Demo Account

Create one verified Clerk account for judging. Store the password only in the
private hackathon submission notes.

Suggested account:

```text
email: judge-demo@<team-domain>
password: <shared privately>
```

In Clerk, mark the email as verified so judges do not need to complete email
verification during the demo.

## Demo Data

Prepare the judge account with at least one demo-ready corn farm:

```text
name: Baseline_Test or Baseline Demo Farm
crop: corn
region: Missouri / Midwest
acres: 234
yield goal: 185 bu/ac
crop price: 4.55 USD/bu
seed: 118 USD/ac
fertilizer: 172 USD/ac
chemicals: 68 USD/ac
```

An optional soybean farm is useful for showing the partial-data flow:

```text
crop: soybeans
region: Missouri / Midwest
acres: 160
yield goal: 55 bu/ac
crop price: 11.20 USD/bu
```

## Build Commands

From this directory:

```sh
cd artifacts/bloomy-mobile
eas login
eas build --platform android --profile judge-android
eas build --platform ios --profile judge-testflight
eas submit --platform ios --profile judge-testflight
```

Equivalent package scripts:

```sh
npm run build:judge:android
npm run build:judge:ios
npm run submit:judge:ios
```

Android judges can install the APK from the EAS build link. iOS judges need a
TestFlight invite or public TestFlight link after the build is accepted in App
Store Connect.

If the iOS build fails with a distribution certificate or credential setup
message, run the iOS build once without `--non-interactive` from an account with
Apple Developer/App Store Connect access:

```sh
eas build --platform ios --profile judge-testflight
```

Use the prompts to create or validate the App Store distribution credentials,
then rerun `npm run build:judge:ios`.

## Judge Test Script

Give judges these steps:

1. Install Bloomy from TestFlight or the Android APK link.
2. Sign in with the private demo account.
3. Open `Fields`.
4. Open `Baseline_Test` or `Baseline Demo Farm`.
5. Find `Benchmark Planner`.
6. Change seed, fertilizer, chemicals, expected yield, or crop price.
7. Confirm the margin and peer-status labels update immediately.
8. Tap `Share summary`.
9. Tap `Save decision note`.

## QA Checklist

Before submitting links to judges, verify:

- Android APK installs on a real Android device.
- iOS TestFlight build installs on a real iPhone.
- The demo account can sign in without email verification.
- `Fields -> Baseline_Test -> Benchmark Planner` is visible.
- Scenario edits recalculate margin and benchmark status.
- `Share summary` opens the native share/PDF flow.
- `Save decision note` succeeds and appears in the notes/scouting log.
- The deployed API works on cellular data, not only local Wi-Fi.
- The Clerk proxy URL works in installed builds.

## Backup Demo

Record a 60-90 second walkthrough video after the Android APK or TestFlight
build is verified. The video should show login, the `Fields` tab,
`Baseline_Test`, Benchmark Planner adjustments, `Share summary`, and
`Save decision note`. Use the video only as a fallback if install, auth, or
TestFlight approval creates friction during judging.
