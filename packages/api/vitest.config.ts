import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

// Runs tests inside the Workers runtime with the real bindings from wrangler.toml (a local
// in-memory KV for GARDENS, a local Counters durable object), including its DO migration.
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
})
