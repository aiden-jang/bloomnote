# Blossom

Write someone a note and a language model designs them a garden: three to five real flowers chosen to fit the person, each with a line about what it says about them. You send a link, they watch it bloom, and they can grow one back.

**Live:** [blossom.aidenjang.com](https://blossom.aidenjang.com)

**Stack:** React + TypeScript + Vite on the front end. Vercel Edge Functions and middleware on the back. Gemini 2.5 Flash designs the garden through a function call. Upstash Redis stores it behind a short link. `@vercel/og` renders the share images.

## How it works

You write a note and pick an occasion (birthday, thank you, sympathy, anniversary, just because) and a mood (tender, playful, wistful, celebratory, steady). The note is both your message and the design brief, so a specific note produces a specific garden. Occasion and mood are separate axes that bias the palette and the prose without forcing you through a combinatorial list.

The backend hands the note to Gemini, which calls a `design_garden` function and returns 3–5 flowers with palettes, petal shapes, and a one-line meaning each. The flowers render in SVG and bloom in sequence. If you don't like the result, "different flowers" re-rolls with the same inputs.

You get a short link to share, plus square (1080×1080) and story (1080×1920) PNG exports. Link previews in iMessage, Slack, and Discord show the actual garden rather than a placeholder. You can also schedule delivery: the recipient sees a sealed envelope counting down until the moment you picked.

The recipient opens the link, watches it bloom, reads the meaning behind each flower, and can grow one back. The reply carries your original garden with it as thread context.

## Architecture

```
React SPA (src/)                         Edge functions (api/)
  Composer / ShareCard      POST  ──────▶  design-garden.ts  ──▶ Gemini 2.5 Flash
  RecipientView / Sealed    SSE   ◀──────  (start|thinking|done)   (function call)
  GardenScene / FlowerSVG
                            POST/GET ────▶  garden.ts  ──────────▶ Upstash Redis
  /g/<id>  recipient view                                          (g:<id> → garden)
  /r/<id>  reply composer
  /mine    on-device archive
                            crawler GET /g/<id>
                                    └─────▶  middleware.ts  rewrites og:image → /api/og?id=…

  "save as image/story"  ─────────▶  og.tsx | card.tsx | story.tsx   (PNG via @vercel/og)
```

The handlers are written against the standard `Request`/`Response` types, not Express or Next shims. A small adapter in `vite.config.ts` runs the same files under Vite's dev server, so dev and prod behave identically and a new endpoint is just a new file in `api/`.

## Decisions worth explaining

**The model designs the flowers; it doesn't pick from a list.** This started as a "choose from 8 presets" toy. Letting the model invent the palette, petal shape, and count for each flower is the whole product. The renderer (`FlowerSVG.tsx`) takes a flower spec directly and draws whatever combination comes back, so adding a new petal shape is one switch arm.

**Function calling instead of "please return JSON."** Gemini is forced to call `design_garden` with a typed schema (`functionCallingConfig.mode = ANY`). That removes the "what if it answered in prose" failure mode and hands back typed arguments. Gemini's schema is a subset of OpenAPI and can't express regex or array bounds, so those rules live in the field descriptions (which the model reads) and in a `validateGarden()` pass that rejects bad output with a real error message. A bad `petalCount` becomes a clean error event, not a half-drawn flower.

**Short links on our own domain.** An earlier version used TinyURL, which puts the recipient on a third-party domain and sometimes shows an interstitial. Both break the moment. `POST /api/garden` writes the garden to Redis under a 6-character base62 id (alphabet minus `0/O/1/l/I` for legibility) and returns it; `GET` reads it back with a one-year immutable cache header, since a garden never changes once written. The same record serves both the recipient view and the reply composer: one write, two views. A key-value store is the natural fit here because the id is the only thing you ever query on.

**No degraded fallback if the shortener fails.** The share card waits for the short link before it appears. If the write to Redis fails, the user sees an error rather than a 450-character link. Throwing away a garden on failure is bad; a broken-looking share link is worse, and silently shipping one trains people to distrust the app.

**Per-garden link previews need Edge middleware.** Crawlers don't run the React app, so a meta tag injected client-side never reaches them. `middleware.ts` intercepts crawler requests for `/g/<id>`, fetches the SPA shell, and swaps in `og:image=/api/og?id=<id>` before returning it. The image itself is rendered on demand by `@vercel/og`. One catch worth flagging: its parser only handles TTF, but Google Fonts serves WOFF2 to modern clients, so `fonts.ts` spoofs an old Safari user-agent to get TTF for Fraunces. There's a comment there so nobody "modernizes" it later.

**Time capsules are entirely client-side.** Scheduling adds one `unlockAt` string to the record. No cron, no server timer, no second data store. `SealedView.tsx` counts down in the browser with an interval that slows as the unlock recedes (sub-second near zero, every few minutes when it's weeks away) so it isn't running a 60Hz timer for a two-week wait. Someone who edits their device clock can open early; this is choreography, not a vault.

**A local archive that never leaves the device.** "My gardens" (`/mine`) lists what you've sent, read from `localStorage` only (`lib/mine.ts`, capped at 50, oldest dropped first). It stores enough to rebuild the link and a few color swatches, nothing more, and it's never uploaded. It exists so a sender can find a link again without us keeping an account or a server-side history of who sent what.

**Analytics shaped like the funnel, not pageviews.** The question isn't how many people loaded the homepage; it's whether a link got sent, opened, and replied to. Events are typed functions in `lib/analytics.ts` (`garden_generated`, `share_link_copied`, `garden_opened`, `garden_bloomed`, `reply_started`) carrying structural metadata only: occasion, flower count, whether it's a reply. The note, sender, and recipient never reach analytics. Vercel Analytics is cookieless, so there's no consent banner.

## Trade-offs

- **Model quality.** Flash gets most of the way there and costs nothing on the free tier, which matters for a public demo a script could otherwise run up a bill on. A frontier model would write slightly better flower names. The provider lives in two files (`api/design-garden.ts`, `api/prompt.ts`); swapping it is roughly thirty lines.
- **No tests yet.** The honest gap. A Playwright pass over compose → bloom → share → recipient is the first thing I'd add.
- **Orphaned records.** Re-rolling writes a new record and abandons the old one to Upstash's LRU eviction. Fine at this scale; past heavy traffic I'd delete or overwrite in place.
- **Print before bloom.** Printing the recipient view before the flowers finish animating (~1.5s) gives an empty plot. The print stylesheet forces the end state for CSS, but the React-gated bloom isn't reachable from CSS alone.

## Running it

Needs Node 18+.

```bash
cp .env.example .env          # add GEMINI_API_KEY (free: aistudio.google.com/apikey)
npm install
npm run dev                   # http://localhost:5173
```

Short links need Upstash Redis. Create a free database, copy the **REST** URL and token (not the TCP ones; Edge can't use them), and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without them, the composer designs a garden and then shows an error instead of a link.

Deploy with `vercel`. `vercel.json` pins the Edge runtime and rewrites `/g/`, `/r/`, and `/mine` to the SPA. Set the same environment variables in the project settings.

## Privacy

The note goes to Google's Gemini for processing and is stored in Redis under the short id. Anyone with the link can read it. Ids are random 6-character base62 (~56 billion values) so they aren't guessable, but the link is the access token, so don't write anything you wouldn't want forwarded.

## Layout

```
api/
  design-garden.ts   SSE proxy to Gemini with function calling
  prompt.ts          system prompt + function schema + validator
  garden.ts          KV short-link store (POST create, GET read)
  og.tsx             1200×630 link-preview image
  card.tsx           1080×1080 export
  story.tsx          1080×1920 export
  _lib/              redis, rate limiter, font loader, shared flower silhouette
middleware.ts        injects per-garden og:image into /g/<id>
src/
  App.tsx            routes /g, /r, /mine, and the composer
  garden.ts          schema + short-link client helpers
  sound.ts           Web Audio chime + haptics
  data/              example gardens for onboarding
  lib/               designGarden (SSE), analytics, mine (local archive), occasions, moods, helpers
  components/        Composer, ShareCard, ScheduleInput, RecipientView, SealedView,
                     GardenScene, FlowerSVG, FlowerLegend, RemixContext, BouquetNote,
                     ExampleCarousel, MyGardens, SoundToggle
vite.config.ts       React plugin + dev adapter that runs api/* as-is
vercel.json          Edge runtime + SPA rewrites
```
