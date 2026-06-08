# Blossom

A small app where you describe someone you care about and an LLM designs a one-of-a-kind garden for them — invented flowers with their own names, palettes, and meanings. Send it as a link; the recipient opens it and watches the garden bloom.

**Live demo:** _[deploy and add link]_

**Stack:** React + TypeScript + Vite, Vercel Edge Functions, Google Gemini 2.0 Flash via function calling.

---

## What it does

1. You write a note to someone — a real one. Sister, coworker, the friend who keeps you sane.
2. The backend asks Gemini to read that note and design **3–5 invented flowers** that represent the recipient, with names, color palettes, petal shapes, and a one-sentence "what this flower says about them."
3. The flowers render in pure SVG and bloom in sequence with a Web Audio chime. A shareable URL appears inline.
4. You send the link. The recipient opens it and watches their garden bloom, with your note attached.
5. The recipient hits **"Grow one back"** and writes you a note in return. Their garden ships you back, and your original note travels with it as thread context. The exchange is a loop, not a one-shot.

The whole conversation — your note, the AI's flowers, the AI's bouquet note, and the previous turn of the thread — is encoded in the URL. No database, no account, no recipient-side API calls. The URL stays bounded because the thread is depth-capped at 1 (you see the current garden + the one it replied to, no further back).

One field, one button. The note is both your message to the recipient *and* the AI's design input. A vague note ("happy birthday") gets a warm but generic garden; a specific note ("she keeps a tide journal and drove six hours to see a sunset") gets a garden full of specifics. That's deliberate — it teaches the user what makes the output good.

---

## Why this exists

This started as a "pick flowers from 8 presets" toy. The interesting question was: what if the model **designs the flowers**, not just picks from a list? That single change turns a CRUD form into something closer to a small creative product — every garden is unique because every person is.

The rest of the project is about doing that well: a streaming UX that doesn't feel like a long pause, a strict function-call schema that guarantees valid output, post-hoc validation to catch the things the schema can't, and rendering code that can take any palette/shape combination the model invents.

---

## Architecture

```
┌────────────────────┐    POST /api/design-garden     ┌──────────────────────┐
│ React (Vite)       │ ─────────────────────────────▶ │ Vercel Edge function │
│  Composer.tsx      │                                 │  api/design-garden.ts│
│  GardenScene.tsx   │ ◀──── text/event-stream ─────── │                      │
│  FlowerSVG.tsx     │   start | thinking |            │  Google Gen AI SDK   │
└────────────────────┘   progress | complete           │  Gemini 2.0 Flash    │
                                                       └──────────────────────┘
```

- **Frontend** (`src/`) is a plain Vite React app. Nothing exotic — `useState`/`useEffect`, CSS modules, SVG.
- **Backend** (`api/design-garden.ts`) is one Edge function. It validates the request, rate-limits by IP, then streams a Gemini function-call back to the browser as Server-Sent Events.
- **Shared schema** (`src/garden.ts` + `api/prompt.ts`) defines the flower type once. The same shape is the SVG renderer's input, the URL-encoded garden payload, and Gemini's function-call schema.

The handler in `api/design-garden.ts` is written against the Web standard `Request`/`Response` types, not Express or Next-specific shims. A small adapter in `vite.config.ts` runs the exact same file under Vite's dev server, so there is no dev/prod skew — one implementation serves both environments.

---

## Notable engineering decisions

### Picking the provider: why Gemini, not Claude or GPT

A creative task like this gets best quality from a frontier model (Claude Opus, GPT-4o). It gets free quality from Gemini 2.0 Flash's no-credit-card tier (1500 requests/day, 15 RPM). For a public portfolio demo where a hostile visitor with a script could drain credits, "no risk of an accidental bill" beats a small quality edge — and Gemini Flash is genuinely good at this kind of structured-creative output.

The architecture is **provider-agnostic on purpose**: the function-call schema, the SSE protocol, the rendering pipeline, and the validation layer are all things Claude and GPT also expose. Swapping providers is ~30 lines in `api/design-garden.ts` — the SDK client, the streaming-call shape, and how to extract the structured output. The schema and prompt in `api/prompt.ts` move over as-is.

I'd swap to Claude Opus 4.7 for a paid production deployment in a heartbeat. Free demo: Gemini.

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

If the model returns a `petalCount` of 23 or a non-hex `centerColor`, the frontend sees a clean `error` event with a useful message rather than a half-rendered broken flower. The two-layer approach (description nudge + structural validator) is the realistic version of "strict schemas" when the SDK doesn't give you regex.

### Streaming, with cheap progress signaling

Gemini 2.0 Flash returns this whole response in 3–8 seconds. Without streaming, the browser sits silent for that long. With streaming I get two things:

1. **No HTTP timeouts** under any backend's connection limits.
2. **Live progress.** As chunks arrive I emit `start` → `thinking` events to keep the UI honest about what's happening. When the final function call lands and validation passes, I emit a `progress` event per flower before the final `complete` so the progress dots animate to full naturally.

