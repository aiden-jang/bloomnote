import { defineConfig, devices } from '@playwright/test';

/**
 * Browser end-to-end tests: compose → bloom → share → recipient, in a real browser.
 *
 * This is the layer everything else in the repo cannot see. The unit tests know the KV store
 * stores things and the SSE route streams the right events; none of them know whether a person
 * can actually get from an empty form to a garden their friend can open. Most of the real bugs
 * found in this app were of that shape, visible only in a render.
 *
 * Both servers are started here so the suite is one command. Vite proxies `/api` to the Worker,
 * which is what production does too (one origin serving the SPA and the API), so the test
 * exercises the same same-origin arrangement rather than a test-only one.
 *
 * No GEMINI_API_KEY is needed: the one call that would cost money is intercepted in the browser
 * and fulfilled with a canned SSE stream (see e2e/journey.spec.ts). Everything else — the KV
 * writes, the routing, the recipient view — is the real thing.
 */
export default defineConfig({
  testDir: './e2e',
  // The bloom is a deliberately slow, staged animation; these are not snappy unit tests.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Serial. Both specs share one Worker and one local KV, and the point of this suite is
  // fidelity to a single user's journey, not throughput.
  workers: 1,
  fullyParallel: false,
  // Never let a green run hide a `.only` left behind in a spec.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://localhost:32100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    /*
     * Run as a reduced-motion visitor.
     *
     * Not only a flake workaround, though it is that too: "open the garden" carries an infinite
     * attention pulse, so Playwright's stability check never passes and the click times out after
     * a minute. Forcing the click would paper over exactly the kind of "can a person actually
     * press this" problem the suite exists to find.
     *
     * The app already turns those animations off under prefers-reduced-motion, so asking for it
     * puts the run on a path the app deliberately supports, and makes that path tested rather
     * than assumed. The trade-off is real and worth naming: the entrance animations themselves
     * (the staged bloom, the typewriter note) are not exercised here, only their end state.
     */
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // The Worker. AUTH_URL points at the local auth service, which is not running here; the
      // app is anonymous-first, so /api/me simply resolves to a signed-out user and every flow
      // this suite covers works signed out.
      command: 'pnpm --filter @bloomnote/api dev',
      url: 'http://localhost:32200/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '../..',
    },
    {
      command: 'pnpm --filter @bloomnote/web dev',
      url: 'http://localhost:32100',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '../..',
    },
  ],
});
