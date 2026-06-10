# Blossom

A small app where you write someone a note and an LLM designs a one-of-a-kind garden for them — real flowers chosen and arranged to fit the recipient, each with a personal meaning. Send it as a link; the recipient opens it and watches the garden bloom.

**Live demo:** _[deploy and add link]_

**Stack:** React + TypeScript + Vite, Vercel Edge Functions, Google Gemini 2.5 Flash via function calling.

---

## What it does

1. You write a note to someone — a real one. Sister, coworker, the friend who keeps you sane.
2. You pick an occasion (birthday, thank you, sympathy, anniversary, get-well, just because) and the tone of the AI's response shifts accordingly.
3. The backend asks Gemini to read your note and design **3–5 real flowers** (rose, sunflower, peony, lily, etc.) that represent the recipient, with palettes, petal shapes, and a one-sentence "what this flower says about them."
4. The flowers render in pure SVG, bloom in sequence with a Web Audio chime, and a few petals drift across the scene. A shareable URL appears inline.
5. You hit Share (native OS share sheet on mobile, Copy link on desktop) and send.
6. The recipient opens the link and watches their garden bloom, with your note attached and each flower's meaning visible.
7. They hit **"grow one back"** and write you a note in return. Their garden ships back to you, and your original note travels with it as thread context. The exchange is a loop, not a one-shot.

The whole conversation — your note, the AI's flowers, the AI's bouquet note, occasion, and the previous turn of the thread — is encoded directly into the share URL. No database, no account, no recipient-side API calls. The URL stays bounded because the thread is depth-capped at 1 (you see the current garden + the one it replied to, no further back).

One field, one button. The note is both your message to the recipient *and* the AI's design input. A vague note ("happy birthday") gets a warm but generic garden; a specific note ("she keeps a tide journal and drove six hours to see a sunset") gets a garden full of specifics. That's deliberate — it teaches the user what makes the output good.

---

## Why this exists

This started as a "pick flowers from 8 presets" toy. The interesting question was: what if the model **designs the flowers**, not just picks from a list? That single change turns a CRUD form into something closer to a small creative product — every garden is unique because every person is.

The rest of the project is about doing that well: a streaming UX that doesn't feel like a long pause, a strict function-call schema that guarantees valid output, post-hoc validation to catch the things the schema can't, and rendering code that can take any palette + shape combination the model invents.

---

## Architecture

```
┌────────────────────┐    POST /api/design-garden     ┌──────────────────────┐
│ React (Vite)       │ ────────────────────────────▶  │ Vercel Edge function │
│  Composer.tsx      │                                │  api/design-garden.ts│
│  GardenScene.tsx   │ ◀── text/event-stream ──────── │                      │
│  FlowerLegend.tsx  │   start | thinking | complete  │  Google Gen AI SDK   │
│  RecipientView.tsx │                                │  Gemini 2.5 Flash    │
└────────────────────┘                                └──────────────────────┘
         │
         │  POST /api/shorten
         ├──────────────────────────────▶ TinyURL (server-side proxy)
         │
         │  ?garden=…  share URL with the whole garden encoded
         │
         ▼
┌────────────────────┐
│ RecipientView      │
│  Watches the bloom │
│  Hits "grow back"  │
│  → /?remix=…       │
└────────────────────┘
```

- **Frontend** (`src/`) is a plain Vite React app. `useState` / `useEffect` / CSS modules / SVG — no exotic dependencies.
- **Backend** (`api/design-garden.ts`, `api/shorten.ts`) is two Edge functions. The design endpoint validates the request, rate-limits by IP, then streams a Gemini function-call back as Server-Sent Events. The shorten endpoint proxies to TinyURL so the share URL stays short.
- **Shared schema** (`src/garden.ts` + `api/prompt.ts`) defines the flower type once. The same shape is the SVG renderer's input, the URL-encoded garden payload, *and* Gemini's function-call schema.

The handler in `api/design-garden.ts` is written against the Web-standard `Request`/`Response` types, not Express or Next-specific shims. A small adapter in `vite.config.ts` runs the exact same file under Vite's dev server — so dev/prod parity is total. Adding a new `/api/<name>` endpoint requires zero config changes; the adapter generically resolves the path.

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

The wire-format `value` is decoupled from the displayed `label`, so the casual UI labels ("happy bday", "thinking of you") can change without invalidating drafts in localStorage or breaking the backend's tone-mapping.

### Streaming for timeout safety, not progress UX

Gemini 2.5 Flash returns this whole response in 3–8 seconds. With streaming I get **no HTTP timeouts** under any backend's connection limits. I emit `start` → `thinking` → `complete` SSE events. I don't fake per-flower progress — Gemini returns function-call args assembled rather than as streaming deltas, so there's nothing to genuinely report mid-stream. The on-brand sprout-grows-and-retracts spinner does the work of "something is happening" without lying about progress.

### Streaming, but no URL flicker

The share card is gated on the *short* URL arriving, not the long URL. After the design lands, the frontend stays in the designing phase (status: "shortening link…") until either TinyURL responds or a 3-second timeout fires. Whichever URL ends up on screen is the only one the user ever sees. No flash of long-URL-then-it-changes.

### Rendering arbitrary AI palettes

The original code drew flowers from a hardcoded 8-flower table. Now `FlowerSVG.tsx` takes a `FlowerSpec` directly — any combination of palette, petal shape (one of 5: round, elongated, bell, small, star), petal count (5–14), and stem height the model invents will render. Adding the `star` shape was a single switch arm and a points table.

### The remix loop, with depth-capped URL state

