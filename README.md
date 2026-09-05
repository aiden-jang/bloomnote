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
        │  GET  /api/me ───────────────────────▶   resolveSession → accounts.aidenjang (optional)
        │  GET  /g/:id ───────────────────────▶    SPA shell with the garden's OG tags rewritten
        │  app.all('*') ──────────────────────▶    built SPA (static assets + fallback)
```

## Project layout

```
packages/api/            bloomnote Worker (Hono)
  src/index.ts           routes: /api/* + SPA fallback; harden() and rate-limit middleware
  src/gardens.ts         KV store: create/read + sent/received indexes + first-login claim
  src/designGarden.ts    SSE proxy to Gemini (function calling) + daily spend cap
  src/prompt.ts          system prompt + function schema + validateGarden()
  src/rateLimit.ts       per-IP per-minute ceilings on every write, atomic and fail-open
  src/counters.ts        durable object holding both counters; KV could not count atomically
  src/eventMeta.ts       the allowlist of event fields that may reach the logs
packages/web/            React + Vite SPA
  src/components/        Composer, RecipientView, SealedView, GardenScene, FlowerSVG, MyGardens …
  src/garden.ts          schema + short-link client helpers
  src/auth/, AuthNav     optional shared-auth integration
  src/lib/               pure helpers, each with its own tests: routing, scene geometry, draft
                         storage, archive ordering, journal, constellations, recap
  src/lib/useGardenDesign the design lifecycle: write, wait, garden and link, reroll. The React
                         hooks here are covered through the Playwright journey, not unit tests
  src/lib/useStatusLine  the line under the spinner: says one thing, or cycles while thinking
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

## Observability

- **Errors + requests:** Workers Logs is enabled (`[observability]` in `wrangler.toml`), so uncaught
  throws and handled errors (via `app.onError`) are captured. Tail live with
  `pnpm --filter @bloomnote/api exec wrangler tail`.
- **Uptime:** `GET /health` returns `{ status: 'ok' }`, ready for a free external monitor (e.g.
  UptimeRobot).
