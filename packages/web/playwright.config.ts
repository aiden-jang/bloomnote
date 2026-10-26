import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // The bloom is a deliberately slow, staged animation; these are not snappy unit tests.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // The journeys share one Worker and local KV; keep writes deterministic.
  workers: 1,
  fullyParallel: false,
  // Never let a green run hide a `.only` left behind in a spec.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['json', { outputFile: 'test-results/results.json' }]]
    : [['list']],
  use: {
    baseURL: 'http://localhost:32100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Reduced motion is emulated per-page in the spec, not declared here. Setting it in `use` (at
  // either level) left `matchMedia('(prefers-reduced-motion: reduce)')` reporting false in the
  // page, so it looked configured and did nothing. See the beforeEach in journey.spec.ts.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: [
    {
      // Accounts is not running here. Garden creation preserves its anonymous fallback;
      // account recovery journeys intercept session responses explicitly.
      // Wrangler validates its static assets directory even though Vite serves these journeys.
      command:
        'pnpm --filter @bloomnote/web build && pnpm --filter @bloomnote/api exec wrangler dev --var AUTH_URL:http://localhost:34100 --persist-to .wrangler/e2e-state',
      url: 'http://localhost:32200/health',
      reuseExistingServer: false,
      timeout: 120_000,
      cwd: '../..',
    },
    {
      command: 'pnpm --filter @bloomnote/web dev',
      url: 'http://localhost:32100',
      reuseExistingServer: false,
      timeout: 120_000,
      cwd: '../..',
    },
  ],
})
