# Blossom

A small app where you write someone a note and an LLM designs a one-of-a-kind garden for them — real flowers chosen and arranged to fit the recipient, each with a personal meaning. Send it as a link; the recipient opens it and watches the garden bloom. They can grow one back.

**Live demo:** _[deploy and add link]_

**Stack:** React + TypeScript + Vite, Vercel Edge Functions + Edge Middleware, Google Gemini 2.5 Flash via function calling, Upstash Redis for short URLs, @vercel/og for server-rendered preview + share images, Vercel Analytics for the product funnel.

---

## What it does

1. You write a note to someone — a real one. Sister, coworker, the friend who keeps you sane. (First-timers see three example gardens on the homepage; tapping one pre-fills the form so they can experience the bloom moment without typing.)
2. You pick an **occasion** (birthday, thank you, sympathy, anniversary, get-well, just because) and a **mood** (tender, playful, wistful, celebratory, steady) — two orthogonal axes that bias the AI's palette + prose tone. The sky gradient behind the garden shifts in real time as you change occasion.
3. Optionally, you **schedule** the delivery — pick a future date/time and the recipient sees a sealed envelope with a live countdown until that moment. Time-capsule cards for birthdays, anniversaries, "open this when you graduate."
4. The backend asks Gemini to read your note and design **3–5 real flowers** (rose, sunflower, peony, lily, etc.) that represent the recipient, with palettes, petal shapes, and a one-sentence "what this flower says about them."
5. The flowers render in pure SVG, bloom in sequence with a Web Audio chime, and a few petals drift across the scene (with subtle parallax as you scroll). A shareable URL appears inline.
6. Don't love the bouquet? Tap **"different flowers"** to re-roll with the same inputs — keeps the note, swaps the garden. Iterate until it's right.
7. You hit Share (native OS share sheet on mobile, Copy link on desktop) and send. Or **save as image** (1080×1080) / **save as story** (1080×1920) — server-rendered PNGs you can drop into iMessage, Instagram Stories, screenshots, or a printed card.
8. The link preview crawler (iMessage, Slack, Discord) fetches a per-garden Open Graph image — the actual flowers from *this* garden, not a generic placeholder.
9. The recipient opens the link and watches their garden bloom, with your note attached and each flower's meaning visible behind a "why these?" disclosure.
10. They hit **"grow one back"** and write you a note in return. Their garden ships back to you, and your original note travels with it as thread context. The exchange is a loop, not a one-shot.

The garden lives in Upstash Redis keyed by a 6-character base62 short ID — so the share URL is `/g/abc123` instead of a 500-character blob, and the same KV record powers both the recipient view (`/g/<id>`) and the reply composer (`/r/<id>`). The thread is depth-capped at 1: you see the current garden + the one it replied to, no further back.

One field, one button. The note is both your message to the recipient *and* the AI's design input. A vague note ("happy birthday") gets a warm but generic garden; a specific note ("she keeps a tide journal and drove six hours to see a sunset") gets a garden full of specifics. That's deliberate — it teaches the user what makes the output good.

---

## Why this exists

This started as a "pick flowers from 8 presets" toy. The interesting question was: what if the model **designs the flowers**, not just picks from a list? That single change turns a CRUD form into something closer to a small creative product — every garden is unique because every person is.

The rest of the project is about doing that well: a streaming UX that doesn't feel like a long pause, a strict function-call schema that guarantees valid output, post-hoc validation to catch the things the schema can't, and rendering code that can take any palette + shape combination the model invents.

---

## Architecture

```
┌──────────────────────┐  POST /api/design-garden  ┌──────────────────────┐
│ React (Vite)         │ ─────────────────────────▶│ design-garden.ts     │
│  Composer.tsx        │ ◀── text/event-stream ── │  → Gemini 2.5 Flash  │
│  ShareCard.tsx       │   start | thinking | done │    (function call)   │
│  RecipientView.tsx   │                           └──────────────────────┘
│  SealedView.tsx      │
│  GardenScene.tsx     │  POST/GET /api/garden     ┌──────────────────────┐
│  FlowerLegend.tsx    │ ─────────────────────────▶│ garden.ts            │
│  ExampleCarousel.tsx │                           │  → Upstash Redis     │
└──────────────────────┘                           │    (KV: id → garden) │
         │                                         └──────────────────────┘
         │  /g/<id>     recipient view (fetch by id)
         │  /r/<id>     reply composer (same fetch)
         │
         │  share-link crawler GETs /g/<id>          ┌────────────────────┐
         ├─────────────────────────────────────────▶ │ middleware.ts      │
         │                                           │  injects og:image  │
         │                                           │  → /api/og?id=…    │
         │                                           └────────────────────┘
         │
         │  user taps "save as image" / "save as story"
         └─────────────────────────────────────────▶  /api/card?id=…       (1080×1080)
                                                     /api/story?id=…      (1080×1920)
                                                     server-rendered PNG via @vercel/og
                                                     with Fraunces fetched from Google Fonts
```

