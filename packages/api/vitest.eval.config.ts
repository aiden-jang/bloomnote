import { defineConfig } from 'vitest/config'

// Live Gemini evals run separately from offline unit tests and may incur provider charges.
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
