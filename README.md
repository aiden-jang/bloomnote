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

The Worker hands the note to Gemini, which is _forced_ to call a `design_garden` function and
returns 3–5 flowers with palettes, petal shapes, and a one-line meaning each. The flowers render
in SVG and bloom in sequence, streamed over SSE so you see progress. "Different flowers" re-rolls
with the same inputs.

You get a short link to share. The recipient opens it, watches it bloom, reads the meaning behind
each flower, and can grow one back: the reply carries your original garden as thread context. You
can also schedule delivery: the recipient sees a sealed envelope counting down to the moment you
picked. bloomnote works fully signed out; an account just gives you a synced list of gardens
you've sent and received.

Two smaller things on the recipient's side, both aimed at the same gap. Pointing at a flower
highlights its line in the legend and vice versa: every meaning was written about one specific
flower, so without that link the garden is a picture, the meanings are a list, and matching them
up means comparing colour swatches by eye. And a watering can under the plot gives a one-tap way
to answer, because otherwise the sender hears nothing at all unless someone composes a whole
garden back, which is more than most people will do for a feeling that only needs acknowledging.

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
per-minute and a global daily ceiling), and the check fails _open_ on KV hiccups so a metering
blip never blocks a legitimate garden. The key is a wrangler secret; with no key the SSE
error-path is still exercised.

The daily ceiling is 15, which looks arbitrarily small until you check the actual limit it guards:
the Gemini free tier allows 20 `generateContent` requests per day per project for this model. It
was originally 800, a number chosen without looking, so the guard could never fire and the app's
own honest "at capacity for today" message was unreachable. Past the real quota every visitor
instead got "the garden service is busy, please try again" about something that could not succeed
until midnight Pacific. A cap that never fires is not a conservative cap, it is a decorative one.

Below 20 rather than at it because one generation can spend more than one request: a transient
failure is retried up to three times and every attempt counts against the quota. And because a
429 means two different things, the client now reads the error body and tells the per-day quota
apart from a per-minute burst, retrying the second and never the first.

**Time capsules are entirely client-side.** Scheduling adds one `unlockAt` string to the record.
No cron, no server timer. `SealedView.tsx` counts down in the browser with an interval that slows
as the unlock recedes, so it isn't running a 60Hz timer for a two-week wait. Editing your device
clock opens it early; this is choreography, not a vault.

**The recipient's view is the only thing in the main bundle.** Every other route (composer,
archive, legal) is a `React.lazy` chunk. The whole app used to ship as one file, so opening a
garden link on a phone downloaded the composer, the schedule picker and the archive before the
garden could draw. The recipient view stays eagerly loaded because that is the moment this product
exists for and it should never wait on a second request; everything else sits behind a click and
can afford one.

**Saving a garden puts it in Photos, not Files.** The share card rasterises the garden to a PNG and
hands it to `navigator.share({ files })`, which on a phone opens the OS sheet with "Save Image" in
it. The catch is that `share` only works while a user gesture is still live, and a 2160px garden
takes about a second to rasterize. Rendering it inside the tap handler spent the activation before
the sheet opened, `share` threw, and the code fell through to a plain download, which lands in
Files. The PNG is now rendered when the share card first appears, so the tap has a blob waiting.

**Accounts are optional and additive.** Anonymous create + public links always work. Signing in
adds a synced archive: gardens are indexed under `sent:<uid>:<id>` and `recv:<uid>:<id>` prefixes
in the same KV, and a first-login claim step attaches anonymously-created gardens to the new
account. The identity itself comes from the shared auth service via a same-origin `/api/me`, so
the browser never talks to accounts cross-origin.

## Trade-offs

- **Model quality.** Flash gets most of the way there and costs nothing on the free tier, which
  matters for a public demo. Where it shows is the prose: a frontier model reaches for the note's
  specifics more reliably and needs less prompting not to drift into greeting-card filler. Swapping
  the provider is `designGarden.ts` + `prompt.ts`, roughly thirty lines.
- **Link-preview cards are written once, by the sender's browser.** The card is rasterised
  client-side after the bloom and POSTed to `/api/garden/:id/og`, which accepts it only if the
  garden exists, the bytes start with a PNG signature, and nothing is stored there yet. Anyone can
  POST to a known id, so allowing overwrites would let a stranger replace the picture on somebody's
  gift; first write wins and the rest get a 409. Gardens created before this shipped have no card
  and unfurl with the homepage image, which is the honest outcome of not backfilling.
- **Watering is an anonymous counter, not a vote.** The recipient taps a watering can and the
  sender sees it next time they open their own link, the only signal that a garden landed short of
  composing a whole one back. There is no identity to hang it on, so the client remembers its own tap
  and the server caps the total at 99. Someone determined can walk a garden they were given up to the
  cap; the worst outcome is a number that reads "a lot", which isn't a lie about anything that
  matters. Making it honest would mean making people sign in to say "this was nice", which costs more
  than the gesture is worth.
- **Orphaned records.** Re-rolling writes a new record and abandons the old one. Fine at this
  scale; past heavy traffic I'd overwrite in place or expire them.

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
  src/lib/gardenImage     the garden as a PNG: share card, link preview, pressed-flower card
  public/                favicon + generated icons + manifest + og.svg (see gen:icons)
scripts/check-css-vars.mjs  fails the build on a var() naming an undeclared custom property
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
guessable, but the link _is_ the access token, so don't write anything you wouldn't forward.

## Tests

```bash
pnpm -r test                         # 154 tests: 69 API, 85 web
                                     # KV store, validation, quota classifier, SSE route
pnpm --filter @bloomnote/web e2e     # Playwright: compose → bloom → share → recipient
```