The dot counter isn't fake. (Compared to the previous Claude version of this project, which counted partial JSON deltas mid-stream — Gemini returns function-call args assembled rather than as streaming deltas, so this version emits progress on the post-validation side. Same UX, different mechanic.)

### Rendering arbitrary AI palettes

The original code drew flowers from a hardcoded 8-flower table. Now `FlowerSVG.tsx` takes a `FlowerSpec` directly — any combination of palette, petal shape (one of 5), petal count (5–14), and stem height the model invents will render. Adding the `star` shape was a single switch arm and a points table; the rest is geometry that doesn't care what colors come in.

### Anti-abuse, just enough

In-memory per-IP rate limiting (8 requests/min) on top of Gemini's free-tier quota (15 RPM, 1500/day). For a production public demo I'd add Vercel KV / Upstash as the backing store for the rate limiter so it survives function cold starts.

### The handler runs unchanged in dev and prod

`vite.config.ts` includes a small `apiPlugin()` that:

1. Loads `.env` into `process.env` (Vite doesn't expose non-`VITE_` vars to server-side code by default).
2. Adapts Node's `IncomingMessage` to a Web `Request`, calls `handler(req)`, then pipes the streaming `Response.body` back to the Node `ServerResponse`.

That means **one file** (`api/design-garden.ts`) is the source of truth for the API in both `npm run dev` and Vercel production. No mock backend, no dev-only Express server, no `if (process.env.NODE_ENV === ...)` branches. The same byte sequence flows in both environments — including SSE chunking, error responses, and rate-limit state.

---

## Trade-offs and what I'd do next

- **Quality ceiling.** Gemini 2.0 Flash gives ~85% of frontier-model quality on this task for 100% of the cost-savings. The flowers it invents are good; Claude Opus would be a notch better at the specifically poetic naming. Easy to swap if it matters.
- **No prompt caching.** Gemini's API doesn't expose prompt caching the way Claude's does. The system prompt + schema get re-sent every request. With Flash and small prompts this is cheap; on a paid Claude deployment I'd want the cache breakpoint back.
- **Memory rate limiting.** Already mentioned above. Two-line swap to KV.
- **Result memoization.** Identical descriptions currently re-call the model. Caching results by `hash(description + recipient)` for a few hours would cut quota usage if a demo URL goes viral.
- **A11y.** Flowers are tappable buttons with `aria-label`s and the modal is keyboard-dismissable, but the bloom animation is not gated on `prefers-reduced-motion`. That's a one-liner I haven't added yet.
- **Tests.** This is a demo, so the tests-to-features ratio is intentionally close to zero. The pieces I'd test first if this were a real product: SSE frame parsing in `designGarden.ts`, URL encoding round-trip in `garden.ts`, and `validateGarden()` against a few adversarial fixtures.

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

The `vercel.json` already pins `api/design-garden.ts` to the Edge runtime.

---

## Swapping the provider

The architecture intentionally isolates LLM specifics in two files:

- `api/design-garden.ts` — SDK client, the streaming call, how to extract the structured output.
- `api/prompt.ts` — the schema type literal (Gemini uses `SchemaType.OBJECT`; Anthropic uses raw JSON Schema; OpenAI uses raw JSON Schema with `additionalProperties: false`).

To move to Claude Opus 4.7:
1. `npm install @anthropic-ai/sdk`
2. Convert `FLOWER_DESIGN_FUNCTION` back to the raw JSON Schema shape — you can re-add `pattern` for hex colors and `minItems`/`maxItems` for the flowers array, then drop those server-side checks from `validateGarden()`.
3. Replace the `generateContentStream` call with `messages.stream()` and `tool_choice: { type: 'tool', name: 'design_garden' }`.
4. Add a `cache_control: { type: 'ephemeral' }` breakpoint on the system block.

The frontend, SSE protocol, schema/validation, and rendering code don't need to change.

---

## Project structure

```
api/
  design-garden.ts       # Edge function: SSE proxy to Gemini with function calling
  prompt.ts              # System prompt + function schema + post-hoc validator

src/
  App.tsx                # Routes between composer and recipient view
  garden.ts              # Schema, URL encoding, example garden
  sound.ts               # Web Audio API sound engine
  lib/
    designGarden.ts      # Fetches /api/design-garden and parses SSE
  components/
    Composer.tsx         # Phase machine: idle → designing → designed → shared
    RecipientView.tsx    # What the recipient sees when opening a link
    GardenScene.tsx      # The animated garden canvas
    FlowerSVG.tsx        # One animated flower; renders any FlowerSpec
    FlowerCard.tsx       # Tap-to-reveal popover with flower name + meaning

vite.config.ts           # React plugin + dev adapter that runs api/ locally
vercel.json              # Pins api/* to Edge runtime
```
# blossom
