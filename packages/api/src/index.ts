import { Hono } from 'hono';
import { getSessionUser } from '@aidenjang/auth-client';
import { harden } from './harden.js';
import type { Env } from './env.js';
import {
  claimGardens,
  createGarden,
  listMine,
  readGarden,
  recordReceived,
  removeFromAccount,
} from './gardens.js';
import { buildPrompt, checkBudget, generateGarden, validateBody } from './designGarden.js';

const app = new Hono<{ Bindings: Env }>();

// Safety net: any error a route does not handle itself is logged server-side (Workers Logs /
// `wrangler tail`) and returned as a generic 500, so an internal failure never leaks a stack
// trace or implementation detail to the client.
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'InternalError' }, 500);
});

// Security headers on every response + a same-origin CSRF guard on state-changing requests.
app.use('*', harden());

/**
 * Per-user responses must never be stored.
 *
 * A GET with no Cache-Control is heuristically cacheable, so the browser invents its own freshness
 * lifetime and keeps it. That shipped in accounts and produced a real bug: sign out, press back, the
 * page re-checks the session, the browser answers from its own cache, and you appear signed in until a
 * refresh. It cuts both ways too, since a cached signed-out response keeps telling a freshly signed-in
 * person they are signed out.
 *
 * Deliberately conditional. A route that has already chosen its own caching knows something this
 * middleware does not, and overwriting that would silently undo an intentional decision.
 */
app.use('*', async (c, next) => {
  await next();
  if (!c.res.headers.get('cache-control')) {
    c.header('Cache-Control', 'no-store, max-age=0');
    c.header('Pragma', 'no-cache');
  }
});


app.get('/health', (c) => c.json({ status: 'ok', service: 'bloomnote' }));

// Who is the caller? Same-origin endpoint the web polls so the browser never talks to the
// auth service cross-origin. Returns { user: null } when signed out — bloomnote is anonymous-
// first, so accounts are optional and this is never a hard 401.
app.get('/api/me', async (c) => {
  const user = await getSessionUser(c.req.raw, c.env.AUTH_URL);
  return c.json({ user: user ? { id: user.id, email: user.email, displayName: user.displayName } : null });
});

// Read a garden by short id. Immutable once created, so it's aggressively cacheable.
app.get('/api/garden', async (c) => {
  const id = c.req.query('id');
  if (!id) return c.json({ error: 'Missing or malformed id.' }, 400);
  const garden = await readGarden(c.env, id);
  if (garden === null) return c.json({ error: 'Garden not found.' }, 404);
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  return c.json({ garden });
});

// Create a garden, returning its short id. Body is the garden JSON. When the creator is signed
// in, the garden is stamped with their ownerId and added to their Sent list; anonymous still works.
app.post('/api/garden', async (c) => {
  const body = await c.req.json().catch(() => null);
  const user = await getSessionUser(c.req.raw, c.env.AUTH_URL);
  const result = await createGarden(c.env, body, user?.id);
  if (!result.ok) return c.json({ error: result.message }, result.status);
  return c.json({ id: result.id });
});

// Record that the signed-in caller opened someone else's garden (adds it to their Received list).
app.post('/api/garden/:id/receive', async (c) => {
  const user = await getSessionUser(c.req.raw, c.env.AUTH_URL);
  if (!user) return c.json({ error: 'UNAUTHENTICATED' }, 401);
  const saved = await recordReceived(c.env, user.id, c.req.param('id'));
  return c.json({ saved });
});

// Remove a garden from the signed-in user's Sent/Received lists. Keeps the garden itself, so a
// link already shared still opens; this just detaches it from this account.
app.delete('/api/garden/:id', async (c) => {
  const user = await getSessionUser(c.req.raw, c.env.AUTH_URL);
  if (!user) return c.json({ error: 'UNAUTHENTICATED' }, 401);
  await removeFromAccount(c.env, user.id, c.req.param('id'));
  return c.json({ ok: true });
});