- **Frontend** (`src/`) is a plain Vite React app. `useState` / `useEffect` / CSS modules / SVG — no exotic dependencies.
- **Backend** is five Edge functions plus Edge middleware:
  - `api/design-garden.ts` — SSE proxy to Gemini with function calling
  - `api/garden.ts` — KV-backed short-URL shortener (POST → id, GET ?id=xxx → garden)
  - `api/og.tsx` — per-garden 1200×630 Open Graph PNG, server-rendered via `@vercel/og`
  - `api/card.tsx` — per-garden 1080×1080 download (Instagram square, iMessage, printed card)
  - `api/story.tsx` — per-garden 1080×1920 download (Instagram Stories, TikTok)
  - `middleware.ts` — intercepts `/g/<id>` requests from link-preview crawlers, rewrites `<meta og:image>` to point at `/api/og?id=<id>` so previews show the actual garden
- **Shared schema** (`src/garden.ts` + `api/prompt.ts`) defines the flower type once. The same shape is the SVG renderer's input, the KV record format, *and* Gemini's function-call schema.
- **Shared helpers** (`api/_lib/`) — Redis client, rate limiter, Fraunces font loader, FlowerSilhouette JSX. Each one is imported by multiple endpoints; consolidating them here keeps a single source of truth.

The handlers are written against Web-standard `Request`/`Response` types, not Express or Next-specific shims. A small adapter in `vite.config.ts` runs the exact same files under Vite's dev server — so dev/prod parity is total. Adding a new `/api/<name>` endpoint requires zero config changes; the adapter generically resolves the path.

---

## Notable engineering decisions

### Picking the provider: why Gemini, not Claude or GPT

A creative task like this gets best quality from a frontier model (Claude Opus, GPT-4o). It gets **free** quality from Gemini 2.5 Flash's no-credit-card tier. For a public portfolio demo where a hostile visitor with a script could drain credits, "no risk of an accidental bill" beats a small quality edge — and Gemini Flash is genuinely good at this kind of structured-creative output.

