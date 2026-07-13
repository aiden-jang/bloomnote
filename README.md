# bloomnote

Write someone a note and a language model designs them a garden: three to five flowers chosen to
fit the person, each with a line about what it says about them. You send a link, they watch it
bloom, and they can grow one back.

**Live:** [bloomnote.aidenjang.com](https://bloomnote.aidenjang.com)

`TypeScript` · `Hono` · `Cloudflare Workers` · `KV` · `Gemini (function calling)` · `SSE` · `React` · `Vite`

> Part of a [platform of apps](https://github.com/aiden-jang/platform/blob/main/PLATFORM.md) that share one sign-in. Runs on Cloudflare's free tier.

---

## How it works

You write a note and pick an occasion (birthday, thank-you, sympathy, anniversary, just because)
and a mood (tender, playful, wistful, celebratory, steady). The note is both your message and the
design brief, so a specific note produces a specific garden. Occasion and mood bias the palette
and prose without forcing you through a combinatorial menu.

The Worker hands the note to Gemini, which is *forced* to call a `design_garden` function and
returns 3–5 flowers with palettes, petal shapes, and a one-line meaning each. The flowers render
in SVG and bloom in sequence, streamed over SSE so you see progress. "Different flowers" re-rolls
with the same inputs.

You get a short link to share. The recipient opens it, watches it bloom, reads the meaning behind
each flower, and can grow one back: the reply carries your original garden as thread context. You
can also schedule delivery: the recipient sees a sealed envelope counting down to the moment you
picked. bloomnote works fully signed out; an account just gives you a synced list of gardens
you've sent and received.

## Architecture

```
        Browser (React + Vite)                    bloomnote Worker (Hono) - one origin
   Composer / RecipientView / Sealed / MyGardens
        │  POST /api/design-garden (SSE)  ─────▶   designGarden.ts ─▶ Gemini 2.5 Flash
        │     start | thinking | complete          (raw REST generateContent, function call)
        │  POST /api/garden  ──────────────────▶   gardens.ts  ─────▶  KV
        │  GET  /api/garden?id=… ◀──────────────   g:<shortId> → garden JSON
        │  GET  /api/me ───────────────────────▶   getSessionUser → accounts.aidenjang (optional)
        │  app.all('*') ──────────────────────▶    built SPA (static assets + fallback)
```

## Decisions worth explaining

**The model designs the flowers; it doesn't pick from a list.** This started as a "choose from 8
presets" toy. Letting the model invent the palette, petal shape, and count for each flower is the
whole product. `FlowerSVG.tsx` takes a flower spec directly and draws whatever comes back, so a
new petal shape is one switch arm.

**Function calling instead of "please return JSON."** Gemini is forced to call `design_garden`
with a typed schema (`functionCallingConfig.mode = ANY`), which removes the "what if it answered
in prose" failure mode. Its schema is a subset of OpenAPI and can't express regex or array
bounds, so those rules live in the field descriptions (which the model reads) and a
`validateGarden()` pass that rejects bad output with a real error: a bad `petalCount` becomes a
clean error event, not a half-drawn flower.

**Short links on our own domain, in KV.** `POST /api/garden` writes the garden under a 6-char
base62 id (alphabet minus `0/O/1/l/I` for legibility) and returns it; `GET` reads it back with a
one-year immutable cache header, since a garden never changes once written. KV is the natural fit:
the id is the only thing you ever query on, reads are edge-cached, and there's no relational shape
to model. An earlier version used a third-party shortener, which put the recipient on someone
else's domain with an occasional interstitial. Both break the moment.

**No degraded fallback if the write fails.** The share card waits for the short link before it
appears. If the KV write fails the user sees an error, not a 450-character link. Silently shipping
a broken-looking share link trains people to distrust the app.

**A budget cap so a public demo can't run up a bill.** Gemini calls are metered in KV (per-IP
per-minute and a global daily ceiling), and the check fails *open* on KV hiccups so a metering
blip never blocks a legitimate garden. The key is a wrangler secret; with no key the SSE
error-path is still exercised.

**Time capsules are entirely client-side.** Scheduling adds one `unlockAt` string to the record.
No cron, no server timer. `SealedView.tsx` counts down in the browser with an interval that slows
as the unlock recedes, so it isn't running a 60Hz timer for a two-week wait. Editing your device
clock opens it early; this is choreography, not a vault.

**Accounts are optional and additive.** Anonymous create + public links always work. Signing in
adds a synced archive: gardens are indexed under `sent:<uid>:<id>` and `recv:<uid>:<id>` prefixes
in the same KV, and a first-login claim step attaches anonymously-created gardens to the new
account. The identity itself comes from the shared auth service via a same-origin `/api/me`, so
the browser never talks to accounts cross-origin.

## Trade-offs

- **Model quality.** Flash gets most of the way there and costs nothing on the free tier, which
  matters for a public demo. A frontier model writes slightly better flower names; swapping the
  provider is `designGarden.ts` + `prompt.ts`, roughly thirty lines.
- **Per-garden link previews aren't wired.** Every share currently unfurls with the homepage OG
  card, not a per-garden image. Rendering one on demand in the Worker is a clean future addition;
  it was descoped to keep the port lean.
- **Orphaned records.** Re-rolling writes a new record and abandons the old one. Fine at this
  scale; past heavy traffic I'd overwrite in place or expire them.
- **No tests on the SSE path yet.** The KV store and garden validation are unit-tested; a full
  compose → bloom → share → recipient pass is the honest gap.

## Project layout

```
api/                     bloomnote Worker (Hono)
  src/index.ts           routes: /api/* + SPA fallback; harden() middleware
  src/gardens.ts         KV store: create/read + sent/received indexes + first-login claim
  src/designGarden.ts    SSE proxy to Gemini (function calling) + KV budget cap
  src/prompt.ts          system prompt + function schema + validateGarden()
web/                     React + Vite SPA
  src/components/        Composer, RecipientView, SealedView, GardenScene, FlowerSVG, MyGardens …
  src/garden.ts          schema + short-link client helpers
  src/auth/, AuthNav     optional shared-auth integration
  public/                favicon + generated icons + manifest + og.svg (see gen:icons)
```

## Running locally

Requires **Node 22** (repo `.nvmrc`) and pnpm.

```bash
pnpm install

# API Worker on :32200 (Hono + local KV via Miniflare). The dev script points AUTH_URL at the
# local auth service (:34100), so a local login is validated there (not production). Run auth too.
pnpm --filter @bloomnote/api dev

# web SPA - http://localhost:32100
pnpm --filter @bloomnote/web dev
```

A real garden needs `GEMINI_API_KEY` as a `wrangler secret` (free key:
aistudio.google.com/apikey). Without it the composer still runs and exercises the SSE error path.
See [DEPLOY.md](DEPLOY.md) for the production runbook.

## Privacy

The note goes to Google's Gemini for processing and is stored in KV under the short id. Anyone
with the link can read it. Ids are random 6-char base62 (~56 billion values) so they aren't
guessable, but the link *is* the access token, so don't write anything you wouldn't forward.

## Tests

```bash
pnpm --filter @bloomnote/api test    # KV garden store + garden validation
```

## Observability

- **Errors + requests:** Workers Logs is enabled (`[observability]` in `wrangler.toml`), so uncaught
  throws and handled errors (via `app.onError`) are captured. Tail live with
  `pnpm --filter @bloomnote/api exec wrangler tail`.
- **Uptime:** `GET /health` returns `{ status: 'ok' }`, ready for a free external monitor (e.g.
  UptimeRobot).