When the recipient hits "grow one back," they're taken to the composer with their reply's `from`/`to` prefilled and the original sender's garden visible as thread context. The reply's encoded URL contains both gardens — but the URL is **depth-capped at 1**, so the *next* reply doesn't accumulate a third turn into the URL.

Without the cap, a five-message thread would produce a 5× nested encoded URL. With the cap, each share is at most "current garden + the one it replied to" — exactly enough context for the human to follow the conversation, never enough state to balloon URL length.

### Native share, with a Copy fallback

`navigator.share` is feature-detected at mount. When available (iOS Safari, Android Chrome, modern desktop Safari), a "share" button appears as the primary action — opens the OS share sheet for iMessage, WhatsApp, Slack, etc. with the URL + a contextual title pre-filled. When absent (Chrome desktop, Firefox), the button isn't rendered and Copy stays primary. No broken affordance on any platform.

### Autosave + clear with undo

The composer's `From`, `To`, `message`, and `occasion` autosave to `localStorage` on every keystroke. A clear-draft link appears only when there's content to clear; clicking it wipes the form and shows a floating "draft cleared / undo" toast for 8 seconds. No destructive confirm dialog — speed matters, and undo is the modern alternative.

### View Transitions API for phase changes

Composer's `idle → designing → designed` phase transitions use `document.startViewTransition` with `flushSync` from React DOM to force the state updates synchronously inside the transition callback. Phase changes cross-fade smoothly instead of snapping. Feature-detected and falls back to plain updates on browsers without the API.

### Print stylesheet

`Cmd+P` from the recipient view renders the garden as a printable greeting card — grain overlay removed, CTAs hidden, animation states forced to their visible end state (so flowers don't print invisibly), generous page margins, white background. The card stays; the UI chrome goes.

### Anti-abuse, just enough

In-memory per-IP rate limiting (8 requests/min) on top of Gemini's free-tier quota. For a production public demo I'd add Vercel KV / Upstash as the backing store so the limiter survives function cold starts.

### One handler, dev and prod

`vite.config.ts` includes a small `apiPlugin()` that adapts Node's `IncomingMessage` to a Web `Request`, calls the handler in `/api/<name>.ts`, then pipes the streaming `Response.body` back. Same files run under `npm run dev` and under Vercel's Edge runtime — no mock backend, no dev-only Express server, no `if (process.env.NODE_ENV)` branches. Adding a new endpoint is literally a new file; the route is auto-resolved.

---

## Trade-offs and what I'd do next

- **Quality ceiling.** Gemini 2.5 Flash gives ~85% of frontier-model quality on this task. The flowers are good; Claude Opus or GPT-4o would be a notch better at the specifically poetic naming. Easy swap if it matters — see [Swapping the provider](#swapping-the-provider).
- **No prompt caching.** Gemini's API doesn't expose prompt caching the way Claude's does. The system prompt + schema get re-sent every request. With Flash and small prompts this is cheap; on a paid Claude deployment I'd want the cache breakpoint back.
- **Memory rate limiting.** Mentioned above. Two-line swap to KV.
- **Result memoization.** Identical notes currently re-call the model. Caching results by `hash(message + recipient + occasion)` for a few hours would cut quota usage if the demo URL goes viral.
- **No tests.** This is a demo; the tests-to-features ratio is intentionally zero. The pieces I'd test first: SSE frame parsing in `lib/designGarden.ts`, URL encoding round-trip in `garden.ts`, and `validateGarden()` against a few adversarial fixtures.
- **Print depends on bloom being complete.** If the user prints before flowers finish blooming (~1.5s after page load on RecipientView), they get an empty plot. The print stylesheet forces animation-end states for `opacity`/`transform`, but the React-state-gated bloom isn't fixable from CSS alone. Edge case.

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

`vercel.json` pins `api/design-garden.ts` and `api/shorten.ts` to the Edge runtime.

---

## Privacy note

The note you write is sent to Google's Gemini servers for processing. Anyone with the share URL can read the note (it's encoded directly into the URL). Don't put anything in the message you wouldn't want a recipient to forward — they can.

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
  design-garden.ts       # Edge function: SSE proxy to Gemini with function calling
  prompt.ts              # System prompt + function schema + post-hoc validator
  shorten.ts             # Edge function: TinyURL proxy

src/
  App.tsx                # Routes between composer and recipient view
  garden.ts              # Schema, URL encoding (depth-capped), example garden
  sound.ts               # Web Audio API + haptic helper
  index.css              # CSS vars, base styles, grain overlay, view-transition + print blocks
  lib/
    designGarden.ts      # Fetches /api/design-garden and parses SSE
    shorten.ts           # Fetches /api/shorten
    draft.ts             # localStorage autosave (load / save / clear)
    formatDate.ts        # Intl.DateTimeFormat wrapper for "Grown {date}"
    occasions.ts         # Occasion list (value + label)
    viewTransition.ts    # withViewTransition helper (flushSync + startViewTransition)
  components/
    Composer.tsx         # idle → designing → designed; remix-mode aware
    RecipientView.tsx    # What the recipient sees when opening a link
    GardenScene.tsx      # The animated garden + drifting petals
    FlowerSVG.tsx        # One animated flower; renders any FlowerSpec
    FlowerLegend.tsx     # Color swatches + name + meaning per flower, staggered reveal
    RemixContext.tsx     # Thread context panel (mini flowers + quoted note)

public/
  favicon.svg            # 6-petal pink flower (matches the OG image identity)
  og.svg                 # Open Graph share preview — same flower, scaled, with wordmark

vite.config.ts           # React plugin + generic /api/* dev adapter
vercel.json              # Pins Edge runtime per endpoint
LICENSE                  # MIT
```