Fast, offline, and safe to run on every commit. Gemini is stubbed at `fetch` throughout: in the
unit tests and again in the browser, where the one call that would cost money is intercepted and
fulfilled with a canned SSE stream. Neither suite touches the daily quota.

The end-to-end suite exists because this app's real bugs have almost all been invisible to the
other layers: black flowers from a missing `stemHeight`, a legend whose colours were undefined
tokens, a mini-garden clipped by a `transform` that doesn't affect layout. Typecheck, lint and unit
tests were green through every one of them. Only a render catches that class of bug.

One trap worth knowing: `reducedMotion` set in the Playwright config's `use` block never reaches
the page. `matchMedia` keeps reporting false, so it looks configured and does nothing. It is
emulated per-page with `page.emulateMedia()` in a `beforeEach` instead.

The SSE route is the one worth knowing about: `/api/design-garden` always returns 200 with a
stream, so a failed generation is not an HTTP error but a well-formed response carrying an `error`
event. Nothing else in the toolchain can see the difference, which is why those cases are tested
explicitly.

Formatting is Prettier, checked in CI. `.prettierrc.json` describes the style the code was already
written in (no semicolons, single quotes, 110 columns) rather than the default it was drifting
against. A handful of hand-laid data tables carry `// prettier-ignore`: the star field, the petal
fall, the sky gradients, the per-shape petal control points. Those are grids you read by column, and
one entry per line destroys the thing they exist to show.

`pnpm css-vars` (run by `build` and in CI) fails on a `var(--x)` naming a custom property nothing
declares. This failure is silent by construction: with a fallback the rule quietly uses it, and
without one `color` inherits while `fill` renders black. Six of these shipped before the check
existed, including a wax seal that rendered as a black dot on the screen it is the centrepiece of.
A fallback does not make the reference legitimate, so it is reported either way.

### Prompt eval

The prompt does real work that no type checker can see. Its most important rule is that a garden
should talk about the note the sender actually wrote: given "you drove four hours in the rain to
sit in a hospital car park", the output should say four hours, or rain, or the car park, and not
"thank you for your unwavering support", a line that would work for a stranger. That is a
property of generated prose, so the only honest way to check it is to generate and measure.

```bash
pnpm --filter @bloomnote/api eval
```

Deliberately separate from `pnpm test`, and named `*.eval.ts` so vitest's default include can't
sweep it into a normal run: every case spends a real Gemini call. Needs `GEMINI_API_KEY` in
`packages/api/.dev.vars`.

**Mind the budget.** The Gemini free tier allows **20 `generateContent` requests per day** for this
model, project-wide. The default run is four fixtures at one generation each, so it costs 4 of the
20 and prints that total before it spends anything. `EVAL_RUNS=3` gives majority-of-three voting,
which is much better evidence about a sampled model, and costs 12 of the 20. Worth it when a prompt
change is worth confirming; not on every edit.

Run it after editing `prompt.ts`. If the daily quota is gone it says so in those words and stops,
rather than reporting a prompt regression it never observed.

Knobs: `EVAL_RUNS` (default 1) and `EVAL_PACE_MS` (default 4000).

The same 20/day limit is why `DAILY_CAP` in `designGarden.ts` is 15 and not 800: past the real
quota the app should say "at capacity for today", not "the garden service is busy, please try
again" about something that cannot succeed until midnight Pacific.

## Talking about this

**The short version.** Write someone a note and a language model grows them a garden from it. The
note is the design brief, so a specific note produces a specific garden, and no two are the same.

**The shape.** The browser posts the note to a Worker, which calls Gemini and streams progress back
over SSE while the flowers bloom in sequence. Gemini is forced to call a `design_garden` function
with a typed schema, so it returns structured flowers instead of prose I'd have to parse. The garden
gets written to KV under a 6-character id and that's the share link. Reads are edge-cached for a
year because a garden never changes once it's written.

**The call I'd defend.** Function calling instead of asking for JSON. Prompting a model to "return
JSON" leaves you a parser and a failure mode where it answers in a sentence. Forcing a function call
removes that mode entirely. The catch is that the schema is a subset of OpenAPI and can't express
regex or array bounds, so those rules live in the field descriptions where the model reads them, plus
a validation pass that rejects bad output. A bad petal count becomes a clean error event rather than
a half-drawn flower.

**The number I got wrong.** The daily generation cap was 800, picked without looking anything up. The
actual Gemini free tier is 20 requests a day for this model. So the guard could never fire, and past
the real quota every visitor got "the service is busy, try again" about something that couldn't
succeed until midnight Pacific. It's 15 now, deliberately under 20, because one generation can spend
more than one request when a transient failure retries. A cap that never fires isn't conservative,
it's decorative.

**What breaks first.** The model quota, by a wide margin. It's the only metered thing and it's small.
Everything else is KV reads at the edge, which is the cheap part.

**What I'd change.** Time capsules are entirely client-side: scheduling writes one `unlockAt` string
and the browser counts down. Changing your device clock opens it early. That was the right call for
choreography, but if it ever needed to be a real guarantee it would need the read path to check the
time server-side, and I'd rather have built that seam in from the start than retrofit it.

## Observability

- **Errors + requests:** Workers Logs is enabled (`[observability]` in `wrangler.toml`), so uncaught
  throws and handled errors (via `app.onError`) are captured. Tail live with
  `pnpm --filter @bloomnote/api exec wrangler tail`.
- **Uptime:** `GET /health` returns `{ status: 'ok' }`, ready for a free external monitor (e.g.
  UptimeRobot).
