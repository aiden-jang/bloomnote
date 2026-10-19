import type { Counters } from './counters.js'

export interface Env {
  EVENT_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
  GARDENS: KVNamespace
  COUNTERS: DurableObjectNamespace<Counters>
  ASSETS: Fetcher
  // Base URL of the shared auth service; sessions are validated against it server-side.
  // Local dev overrides this with `--var AUTH_URL:http://localhost:34100`.
  AUTH_URL: string
  GEMINI_API_KEY?: string
  // Optional so local dev and tests run without it: an absent binding just drops the events.
  EVENTS?: AnalyticsEngineDataset
}