The architecture is **provider-agnostic on purpose**: the function-call schema, the SSE protocol, the rendering pipeline, and the validation layer all work with Claude and GPT. Swapping providers is ~30 lines in `api/design-garden.ts` — the SDK client, the streaming-call shape, and how to extract the structured output. See [Swapping the provider](#swapping-the-provider).

### Function calling, not "ask for JSON"

I force Gemini to call a `design_garden` function with a structured schema (`api/prompt.ts`) and set `functionCallingConfig.mode = ANY` with `allowedFunctionNames: ['design_garden']`. This:

- Eliminates the "what if the model answered in prose?" failure mode.
- Gives me typed arguments back from the SDK instead of a string I'd have to parse.
- Lets me declare the shape — including enums for petal shapes and required field lists — in one place.

A "please output JSON" instruction would have worked maybe 95% of the time. The 5% would have been hard to debug.

### Server-side validation for what the schema can't enforce

Gemini's function-call schema is a subset of OpenAPI 3.0. It does **not** support `pattern` (no regex on hex colors), `minItems`/`maxItems`, or numeric `minimum`/`maximum` on integers. So I put those constraints in two places:

1. In the field **descriptions**, where the model reads them ("Exactly three hex colors", "5 to 14", etc.).
2. In a **post-hoc validator** (`validateGarden()` in `api/prompt.ts`) that rejects bad output with a precise error message.

If the model returns a `petalCount` of 23 or a non-hex `centerColor`, the frontend sees a clean `error` event with a useful message rather than a half-rendered broken flower.

### The occasion picker as a tone signal

A "happy birthday" message and a "thinking of you" sympathy message can have identical word patterns — the AI can't always tell from the note alone what tone is appropriate. So the user picks an occasion (`birthday`, `thank-you`, `anniversary`, `congrats`, `get-well`, `sympathy`, `just-because`) and the system prompt translates that into concrete tone guidance ("sympathy gardens are quiet whites and pale blues; birthday gardens are warm yellows and pinks"). One dropdown → meaningful output quality shift.

The wire-format `value` is decoupled from the displayed `label`, so the casual UI labels ("happy bday", "thinking of you") can change without breaking the backend's tone-mapping.

### Streaming for timeout safety, not progress UX

Gemini 2.5 Flash returns this whole response in 3–8 seconds. With streaming I get **no HTTP timeouts** under any backend's connection limits. I emit `start` → `thinking` → `complete` SSE events. I don't fake per-flower progress — Gemini returns function-call args assembled rather than as streaming deltas, so there's nothing to genuinely report mid-stream. The on-brand sprout-grows-and-retracts spinner does the work of "something is happening" without lying about progress.

### Self-hosted short URLs at our own domain

Earlier versions of this app used TinyURL to shorten the share link. Two problems with that:

1. **Branding.** A recipient who clicks `tinyurl.com/2x9y` is on a third-party domain with no trust context. A recipient who clicks `blossom.aidenjang.com/g/abc123` knows where they are.
2. **Ads.** TinyURL injects an interstitial for some traffic patterns. That breaks the "open with a garden" emotional moment.

So I replaced TinyURL with a tiny KV-backed shortener that runs on the same Vercel deployment. Architecture:

- `POST /api/garden` accepts a garden JSON, generates a 6-char base62 ID (using the curated alphabet `a-z A-Z 2-9` minus `0/O/1/l/I` for typability), writes it to Upstash Redis with SETNX, returns the ID.
- `GET /api/garden?id=abc123` reads the garden back. Response carries `Cache-Control: public, max-age=31536000, immutable` because once a garden is written, its contents never change — both the browser and Vercel's CDN can cache it forever, so viral links don't repeatedly hit Redis.
- The share URL becomes `/g/abc123` and the reply URL becomes `/r/abc123`. Same KV record serves both views — `App.tsx` does one fetch and routes to RecipientView or Composer-with-seed depending on the path prefix. **One write, two views.**

Why a KV store instead of a relational table: a URL shortener is the canonical KV use case. The short ID *is* the primary key; there's no other field to query on. There's no "table" — just `g:abc123 → {"flowers":[...],"message":"...",...}`. Postgres would work and would add a column for `created_at`, but you'd pay setup complexity for capability you don't use.

### Streaming, but no URL flicker

The share card is gated on the short URL arriving. After the design lands, the frontend stays in the designing phase (status: "preparing link…") until the `POST /api/garden` round-trip completes — usually <200ms because it runs on the same Edge network as the model call. If the shortener fails, the user sees a clear error rather than a degraded long-URL fallback: the garden the user just spent 5 seconds designing being thrown away on failure is unfortunate, but a broken share experience is worse.

### Time-capsule scheduling

Optional opt-in: the sender picks a future date/time, and the recipient sees a sealed envelope with a live countdown until that moment instead of the garden. When the clock crosses the unlock time, the page transitions to the normal recipient view without a refresh.

Implementation details worth knowing:

- The `unlockAt` field is just an ISO 8601 string on the garden record — no separate "scheduled" data store, no cron, no server-side timer. The recipient's browser does the time math.
- `SealedView.tsx` runs a `setInterval` whose cadence scales with remaining time: ~250ms when under a minute (frame-accurate "0 seconds remaining" → bloom transition), 1Hz under an hour, every 30s under a day, every 5 min for longer. Avoids burning a 60Hz interval to count down two weeks.
- Tabular-figure CSS (`font-variant-numeric: tabular-nums`) on the countdown so the digits don't reflow horizontally as they change width.
- Clock-skew is treated as a UX choice, not a security concern: a recipient who manually edits their device clock can unlock early. The product isn't a vault; it's choreography.
- Inline validation on the picker rejects past dates with a 30-second grace window matching the server-side guard — the UI's `submit-disabled` state and the server's silent-drop logic agree on what counts as "in the future."

### Two orthogonal axes: occasion + mood

Occasion (`birthday`, `thank-you`, `sympathy`, ...) is *when*. Mood (`tender`, `playful`, `wistful`, `celebratory`, `steady`) is *how*. A birthday garden can be playful OR wistful, and they look meaningfully different — different palettes, different petal shapes, different bouquet-note prose.

A single flattened list ("birthday-playful", "birthday-wistful", ...) would explode combinatorially and force the user to pick from 35+ options. Two orthogonal axes keep each picker focused. Both feed into the system prompt — occasion as a labeled signal Gemini already understands, mood as a full directive block ("Wistful tone. Missing someone, sentimental, slightly bittersweet. Use muted palettes...") because mood needs to bias palette + petal shape + prose simultaneously, and a single token isn't enough signal.

### Per-occasion sky gradient

The sky behind the garden shifts subtly based on occasion: birthday gets warm peach, sympathy gets cool muted overcast, anniversary gets soft pink dusk, etc. Drives one decision (`SKY_GRADIENTS` table → `--sky-top` / `--sky-bottom` CSS variables → `.sky` background) with a `transition: background 0.6s ease` so the gradient cross-fades when the user changes the dropdown. Premium-feeling motion at the cost of zero JS — the browser interpolates the colors automatically.

### Re-roll without retyping

After a garden is generated, "different flowers" re-runs Gemini with the same inputs (message, recipient, from, occasion, mood, schedule) and replaces the result + creates a new KV record. The previous garden's record is left orphaned in Redis — Upstash's LRU eventually evicts it, and we never re-issue short IDs, so the orphan is harmless.

Two UX details:

- The flower row + share card stay on screen during the reroll round-trip; only the URL pill swaps to a "regenerating…" status. Avoids the "wait, did I lose my garden?" anxiety of a full state transition.
- On failure (rate limit, Gemini overload, network) the previous garden is restored from a snapshot so the user doesn't lose their first-shot result while trying for a better one. Failure surface is in-card, not a generic error block.

### Personalized OG images + Edge middleware

When someone shares `blossom.aidenjang.com/g/abc123`, the link preview in iMessage / WhatsApp / Slack / Discord shows the *specific garden* — actual flower silhouettes, sender's name, the bouquet note — instead of a generic placeholder. The trick is two pieces working together:

1. **`/api/og.tsx`** uses `@vercel/og` (satori under the hood) to render the garden as a 1200×630 PNG on demand. The garden data comes from the same KV record the recipient view uses. Per-garden image, immutable URL, edge-cached forever.

2. **`middleware.ts`** intercepts crawler requests for `/g/<id>` *before* they reach the static HTML, fetches the SPA's `index.html`, replaces the static `<meta og:image>` tag with `og:image=/api/og?id=<id>`, and returns the modified document. Without this, every shared URL would serve the same generic OG tag — crawlers don't run our React app, so SPA-injected meta tags wouldn't reach them.

Real Fraunces typography in the rendered images, not the default sans-serif fallback. `api/_lib/fonts.ts` fetches the regular + italic font files from Google Fonts at runtime, caches the bytes in module scope (one fetch per Edge isolate, then instant). Gotcha worth documenting: `@vercel/og`'s parser only handles TTF, but Google Fonts serves WOFF2 to modern UAs — so we spoof an old Safari User-Agent to coax Google into serving TTF instead. The comment in `fonts.ts` explains it so future-me doesn't try to "modernize" the spoof.

### Downloadable card + story exports

Two more server-rendered formats, same `@vercel/og` infrastructure:

- **`/api/card.tsx`** — 1080×1080 PNG with the garden, the message, the signature, and a footer wordmark. iMessage and Instagram-square friendly. Triggered by "save as image" in the share card.
- **`/api/story.tsx`** — 1080×1920 vertical for Instagram Stories / TikTok / Snapchat. Same garden data, different layout: hero flowers in the upper third, message + signature stacked in the lower third with breathing room calibrated for 9:16 viewing.

A `?download=1` flag flips the `Content-Disposition` from `inline` to `attachment` so clicking the link saves the file instead of navigating. The anchor uses `<a download>` so right-click "save link as" also works and screenreaders announce these as file links — the more honest semantic.

A `FlowerSilhouette` component in `api/_lib/silhouette.tsx` is shared across all three image endpoints (og, card, story). Each caller passes its own `size` / `stemWidth` / `maxStemHeight` so the silhouette scales to the canvas without duplicating the petal-ring math three times.

### Onboarding via example gardens

First-time visitors land on a composer with an empty form — and historically had no idea what to write. The fix: three curated example gardens in a horizontal-scroll carousel above the form, each showing a real sender → recipient line, a snippet of the message, and a tiny mini-garden preview. Tapping "try this" pre-fills every field (including occasion + mood) so the user can experience the bloom moment without typing.

Three examples cover three distinct moods (birthday/playful, just-because/wistful, thank-you/steady) — visitors see the *range* of what's possible immediately. The carousel hides itself as soon as the user types anything, so it doesn't keep occupying space during composition.

### Scroll parallax on drift petals

When the recipient scrolls down to read the message, the drifting petals appear to lag behind — they translate slightly *with* the scroll, opposing the natural upward motion of the scene scrolling out of view. Subtle enough that you can't quite name it, but the scene feels "alive" instead of "scrolling away."

Implementation: a passive scroll listener on the GardenScene root uses `requestAnimationFrame` coalescing to write `--scroll-y` once per frame. The `.petalLayer` reads the variable and translates via `translate3d` with `will-change: transform` for GPU compositing. Respects `prefers-reduced-motion` (skips the listener entirely).

### Rendering arbitrary AI palettes

The original code drew flowers from a hardcoded 8-flower table. Now `FlowerSVG.tsx` takes a `FlowerSpec` directly — any combination of palette, petal shape (one of 5: round, elongated, bell, small, star), petal count (5–14), and stem height the model invents will render. Adding the `star` shape was a single switch arm and a points table.

### The remix loop, with depth-capped thread state

When the recipient hits "grow one back," they're taken to the composer with their reply's `from`/`to` prefilled and the original sender's garden visible as thread context. The reply's stored record contains both gardens (new on top, original as `previous`) — but the chain is **depth-capped at 1**: when the composer attaches a remix seed as `previous`, it strips that seed's own `previous` first.

Without the cap, a five-message thread would produce a 5×-nested chain in storage. With the cap, each record carries at most "current garden + the one it replied to." The recipient view only renders one level back anyway; deeper history would be wasted storage and would slow the fetch with no UX upside.

### Native share, with a Copy fallback

`navigator.share` is feature-detected at mount. When available (iOS Safari, Android Chrome, modern desktop Safari), a "share" button appears as the primary action — opens the OS share sheet for iMessage, WhatsApp, Slack, etc. with the URL + a contextual title pre-filled. When absent (Chrome desktop, Firefox), the button isn't rendered and Copy stays primary. No broken affordance on any platform.

### Clear with undo, no persistence

A clear-draft link appears below the form only when there's actual content to clear. Clicking it wipes the form and shows a floating "draft cleared / undo" toast for 8 seconds. No destructive confirm dialog — speed matters, and undo is the modern alternative.

The form deliberately does **not** persist to `localStorage`. Refresh = empty form. The tradeoff: typing a long note and accidentally hitting reload loses your work. The win: every visit starts on a clean canvas without stale "old recipient, old note" state bleeding in. For a card-writing app where most sessions are one-and-done, fresh-on-refresh is the right default.

### View Transitions API for phase changes

Composer's `idle → designing → designed` phase transitions use `document.startViewTransition` with `flushSync` from React DOM to force the state updates synchronously inside the transition callback. Phase changes cross-fade smoothly instead of snapping. Feature-detected and falls back to plain updates on browsers without the API.

### Print stylesheet

`Cmd+P` from the recipient view renders the garden as a printable greeting card — grain overlay removed, CTAs hidden, animation states forced to their visible end state (so flowers don't print invisibly), generous page margins, white background. The card stays; the UI chrome goes.

### Anti-abuse, just enough

Per-IP rate limiting on top of Gemini's free-tier quota (8/min on `/api/design-garden`, 12/min on `/api/garden`). The limiter is Redis-backed (`api/_lib/rateLimit.ts` using `INCR` + `EXPIRE`), so the budget survives Edge function cold starts — a naive in-memory `Map` would let N parallel cold instances each grant the full budget independently. Falls open on Redis unreachable so an Upstash outage doesn't take down the whole API.

### One handler, dev and prod

`vite.config.ts` includes a small `apiPlugin()` that adapts Node's `IncomingMessage` to a Web `Request`, calls the handler in `/api/<name>.ts`, then pipes the streaming `Response.body` back. Same files run under `npm run dev` and under Vercel's Edge runtime — no mock backend, no dev-only Express server, no `if (process.env.NODE_ENV)` branches. Adding a new endpoint is literally a new file; the route is auto-resolved.

### Funnel-shaped analytics, not pageviews

The interesting question on a send-a-garden product isn't "how many people opened the homepage" — it's "did the link actually get sent, opened, *and* replied to?" So instead of generic pageview analytics I instrumented the product funnel explicitly:

`composer_opened` → `garden_generated` → `share_link_copied` → `garden_opened` → `garden_bloomed` → `reply_started`

All events are defined as typed functions in `src/lib/analytics.ts`, so the dashboard can never split between `garden_generated` and `garden_genrated`. Event props carry structural metadata (occasion, flower count, whether the user supplied a from-name, whether the garden is part of a reply thread) — but the note text, sender, and recipient never leave the client. Vercel Analytics is cookie-less by design, so no consent banner is required.

---

## Trade-offs and what I'd do next

- **Quality ceiling.** Gemini 2.5 Flash gives ~85% of frontier-model quality on this task. The flowers are good; Claude Opus or GPT-4o would be a notch better at the specifically poetic naming. Easy swap if it matters — see [Swapping the provider](#swapping-the-provider).
- **No prompt caching.** Gemini's API doesn't expose prompt caching the way Claude's does. The system prompt + schema get re-sent every request. With Flash and small prompts this is cheap; on a paid Claude deployment I'd want the cache breakpoint back.
- **Result memoization.** Identical notes currently re-call the model. Caching results by `hash(message + recipient + occasion + mood)` in Redis for a few hours would cut quota usage if the demo URL goes viral.
- **No tests.** Production-grade portfolios should have at least a Playwright suite covering the main flow (compose → bloom → share → recipient view). Tests-to-features ratio is intentionally zero right now; that's the next thing I'd add.
- **OG image cold-start latency.** First request to `/api/og` per Edge isolate pays ~480ms to fetch Fraunces from Google Fonts. Subsequent requests on the same isolate are 60ms (font cached in module scope). Bundling the TTF as a static asset would eliminate the cold-fetch entirely but adds ~80KB to every function deployment.
- **Print depends on bloom being complete.** If the user prints before flowers finish blooming (~1.5s after page load on RecipientView), they get an empty plot. The print stylesheet forces animation-end states for `opacity`/`transform`, but the React-state-gated bloom isn't fixable from CSS alone. Edge case.
- **Orphaned KV records.** Re-rolling creates a new garden record and abandons the previous one. Upstash's LRU eviction handles cleanup eventually, but a more thoughtful design would either DELETE the previous record explicitly or store the regenerated garden at the same ID (with cache-busting). Acceptable for current scale; would matter past ~10K writes/day.

---

## Running it

Requires **Node 18+** (Vite 5 + the Google Gen AI SDK both need it).

```bash
git clone <this repo>
cd blossom
cp .env.example .env
# get a free API key at https://aistudio.google.com/apikey
# paste it into .env as GEMINI_API_KEY

npm install
npm run dev
```

Open http://localhost:5173.

**Deploy to Vercel:**

```bash
npm i -g vercel
vercel
# set GEMINI_API_KEY in the project settings
```

`vercel.json` pins `api/design-garden.ts` and `api/garden.ts` to the Edge runtime.

**Set up Upstash Redis (required for share URLs):**

1. Sign up at https://upstash.com (free, no credit card)
2. Create a new Redis database — global is fine, the free tier covers it
3. Copy the **REST URL** and **REST Token** (NOT the TCP credentials — Edge functions can't use those)
4. Add as Vercel environment variables: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

Without Upstash configured, the composer surfaces a clear error after a garden is generated rather than degrading silently — a broken share experience is worse than a clear failure.

---

## Privacy note

The note you write is sent to Google's Gemini servers for processing and stored in Upstash Redis keyed by the short ID. Anyone with the share URL can fetch the note. The IDs are random 6-char base62 (≈56 billion possible values), so they're not enumerable by guessing — but the URL itself is the access token, so don't put anything in the message you wouldn't want a recipient to forward.

**Analytics:** Cookie-less Vercel Analytics is enabled. Pageviews and a handful of structural product events (`garden_generated`, `share_link_copied`, `garden_opened`, `garden_bloomed`, `reply_started`) are reported with metadata only — flower count, occasion, whether a from-name was provided, etc. The note text, sender name, and recipient name are never sent to analytics. The typed event surface lives in `src/lib/analytics.ts`.

---

## Swapping the provider

LLM specifics live in exactly two files: `api/design-garden.ts` (SDK client, streaming call, structured-output extraction) and `api/prompt.ts` (schema type literal).

To move to Claude Opus 4.7:
1. `npm install @anthropic-ai/sdk`
2. Convert `FLOWER_DESIGN_FUNCTION` to raw JSON Schema — you can re-add `pattern` for hex colors and `minItems`/`maxItems` for the flowers array, then drop those server-side checks from `validateGarden()`.
3. Replace the `generateContentStream` call with `client.messages.stream()` and `tool_choice: { type: 'tool', name: 'design_garden' }`.
4. Add a `cache_control: { type: 'ephemeral' }` breakpoint on the system block.

The frontend, SSE protocol, validation layer, and rendering code don't need to change.

---

## Project structure

```
api/
  design-garden.ts       # Edge: SSE proxy to Gemini with function calling
  prompt.ts              # System prompt + function schema + post-hoc validator
  garden.ts              # Edge: KV-backed short-URL shortener (POST create, GET read)
  og.tsx                 # Edge: per-garden 1200×630 OG image via @vercel/og
  card.tsx               # Edge: 1080×1080 download (Instagram square, iMessage)
  story.tsx              # Edge: 1080×1920 download (Instagram Stories, TikTok)
  _lib/
    redis.ts             # Shared Upstash client (lazy, env-gated)
    rateLimit.ts         # Redis-backed per-IP rate limiter (INCR + EXPIRE)
    fonts.ts             # Fraunces loader for @vercel/og (TTF via UA spoof)
    silhouette.tsx       # Shared FlowerSilhouette JSX for og/card/story

middleware.ts            # Edge middleware: injects per-garden og:image into /g/<id> HTML

src/
  App.tsx                # URL router — fetches garden by short ID, routes to composer / recipient / sealed / 404
  garden.ts              # Schema + short-URL client helpers (createShortGarden, fetchGarden)
  sound.ts               # Web Audio API + haptic helper
  index.css              # CSS vars, base styles, grain overlay, view-transition + print blocks
  data/
    exampleGardens.ts    # 3 curated example gardens for the onboarding carousel
  lib/
    designGarden.ts      # Fetches /api/design-garden, parses SSE, maps errors via friendlyError()
    analytics.ts         # Typed wrappers around Vercel Analytics's track()
    formatDate.ts        # Intl.DateTimeFormat wrapper for "Grown {date}"
    occasions.ts         # Occasion list (value + label)
    moods.ts             # Mood list + per-mood prompt hints
    viewTransition.ts    # withViewTransition helper (flushSync + startViewTransition)
  components/
    Composer.tsx         # Orchestrator: idle → designing → designed; remix-mode aware
    ShareCard.tsx        # Designed-state share UI (URL pill, share/copy/reroll/save/reset actions)
    ScheduleInput.tsx    # Time-capsule schedule control with inline validation
    ExampleCarousel.tsx  # 3 onboarding cards in a horizontal-scroll strip
    RecipientView.tsx    # What the recipient sees when opening a link
    SealedView.tsx       # Sealed envelope + live countdown for time-capsule gardens
    GardenScene.tsx      # The animated garden, drifting petals (with scroll parallax), per-occasion sky gradient
    FlowerSVG.tsx        # One animated flower; renders any FlowerSpec
    FlowerLegend.tsx     # Color swatches + per-flower meaning + "?" rationale disclosure
    RemixContext.tsx     # Thread context panel (mini flowers + quoted note)

public/
  favicon.svg            # 6-petal pink flower
  apple-touch-icon.png   # 180×180, generated from favicon.svg for iOS share sheet + home screen
  icon-192.png           # 192×192 PWA icon
  icon-512.png           # 512×512 PWA splash icon
  og.svg                 # Fallback Open Graph image for the homepage

scripts/
  gen-icons.mjs          # Rasterizes favicon.svg → apple-touch-icon + PWA PNGs (run via `npm run gen-icons`)

vite.config.ts           # React plugin + generic /api/* dev adapter (handles .ts and .tsx)
vercel.json              # SPA rewrite rules for /g/ and /r/ short-URL paths
LICENSE                  # MIT
```
