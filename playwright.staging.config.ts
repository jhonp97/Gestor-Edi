import { defineConfig } from '@playwright/test'

// No webServer: never starts or reuses a host dev server.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'truck-workday-staging.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  globalTimeout: 210_000,
  expect: { timeout: 15_000 },
  outputDir: '/tmp/staging-results',
  reporter: [['./scripts/run-local-staging.mjs']],
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    launchOptions: { chromiumSandbox: true },
  },
  projects: [{ name: 'owned-chromium' }],
})
