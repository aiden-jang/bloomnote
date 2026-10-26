# Deployment and recovery

Bloomnote runs at [bloomnote.aidenjang.com](https://bloomnote.aidenjang.com). One Cloudflare Worker
serves the API and built SPA on the same origin. Gardens are stored in the `GARDENS` KV namespace;
`COUNTERS` holds atomic rate and daily-generation limits. The shared account service is separate.

## Automatic release

Push a verified commit to `main`. `.github/workflows/ci.yml` runs the repository checks
and Chromium/WebKit journeys in parallel. Both `check` and `browser-check` must pass before deployment.
Superseded PR runs are cancelled; main runs queue so releases are not interrupted mid-deploy.

The check job uploads the production web assets. The deploy job downloads that artifact and
runs `pnpm --filter @bloomnote/api run deploy:assets`, so it deploys the exact SPA that passed the
build checks. It does not rebuild the UI or repeat the test suite. Failed browser runs retain traces and screenshots in the `browser-results` artifact.

The repository needs `CLOUDFLARE_API_TOKEN` with permission to deploy this Worker. Keep it in GitHub
Actions secrets. The model key lives in the Worker’s `GEMINI_API_KEY` secret; `AUTH_URL` is public
configuration in `packages/api/wrangler.toml`. Do not place secrets in commits, screenshots, logs,
or command arguments.

## Verify a release

Confirm the workflow’s exact main commit and successful check, browser, and deploy jobs.

```bash
curl --fail https://bloomnote.aidenjang.com/health
curl --fail https://bloomnote.aidenjang.com/api/me
```

The first reports the service as healthy. The second reports a null user in a signed-out browser.
Open the writing desk, an existing garden link, and the library. Verify optional sign-in returns
from the account service. Creating a real garden spends model quota; use an existing link for
routine read-only smoke checks.

## Rollback and diagnosis

Revert the offending commit on main and let the same checks and automatic release run. For an urgent incident, Cloudflare’s dashboard can restore a previously deployed Worker
version. Confirm its assets and configuration together, then bring the repository back into line.
Do not delete KV records or change Durable Object migrations to roll back a UI change.

Inspect Actions logs for build and browser failures; use the retained trace to inspect a failed
journey. Workers Logs is enabled. From the repository root:

```bash
pnpm --filter @bloomnote/api exec wrangler tail
```

Accounts outages return 503 on session checks and account mutations. A successful session check
without a user returns 200; account mutations return 401 when signed out. Garden creation can fall back to anonymous; the local library
is claimed when account access returns. Model failures retain the draft and show recovery copy.

## Manual recovery and initial provisioning

Manual deployment is a recovery path. From the repository root, `pnpm run deploy` runs the full
verification gate, builds the SPA, and deploys the Worker. The API package’s `deploy:assets` script
assumes the checked web build already exists; CI supplies it from its artifact.

For a new environment, create the KV namespace with Wrangler and set its ID in
`packages/api/wrangler.toml`. Wrangler applies the committed Durable Object migration. Set the
model secret interactively:

```bash
pnpm --filter @bloomnote/api exec wrangler secret put GEMINI_API_KEY
```

Attach the custom domain through the configured route. Provisioning and changing the account
service belong to their own workflows; routine Bloomnote releases do neither.
