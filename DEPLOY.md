# Deploying bloomnote → bloomnote.aidenjang.com

**Status: live** at `bloomnote.aidenjang.com` (KV provisioned, custom domain attached). For a new
version use the **Routine redeploy** section; the first-deploy steps are kept for reference. One
Cloudflare Worker (`bloomnote`) serves both the API (`/api/*`, `/health`) and the web SPA on
one origin. Gardens live in a KV namespace (`GARDENS`). Free tier; you pay only for DNS.

Accounts are optional and use the shared auth service (`accounts.aidenjang.com`). The browser
redirects there to sign in and out. bloomnote's own `/api/me` route then validates the
`platform_session` cookie server-side, by calling the auth service's `/auth/me` from the Worker, so
the browser never talks to accounts cross-origin. The cookie is scoped to `.aidenjang.com`, so it is
shared with owewell.

All commands run from `packages/api`.

## First deploy (once, in order)

```bash
# 1. Create the garden store, then paste the printed id into wrangler.toml as the `id`
#    under [[kv_namespaces]]. The COUNTERS durable object needs no step of its own:
#    `wrangler deploy` applies the [[migrations]] block that creates it.
pnpm exec wrangler kv namespace create GARDENS

# 2. Garden generation key (Gemini). Optional: without it, /api/design-garden returns 503
#    gracefully and the rest of the app still works.
echo "<gemini-api-key>" | pnpm exec wrangler secret put GEMINI_API_KEY

# 3. Custom-domain two-step: a Worker needs a deployment before a custom domain attaches.
#    - Comment out the [[routes]] custom_domain block in wrangler.toml.
pnpm run deploy            # builds bloomnote-web, then wrangler deploy (first deployment)
#    - Uncomment the [[routes]] block.
pnpm run deploy            # redeploy to attach bloomnote.aidenjang.com
```

- `AUTH_URL` is committed in `wrangler.toml` `[vars]` (`https://accounts.aidenjang.com`), so no
  auth secret to set. The account already has a `workers.dev` subdomain, so `error 10063` won't recur.

## Routine redeploy

CI deploys on merge to `main`, and nothing here is run by hand. The gate is
`.github/workflows/ci.yml`: `gates`, typecheck, `size`, lint, a Prettier check, `css-vars`,
`css-classes`, `comments`, `knip`, build and unit tests, then a production-only `pnpm audit`, the
Playwright suite in Chromium, and a bundle-size report (which prints, and does not fail).

`pnpm verify` runs that same list locally, and `pnpm run deploy` depends on it, so the break-glass
path below cannot ship past a failing check. CI's own deploy job calls `pnpm run deploy:only`
instead: its gate is the `check` job it depends on, and repeating the suite there would need
Chromium installed just to redo work that already passed.

The manual commands are break-glass only, for when CI itself is broken:

```bash
pnpm run deploy            # builds the SPA + deploys (use whenever web/ changed)
pnpm exec wrangler deploy  # API/config-only change (reuses the last-built SPA)
```

## Dependency: the auth service

bloomnote relies on the shared auth service at `accounts.aidenjang.com` for sign-in and sign-out
redirects and for server-side `/auth/me` validation. Auth lives in its own repo and is already live.
If its contract changes, deploy it from there first: bloomnote reads `/auth/me` through
`@aidenjang/auth-client`, so a change there breaks sign-in here.

## Smoke test (verify SSO + /mine cross-device)

```bash
curl https://bloomnote.aidenjang.com/health   # {"status":"ok","service":"bloomnote"}
curl https://bloomnote.aidenjang.com/api/me   # {"user":null} when signed out
```

Then in a browser:

1. Anonymous: create a garden, open its `/g/<id>` link. Works with no account.
2. Click **Sign in** (top-right) → lands on `accounts.aidenjang.com`, sign in → back to bloomnote.
   If you're already signed into owewell, this should be seamless (shared `.aidenjang.com` cookie).
3. `/mine` → your **Sent** garden appears; any anonymous gardens made on this device get claimed.
4. Open someone else's `/g/<id>` while signed in → it shows under **Received**.
5. Cross-device check: sign in on another browser/device → the same Sent/Received lists load
   (they're server-side in KV, not localStorage).

## Local dev (no Cloudflare needed)

```bash
# auth (:34100) + bloomnote API (:32200) + bloomnote web (:32100)
# auth runs from its own repo:
cd ../auth/packages/api && pnpm exec wrangler dev --port 34100 --inspector-port 9229 --local
# bloomnote (this repo):
cd packages/api && pnpm exec wrangler dev --port 32200 --inspector-port 9231 --local --var AUTH_URL:http://localhost:34100 --var GEMINI_API_KEY:<key>
cd packages/web && VITE_AUTH_URL=http://localhost:34100 pnpm dev
```

The web dev server proxies `/api` → the Worker at `:32200`; `VITE_AUTH_URL` points sign-in at the
local auth service instead of prod.