// Funnel analytics. The web app POSTs structural, PII-free events here (usually via sendBeacon);
// we record them to Workers Logs (query with `wrangler tail` or the dashboard). Only whitelisted
// names are logged so a spoofed body can't spam arbitrary lines. Fire-and-forget → always 204.
const TRACKED_EVENTS = new Set([
  'composer_opened',
  'garden_generated',
  'garden_error',
  'garden_canceled',
  'garden_rerolled',
  'share_link_copied',
  'share_link_shared',
  'card_downloaded',
  'make_another',
  'garden_opened',
  'garden_bloomed',
  'reply_started',
]);
app.post('/api/event', async (c) => {
  const raw = await c.req.text().catch(() => '');
  let name = '';
  let meta: unknown = {};
  try {
    const parsed = JSON.parse(raw) as { name?: unknown; meta?: unknown };
    if (typeof parsed.name === 'string') name = parsed.name;
    if (parsed.meta && typeof parsed.meta === 'object') meta = parsed.meta;
  } catch {
    // malformed body — ignore
  }
  if (TRACKED_EVENTS.has(name)) {
    console.log(`bloomnote_event ${name} ${JSON.stringify(meta).slice(0, 400)}`);
  }
  return c.body(null, 204);
});

// The signed-in user's gardens (Sent + Received), read server-side so it's the same on any device.
app.get('/api/mine', async (c) => {
  const user = await getSessionUser(c.req.raw, c.env.AUTH_URL);
  if (!user) return c.json({ error: 'UNAUTHENTICATED' }, 401);
  return c.json(await listMine(c.env, user.id));
});

// First-login claim: adopt anonymous on-device gardens (their ids) into the account.
app.post('/api/mine/claim', async (c) => {
  const user = await getSessionUser(c.req.raw, c.env.AUTH_URL);
  if (!user) return c.json({ error: 'UNAUTHENTICATED' }, 401);
  const body = (await c.req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
  return c.json({ claimed: await claimGardens(c.env, user.id, ids) });
});

// Generate a garden from a note (Gemini via REST). Streams SSE (start/thinking/complete/error)
// to match the existing client. Rate-limited + globally capped to protect the Gemini budget.
app.post('/api/design-garden', async (c) => {
  if (!c.env.GEMINI_API_KEY) return c.json({ error: 'Garden generation is not configured yet.' }, 503);
  const parsed = validateBody(await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const ip =
    c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const budget = await checkBudget(c.env, ip);
  if (!budget.ok) return c.json({ error: budget.message }, budget.status, { 'Retry-After': String(budget.retryAfter) });

  const apiKey = c.env.GEMINI_API_KEY;
  const userPrompt = buildPrompt(parsed.body);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown): void =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        send('start', { ok: true });
        send('thinking', {});
        const garden = await generateGarden(apiKey, userPrompt);
        send('complete', { garden });
      } catch (err) {
        send('error', { error: err instanceof Error ? err.message : 'Generation failed.' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  });
});

// Per-garden link previews. A shared /g/<id> link should unfurl as "X sent Y a garden", not the
// generic homepage card. We serve the same SPA shell but rewrite its OG/Twitter title+description
// from the garden. Crawlers read the injected tags; real users still boot the SPA normally.
app.get('/g/:id', async (c) => {
  const shell = await c.env.ASSETS.fetch(c.req.raw); // SPA fallback → index.html
  const garden = await readGarden(c.env, c.req.param('id'));
  if (garden === null || typeof garden !== 'object') return shell; // unknown id → plain shell (SPA 404s)

  const g = garden as Record<string, unknown>;
  const from = typeof g.from === 'string' ? g.from.trim() : '';
  const to = typeof g.to === 'string' ? g.to.trim() : '';
  const title = from && to ? `${from} grew ${to} a garden` : from ? `${from} grew you a garden` : 'someone grew you a garden';
  const description = 'a little garden, grown just for you. open it to watch it bloom.';
  const url = new URL(c.req.url).toString();

  return new HTMLRewriter()
    .on('title', { element: (e) => { e.setInnerContent(title); } })
    .on('meta[property="og:title"]', { element: (e) => { e.setAttribute('content', title); } })
    .on('meta[name="twitter:title"]', { element: (e) => { e.setAttribute('content', title); } })
    .on('meta[property="og:description"]', { element: (e) => { e.setAttribute('content', description); } })
    .on('meta[name="twitter:description"]', { element: (e) => { e.setAttribute('content', description); } })
    .on('meta[property="og:url"]', { element: (e) => { e.setAttribute('content', url); } })
    .transform(shell);
});

// Everything that isn't the API is the web SPA: real files, or index.html for client routes
// (/g/:id, /r/:id, /mine). run_worker_first routes it all through here.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
