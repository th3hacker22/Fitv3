# E2E Tests (Playwright)

## Prerequisites

1. Firebase Auth Emulator running on port 9099:
   ```bash
   firebase emulators:start --only auth
   ```
2. Dev server running on port 3000:
   ```bash
   pnpm run dev
   ```
3. Environment variable `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` set
   in `.env.local` so firebase-admin points at the emulator.

## Running

```bash
pnpm run test:e2e         # headless
pnpm run test:e2e:ui      # interactive Playwright UI
```

## CI

The CI workflow (`.github/workflows/ci.yml`) starts the emulator and dev
server automatically before running E2E tests.

## Test Isolation

Each test clears Dexie (`PulseDB`) in `beforeEach` to prevent state leakage.
Firebase Auth Emulator users persist across runs but are identified by unique
emails (test-{timestamp}@example.com).
