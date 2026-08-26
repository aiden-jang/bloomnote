import { defineConfig } from 'vitest/config'

/**
 * Config for the prompt eval only (`pnpm eval`).
 *
 * Plain Node, not the Workers pool the unit tests use: this makes real outbound calls to Gemini
 * and wants nothing to do with wrangler bindings or an in-memory KV.
 *
 * The include pattern is the reason the file is named `.eval.ts` rather than `.eval.test.ts` —
 * vitest's default include would otherwise sweep it into `pnpm test`, and a suite that spends
 * money and depends on a sampled model has no business running on every commit.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.eval.ts'],
    // A single fixture is RUNS sequential generations, paced under the free-tier quota, each with
    // its own long backoff if it still gets rate-limited. Generous on purpose: a timeout here
    // reads as a prompt failure when it is really just the eval being throttled.
    testTimeout: 600_000,
    hookTimeout: 600_000,
    // Fixtures share a per-IP rate limit upstream; running them in parallel just invites 429s.
    fileParallelism: false,
    maxConcurrency: 1,
  },
})
