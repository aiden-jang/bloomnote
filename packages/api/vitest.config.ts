import { defineConfig } from 'vitest/config'
import { cloudflareTest } from '@cloudflare/vitest-plugin'

// Runs tests inside the Workers runtime with the real bindings from wrangler.toml (a local
// in-memory KV for GARDENS, a local Counters durable object), including its DO migration.
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.toml' } })],
  test: { setupFiles: ['./test/reset-storage.ts'] },
})
