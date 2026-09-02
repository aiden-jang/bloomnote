export interface Env {
  GARDENS: KVNamespace
  ASSETS: Fetcher
  // Base URL of the shared auth service; sessions are validated against it server-side.
  // Local dev overrides this with `--var AUTH_URL:http://localhost:34100`.
  AUTH_URL: string
  GEMINI_API_KEY?: string
}
