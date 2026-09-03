# Working in bloomnote

How this repo expects to be worked in. Personal working style (commits, planning,
how to explain things) lives in the global `~/.claude/CLAUDE.md`.

The first half is engineering standards that apply to any codebase. The second half is bloomnote
itself: its checks, its deliberate oddities, and the traps it has actually hit.

## Do not trust your own measurements

Most false statements come from scans that measured nothing, not from misreading code. Real cases:
a glob with `{src,test}` braces matched zero files, so a coverage sweep compared against an empty
string and called every module untested; a `cd` inside a backgrounded command did not apply, so
three "stability runs" ran nothing; a coverage tool reported 0% because it could not instrument the
runtime; a script name silently resolved to an npm builtin, so a check reported green for a day
without ever executing.

So: an impossibly clean result means suspect the scan first. And **green is not proof unless you
have seen that check fail** — break the thing it guards, watch it go red, then believe it.

## Writing a new check

- It has to cover its own source, or the checks stop being checked.
- It has to cover every place the failure can appear, not just where you first saw it.
- Exclude test files from source scans: tests mount throwaway routes and declare throwaway types.
- Prove it fails before trusting it, and prove a failure leaves the tree clean.
- Always `pnpm run <name>`, and never name a script after an npm command. A script called `docs` is
  shadowed by npm's own `docs`, which exits 0 without running anything.

## Numbers in prose

Do not write live counts into docs: test totals, check totals, file lengths. Nothing verifies them
and they go stale silently. Say what a thing is and let the check print the number. Describing a
past change is different, and fine.

## Comments

- Keep an inline comment to a line or two. A longer block has to earn it by recording something a
  reader would otherwise rediscover the hard way: a trap that has bitten, a table worth having, a
  constraint that fails silently. Plenty of blocks here run well past that and they are mostly the
  good ones, so length is not the test. "Why, not what" is.
- Never explain a refactor, or what the code used to do. A reader never saw that version.
- A comment that logs successive changes is a changelog. Git has it, and the log drifts out of step
  with the value it describes.
- After moving code, re-read every comment near the seam. A move strands them on the wrong function.
- Never raise a comment budget to fit prose you want to keep. Trim instead; no script can enforce
  that about itself. Admitting a new module is the one honest reason to move one, and the src
  budget is a share of the code rather than a line count precisely so that stops being a decision.

---

# bloomnote specifics

Everything below was checked against the code, not recalled. If you change one of these, change
this file in the same commit.

## The gates

`pnpm run verify` and CI run the same list. Four of them are homemade and worth knowing: `gates`
(every step of verify and ci.yml resolves to a real script), `size` (a line and `useState` ceiling
per file), `comments` (src capped as a _share_ of the code, scripts as a count), `check:docs`
(paths, script names, routes and symbols named in the docs exist). Each prints its own numbers.

`ALREADY_OVER` in `check-size.mjs` is empty. A file mid-decomposition goes there at its current
size so it cannot grow; leaving one behind after the file is under the ceiling is how the ceiling
stops meaning anything.

## What holds the app up

The link is the access control. Ids are six characters from a 57-character alphabet, and every
route that reads a garden is unauthenticated on purpose, because anyone with the link is meant to
open it. The account routes are the exception and do check. Nothing else guards a garden's
contents, so never add a route that turns one id into another, and keep ids out of the logs:
`META_KEYS` in `eventMeta.ts` is an allowlist and no id is on it.

Counters live in the `COUNTERS` durable object, never KV. KV's read-modify-write is not atomic:
forty parallel requests once passed a limit of five, because every one of them read the same
count. Sequential callers were limited correctly, which is why no test caught it.

The two guards fail in opposite directions and that is deliberate. Per-IP limits fail open, since
blocking a real gift beats one extra generation. The daily spend cap fails closed, since it is the
only bound on what Gemini costs. `PER_IP_PER_MINUTE` is 5 and `DAILY_CAP` is 15 because the free
tier for this key allows 5 requests a minute and 20 a day, both per project rather than per
caller.

## Deliberate oddities

- `looksLikeGarden` accepts wider ranges than the prompt asks for (petals 3-20 against the
  prompt's 5-14, stems 40-160 against 70-115). The write door only guarantees a thing is
  drawable. Couple the two and a prompt tweak silently starts rejecting writes.
- Gardens carry no `expirationTtl`. A link already sent has to keep working.
- `POST /api/garden/:id/og` has no auth by design, but is write-once: a second image gets a 409,
  so a stranger cannot replace the picture on somebody's gift.
- Creating a garden falls back to anonymous when auth is unreachable rather than refusing. That is
  only safe because the sender keeps an on-device record and `/api/mine/claim` adopts it later.

## Where logic goes

Pure logic lives in `packages/web/src/lib/*.ts` with its own unit test. The `use*` hooks there are
React wiring around it and have no unit tests, because there is no DOM environment in this suite
(no jsdom, no testing-library) and adding one would test that React calls what it was told to.
Those paths are covered by the Playwright journey instead. If you need to test hook behaviour,
extract the decision into a pure function and test that.

## Traps this repo has actually hit

- A failed request read as an empty result. `claimGardens` returned 0 for "could not ask", and its
  caller then deleted the on-device copy of every id it had handed over, so one failed call emptied
  somebody's archive. Distinguish "asked and got nothing" from "could not ask".
- Prefix matching on model output. The flower name was stripped off the front of its meaning by
  `startsWith`, so "Roses, for a quiet year." rendered as "S, for a quiet year." The model writes
  plurals constantly; match whole words.
- Each e2e test needs its own `cf-connecting-ip`. They otherwise share one rate-limit bucket, and
  a full run spends enough of `LIMITS.create` that running the suite a few times inside a minute
  starts failing on whichever test is next. It passes in CI, which runs it once.
- A check that names its own target. `check-docs.mjs` scanned `scripts/*.mjs` and its own header
  named the symbol it was written to find, which made that symbol resolve and the check useless.

## The test tooling is deliberately one major behind

`@cloudflare/vitest-pool-workers` 0.14 and later require vitest 4, and that release rewrites the
pool as a Vite plugin: `fetchMock` and `isolatedStorage` are gone, and `env` and `SELF` from
`cloudflare:test` are deprecated. Dropping them costs the outbound-fetch stubbing in
`auth-boundary.test.ts` and the per-test storage isolation that keeps `gardens.test.ts` honest,
which is a bad trade for advisories that only exist in build tooling. Wrangler and vitest 3 are
current; the remaining high advisories are all dev-only and none reaches the Worker at request
time.
