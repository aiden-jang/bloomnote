# Contributing to Bloomnote

Use Node 22 (`nvm use`) and the pinned version of pnpm. Install with `pnpm install --frozen-lockfile`.
The [README](README.md) covers the two local servers; [CONVENTIONS.md](CONVENTIONS.md) records the
project’s engineering rules and boundaries.

## Changes and verification

Use a branch and a pull request. Commit messages follow Conventional Commits without a scope:
`fix: keep the note after a failed save`, `refactor: separate garden layouts`, or `docs: clarify local setup`.
Run `pnpm run verify` before publishing the change. Local browser journeys own their servers,
so stop manually running development servers first.

Keep pure decisions in `packages/web/src/lib/` and test their actual boundary cases. Cover React
wiring and product journeys in Playwright. API tests use Cloudflare’s maintained Vitest plugin
and real local Worker bindings. The [Cloudflare migration guide](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-to-vitest-plugin/)
describes the supported configuration. Normal tests stub model calls and never spend Gemini quota.

Prove a new guard or regression detects its target failure before trusting it. Restore temporary
mutations exactly. Check that scans found real files. Keep assertions, retries, timeouts, and
existing budgets meaningful; fix the failure rather than weakening the check.

Update affected documentation in the same change. Avoid live totals in prose; the checks report
them. Keep source files below the size ceiling and comments focused on constraints or traps that
a reader cannot see from the code.

## Product and data boundaries

Preserve the writing-first desk, distinct sender notes and generated meanings, reduced motion,
visible keyboard focus, and anonymous-first flow. Review narrow phones and intermediate widths,
loading, empty, error, and success states. Keep real notes out of visual fixtures and screenshots.

Garden links are access tokens. Do not expose one garden’s ID through another, or log notes,
names, garden IDs, or raw model output in product analytics. Account mutations require a valid
session. Keep atomic limits in the Durable Object and preserve the write-once link-preview image.

The repository automatically deploys a verified merge to `main`. See [DEPLOY.md](DEPLOY.md) for
rollback and incident recovery. Report sensitive vulnerabilities privately through the
[security policy](.github/SECURITY.md), rather than a public issue.
