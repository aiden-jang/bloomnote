/** Bindings declared in wrangler.toml / secrets, surfaced to the Worker. */
export interface Env {
  // Garden short-URL store: `g:<shortId>` -> garden JSON.
  GARDENS: KVNamespace
  // The built web SPA (apps/bloomnote/web/dist), served from this same Worker.
  ASSETS: Fetcher
  // Base URL of the shared auth service; sessions are validated against it server-side.
  // Local dev overrides this with `--var AUTH_URL:http://localhost:34100`.
  AUTH_URL: string
  // Gemini key for garden generation. Wired in a later step (Gemini via fetch + budget cap).
  GEMINI_API_KEY?: string
}
