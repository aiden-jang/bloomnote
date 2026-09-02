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
returns 3 to 5 flowers with palettes, petal shapes, and a one-line meaning each. The flowers render
in SVG and bloom in sequence, streamed over SSE so you see progress. "Different flowers" re-rolls
with the same inputs.

You get a short link to share. The recipient opens it, watches it bloom, reads the meaning behind
each flower, and can grow one back: the reply carries your original garden as thread context. You
can also schedule delivery: the recipient sees a sealed envelope counting down to the moment you
picked. bloomnote works fully signed out; an account just gives you a synced list of gardens
you've sent and received.

Two smaller things on the recipient's side close the same gap. Pointing at a flower highlights its
line in the legend, and pointing at a line lifts the flower. Each meaning was written about one
specific flower, and without that link the garden is a picture and the meanings are a list, matched
up by comparing colour swatches by eye.

The other is a watering can under the plot: one tap to say "I saw this." Without it the sender hears
nothing unless the recipient composes a whole garden back, which is more than most people will do
for a feeling that only needs acknowledging.

## Architecture

```
        Browser (React + Vite)                    bloomnote Worker (Hono) - one origin
   Composer / RecipientView / Sealed / MyGardens
        │  POST /api/design-garden (SSE)  ─────▶   designGarden.ts ─▶ Gemini 2.5 Flash
        │     start | thinking | complete          (raw REST generateContent, function call)
        │  POST /api/garden  ──────────────────▶   gardens.ts  ─────▶  KV
        │  GET  /api/garden?id=… ◀──────────────   g:<shortId> → garden JSON
        │  POST /api/garden/:id/water ─────────▶   waters:<id> (capped counter, no-store)
        │  GET  /api/me ───────────────────────▶   getSessionUser → accounts.aidenjang (optional)
        │  GET  /g/:id ───────────────────────▶    SPA shell with the garden's OG tags rewritten
        │  app.all('*') ──────────────────────▶    built SPA (static assets + fallback)
```

## Decisions worth explaining

The full decision log, with the alternatives that were rejected and the limitations that are still
open, is in [ARCHITECTURE.md](ARCHITECTURE.md). The four that shape everything else:

**The model designs the flowers; it doesn't pick from a list.** This started as a "choose from 8
presets" toy. Letting the model invent the palette, petal shape, and count for each flower is the
whole product. `FlowerSVG.tsx` takes a flower spec directly and draws whatever comes back, so a new
petal shape is one switch arm.

**Function calling instead of "please return JSON."** Gemini is forced to call `design_garden` with
a typed schema, which removes the "what if it answered in prose" failure mode rather than handling
it. Its schema can't express regex or array bounds, so those rules live in the field descriptions
and in a `validateGarden()` pass that rejects bad output with a real error.

**Short links on our own domain, in KV, with no expiry.** A garden is a keepsake, so a link that was
already sent has to keep working. Gardens are written under a 6-character id and read back with a
one-year immutable cache header, since a garden never changes once written.

**Anonymous first; accounts are additive.** Writing, sending and opening a garden all work with no
account. Signing in adds a synced archive and nothing else. That bet costs attribution, durability
for anyone who never signs in, and any moderation lever beyond a rate limit, all of which
[ARCHITECTURE.md](ARCHITECTURE.md) goes into.

## Project layout

```
packages/api/            bloomnote Worker (Hono)
  src/index.ts           routes: /api/* + SPA fallback; harden() and rate-limit middleware
  src/gardens.ts         KV store: create/read + sent/received indexes + first-login claim
  src/designGarden.ts    SSE proxy to Gemini (function calling) + KV budget cap
  src/prompt.ts          system prompt + function schema + validateGarden()
  src/rateLimit.ts       per-IP per-minute ceilings on every write, KV-backed and fail-open
  src/eventMeta.ts       the allowlist of event fields that may reach the logs
packages/web/            React + Vite SPA
  src/components/        Composer, RecipientView, SealedView, GardenScene, FlowerSVG, MyGardens …
  src/garden.ts          schema + short-link client helpers
  src/auth/, AuthNav     optional shared-auth integration
  src/lib/               pure helpers and hooks, each with its own tests: routing, scene geometry,
                         draft storage, archive ordering, journal, constellations, recap
  src/lib/imageCards     the four card compositions, as SVG
  src/lib/gardenImage    rasterising those cards: share card, link preview, pressed flower
  src/lib/lazyWithReload a code-split import that survives a deploy
  public/                favicon + generated icons + manifest + og.svg (see gen:icons)
scripts/check-css-vars.mjs     fails on a var() naming an undeclared custom property
scripts/check-css-classes.mjs  fails on a styles.x with no matching class in the module
scripts/check-comments.mjs     a comment budget, and a check for the same comment in two files
scripts/report-bundle-size.mjs prints gzip and raw size per file after a build
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

The note goes to Google's Gemini for processing and is stored in KV under the short id. Anyone with
the link can read it. Ids are 6 random characters from a 57-character alphabet, so there are about
34 billion of them and they aren't guessable, but the link _is_ the access token. Don't write
anything you wouldn't forward.

Gardens never expire, which is deliberate: a link somebody was already sent has to keep working.
Removing a garden from your own archive detaches it from your account and leaves the link alive for
whoever you sent it to. [ARCHITECTURE.md](ARCHITECTURE.md) covers the retention decision and what
the note being untrusted model input does and doesn't protect against.

## Tests

```bash
pnpm verify                          # everything CI runs, in one command
pnpm -r test                         # 308 tests: 90 API, 218 web
pnpm --filter @bloomnote/web e2e     # 8 Playwright journeys
```

`pnpm verify` is the gate: typecheck, lint, format, `css-vars`, `css-classes`, `comments`, `knip`,
build, unit tests, then the browser suite. It is the same list CI runs and `pnpm run deploy` refuses
to ship without it. One command rather than a remembered list, because a remembered list is how a
lint failure once survived three rounds of changes with everything else green.

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

Three other checks exist for the same reason: a mistake that renders as nothing and errors nowhere.

`pnpm css-classes` fails on a `styles.typo` with no matching class in the module. TypeScript types a
CSS module as a loose record, eslint does not read CSS, and the value is `undefined`, which React
puts in the DOM as no class at all. The element arrives unstyled and nothing anywhere complains. It
only checks the referenced-but-undefined direction, because reporting classes the CSS defines but
nothing uses cannot see `styles[\`ghostSproutGrowing${growth}\`]` and produced fifty false positives
when tried.

`pnpm comments` holds a budget on comment lines in `src` and fails on the same comment appearing in
two files. The duplicate rule is the useful half: four copies of one fact each read as reasonable on
their own, and only a whole-repo view shows the problem.

`eslint-plugin-react` is installed for one rule in particular. A bare `/* … */` in a JSX children
position is a text node, not a comment, so it renders. Two of them sat on the homepage for several
commits with every other check green, and `react/jsx-no-comment-textnodes` catches that on the
keystroke. `react-hooks` and `jsx-a11y` came with it; the React Compiler rules that ship in
`eslint-plugin-react-hooks` v7 are off, with the reason in `.eslintrc.cjs`.

`pnpm css-vars` (run by `build` and in CI) fails on a `var(--x)` naming a custom property nothing
declares. That mistake is silent by construction. With a fallback the rule quietly uses it; without
one, `color` inherits from the parent and `fill` renders black. Six of these shipped before the
check existed, including a wax seal that drew as a black dot on the screen it is the centrepiece of.
A fallback does not make the reference legitimate, so both are reported.

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
