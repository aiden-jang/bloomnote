import { env } from 'cloudflare:test'
import type { Env } from '../src/env.js'

/**
 * The test worker's bindings (a real in-memory KV for GARDENS), typed as the app's Env.
 *
 * GEMINI_API_KEY is pinned to a fake rather than inherited, for two reasons that have both bitten.
 *
 * Inherited, it comes from `.dev.vars`, which is gitignored because it holds the real key. So the
 * SSE tests passed on the machine that wrote them and short-circuited to a "not configured" 503 in
 * CI, where the file doesn't exist. A test that depends on an untracked secret is really testing
 * whose laptop it ran on.
 *
 * And a real key sitting in the env means a stub that fails to intercept quietly spends live quota
 * against a 20-a-day free tier instead of failing the test. A fake key cannot do that.
 *
 * The one test that covers the unconfigured branch overrides this back to '' explicitly.
 */
export const testEnv = { ...env, GEMINI_API_KEY: 'test-key-never-a-real-one' } as unknown as Env
