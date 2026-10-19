import { PRODUCT_EVENTS } from '../../../analytics/schema.js'
import { bodyLimit } from 'hono/body-limit'
import { handleAnalytics } from '../../../analytics/worker.js'
import { Hono, type Context } from 'hono'
import { resolveSession, type AuthUser } from '@aidenjang/auth-client'
import { harden } from './harden.js'
import type { Env } from './env.js'
import {
  claimGardens,
  createGarden,
  feelGarden,
  listMine,
  putOgImage,
  readGarden,
  readOgImage,
  readGardenResponse,
  readResponsesBatch,
  readWaters,
  recordReceived,
  removeFromAccount,
  waterGarden,
} from './gardens.js'
import { buildPrompt, checkBudget, generateGarden, validateBody } from './designGarden.js'
import { checkRate, clientIp } from './rateLimit.js'
import { writeEvent } from './events.js'

/* Per-IP ceilings on the endpoints that write. bloomnote is anonymous-first, so most of these
   cannot ask who is calling. */
const LIMITS = {
  create: 12,
  water: 30,
  feeling: 20,
  event: 60,
  account: 30,
} as const

const limited = async (c: Context<{ Bindings: Env }>, bucket: string, perMinute: number) => {
  const result = await checkRate(c.env, bucket, clientIp(c.req.raw.headers), perMinute)
  return result.ok
    ? null
    : c.json({ error: 'RATE_LIMITED', message: result.message }, 429, {
        'retry-after': String(result.retryAfter),
      })
}

type Caller = { state: 'signed-in'; user: AuthUser } | { state: 'signed-out' } | { state: 'unavailable' }

const callerOf = async (c: Context<{ Bindings: Env }>): Promise<Caller> => {
  const session = await resolveSession(c.req.raw, c.env.AUTH_URL)
  return session.state === 'signed-in' ? { state: 'signed-in', user: session.user } : { state: session.state }
}

/* 503 for an unreachable auth service, not 401: answering 401 tells a signed-in caller they are
   signed out, and the clients act on that by clearing what they hold. */
const refuse = (c: Context<{ Bindings: Env }>, caller: Exclude<Caller, { state: 'signed-in' }>): Response =>
  caller.state === 'unavailable'
    ? c.json({ error: 'AUTH_UNAVAILABLE' }, 503, { 'retry-after': '30' })
    : c.json({ error: 'UNAUTHENTICATED' }, 401)

const app = new Hono<{ Bindings: Env }>()

function ogImageUrl(reqUrl: string, id: string): string {
  const u = new URL(`/og/${id}.png`, reqUrl)
  if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') u.protocol = 'https:'
  return u.toString()
}

// Any error a route does not handle itself is logged server-side and returned as a generic 500,
// so an internal failure never leaks a stack trace to the client.
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'InternalError' }, 500)
})

app.use('*', harden())

/* Vite's hashed bundles cannot change under a given name, so a year and `immutable`. Workers
   Assets serves them `max-age=0, must-revalidate`, which spends a revalidation round trip per
   chunk on every repeat visit. index.html keeps its name and must still revalidate. */
const HASHED = /^\/assets\//

/* A GET with no Cache-Control is heuristically cacheable, so a per-user response would be
   stored and handed to the next person on the same browser. */
app.use('*', async (c, next) => {
  await next()
  // Gift URLs are access tokens; keep gardens, their images, and account views out of search.
  if (/^\/(?:api|g|r|og|mine)(?:\/|$)/.test(c.req.path)) {
    c.header('X-Robots-Tag', 'noindex, nofollow')
  }
  if (HASHED.test(c.req.path)) {
    c.header('Cache-Control', 'public, max-age=31536000, immutable')
    return
  }
  if (!c.res.headers.get('cache-control')) {
    c.header('Cache-Control', 'no-store, max-age=0')
    c.header('Pragma', 'no-cache')
  }
})

app.all('/api/analytics', (c) => handleAnalytics(c.req.raw, c.env))

app.get('/health', (c) => c.json({ status: 'ok', service: 'bloomnote' }))

app.get('/api/me', async (c) => {
  // An unreachable auth service reads as signed out here on purpose: rendering the anonymous app
  // is the honest degraded state. The routes that write to an account tell the two apart.
  const session = await resolveSession(c.req.raw, c.env.AUTH_URL)
  const user = session.state === 'signed-in' ? session.user : null
  return c.json({ user: user ? { id: user.id, email: user.email, displayName: user.displayName } : null })
})

// Immutable once created, so it is aggressively cacheable.
app.get('/api/garden', async (c) => {
  const id = c.req.query('id')
  if (!id) return c.json({ error: 'Missing or malformed id.' }, 400)
  const garden = await readGarden(c.env, id)
  if (garden === null) return c.json({ error: 'Garden not found.' }, 404)
  c.header('Cache-Control', 'public, max-age=31536000, immutable')
  return c.json({ garden })
})

app.post('/api/garden', async (c) => {
  const stop = await limited(c, 'create', LIMITS.create)
  if (stop) return stop
  const body = await c.req.json().catch(() => null)
  // Also anonymous when auth is unreachable, rather than refusing to send the garden. The sender
  // keeps an on-device record and /api/mine/claim adopts it on their next visit.
  const session = await resolveSession(c.req.raw, c.env.AUTH_URL)
  const result = await createGarden(c.env, body, session.state === 'signed-in' ? session.user.id : undefined)
  if (!result.ok) return c.json({ error: result.message }, result.status)
  return c.json({ id: result.id })
})

app.post('/api/garden/:id/og', async (c) => {
  const bytes = await c.req.arrayBuffer()
  const result = await putOgImage(c.env, c.req.param('id'), bytes)
  if (!result.ok) return c.json({ error: result.message }, result.status)
  return c.json({ ok: true })
})

// Crawlers fetch this, so it must be a plain immutable image with no session dependence and no
// redirect: several unfurlers give up on either.
app.get('/og/:id', async (c) => {
  const id = c.req.param('id').replace(/\.png$/, '')
  const png = await readOgImage(c.env, id)
  if (png === null) return c.notFound()
  return new Response(png, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
})

/* Both are no-store: the count moves, and a cached one shows the recipient's tap doing nothing. */
app.post('/api/garden/:id/water', async (c) => {
  const stop = await limited(c, 'water', LIMITS.water)
  if (stop) return stop
  const result = await waterGarden(c.env, c.req.param('id'))
  if (!result.ok) return c.json({ error: result.message }, result.status)
  return c.json({ waters: result.waters }, 200, { 'cache-control': 'no-store' })
})

app.get('/api/garden/:id/water', async (c) => {
  const waters = await readWaters(c.env, c.req.param('id'))
  return c.json({ waters }, 200, { 'cache-control': 'no-store' })
})

app.post('/api/garden/:id/feeling', async (c) => {
  const stop = await limited(c, 'feeling', LIMITS.feeling)
  if (stop) return stop
  const body: unknown = await c.req.json().catch(() => null)
  const feeling =
    body && typeof body === 'object' && 'feeling' in body && typeof body.feeling === 'string'
      ? body.feeling
      : ''
  const result = await feelGarden(c.env, c.req.param('id'), feeling)
  if (!result.ok) return c.json({ error: result.message }, result.status)
  return c.json(result.response, 200, { 'cache-control': 'no-store' })
})

app.get('/api/responses', async (c) => {
  const ids = (c.req.query('ids') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return c.json({ responses: await readResponsesBatch(c.env, ids) }, 200, { 'cache-control': 'no-store' })
})

app.get('/api/garden/:id/response', async (c) => {
  return c.json(await readGardenResponse(c.env, c.req.param('id')), 200, { 'cache-control': 'no-store' })
})

app.post('/api/garden/:id/receive', async (c) => {
  const stop = await limited(c, 'account', LIMITS.account)
  if (stop) return stop
  const caller = await callerOf(c)
  if (caller.state !== 'signed-in') return refuse(c, caller)
  const user = caller.user
  const saved = await recordReceived(c.env, user.id, c.req.param('id'))
  return c.json({ saved })
})

app.delete('/api/garden/:id', async (c) => {
  const stop = await limited(c, 'account', LIMITS.account)
  if (stop) return stop
  const caller = await callerOf(c)
  if (caller.state !== 'signed-in') return refuse(c, caller)
  const user = caller.user
  await removeFromAccount(c.env, user.id, c.req.param('id'))
  return c.json({ ok: true })
})

// Event names and categorical metadata are checked before the shared aggregate dataset.
// A discarded event does not affect the page.
const TRACKED_EVENTS = new Set<string>(PRODUCT_EVENTS)

app.post('/api/event', bodyLimit({ maxSize: 2048 }), async (c) => {
  const stop = await limited(c, 'event', LIMITS.event)
  if (stop) return stop
  const raw = await c.req.text().catch(() => '')
  let name = ''
  let meta: unknown = {}
  try {
    const parsed = JSON.parse(raw) as { name?: unknown; meta?: unknown }
    if (typeof parsed.name === 'string') name = parsed.name
    if (parsed.meta && typeof parsed.meta === 'object') meta = parsed.meta
  } catch {
    // A malformed body is not worth an error; the beacon has nobody to tell.
  }
  if (TRACKED_EVENTS.has(name)) {
    writeEvent(c.env, name, meta)
  }
  return c.body(null, 204)
})

app.get('/api/mine', async (c) => {
  const caller = await callerOf(c)
  if (caller.state !== 'signed-in') return refuse(c, caller)
  const user = caller.user
  return c.json(await listMine(c.env, user.id))
})

app.post('/api/mine/claim', async (c) => {
  const stop = await limited(c, 'account', LIMITS.account)
  if (stop) return stop
  const caller = await callerOf(c)
  if (caller.state !== 'signed-in') return refuse(c, caller)
  const user = caller.user
  const body = (await c.req.json().catch(() => ({}))) as { ids?: unknown }
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : []
  return c.json({ claimed: await claimGardens(c.env, user.id, ids) })
})

app.post('/api/design-garden', async (c) => {
  if (!c.env.GEMINI_API_KEY) return c.json({ error: 'Garden generation is not configured yet.' }, 503)
  const parsed = validateBody(await c.req.json().catch(() => null))
  if (!parsed.ok) return c.json({ error: parsed.error }, 400)

  const ip =
    c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const budget = await checkBudget(c.env, ip)
  if (!budget.ok)
    return c.json({ error: budget.message }, budget.status, { 'Retry-After': String(budget.retryAfter) })

  const apiKey = c.env.GEMINI_API_KEY
  const userPrompt = buildPrompt(parsed.body)
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (event: string, data: unknown): void =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      try {
        send('start', { ok: true })
        send('thinking', {})
        const garden = await generateGarden(apiKey, userPrompt)
        send('complete', { garden })
      } catch (err) {
        send('error', { error: err instanceof Error ? err.message : 'Generation failed.' })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  })
})

app.get('/g/:id', async (c) => {
  const shell = await c.env.ASSETS.fetch(c.req.raw)
  const garden = await readGarden(c.env, c.req.param('id'))
  if (garden === null || typeof garden !== 'object') return shell

  const g = garden as Record<string, unknown>
  const from = typeof g.from === 'string' ? g.from.trim() : ''
  const to = typeof g.to === 'string' ? g.to.trim() : ''
  const title =
    from && to
      ? `${from} grew ${to} a garden`
      : from
        ? `${from} grew you a garden`
        : 'someone grew you a garden'
  const description = 'a little garden, grown just for you. open it to watch it bloom.'
  const url = new URL(c.req.url).toString()
  // Only point at a card that exists. A broken og:image is worse than none: most unfurlers show a
  // grey placeholder rather than the site default, so the link looks broken rather than plain.
  const ogUrl =
    (await readOgImage(c.env, c.req.param('id'))) === null ? null : ogImageUrl(c.req.url, c.req.param('id'))

  const rewriter = new HTMLRewriter()
    .on('title', {
      element: (e) => {
        e.setInnerContent(title)
      },
    })
    .on('meta[property="og:title"]', {
      element: (e) => {
        e.setAttribute('content', title)
      },
    })
    .on('meta[name="twitter:title"]', {
      element: (e) => {
        e.setAttribute('content', title)
      },
    })
    .on('meta[property="og:description"]', {
      element: (e) => {
        e.setAttribute('content', description)
      },
    })
    .on('meta[name="twitter:description"]', {
      element: (e) => {
        e.setAttribute('content', description)
      },
    })
    .on('meta[property="og:url"]', {
      element: (e) => {
        e.setAttribute('content', url)
      },
    })

  if (ogUrl) {
    rewriter
      .on('meta[property="og:image"]', {
        element: (e) => {
          e.setAttribute('content', ogUrl)
        },
      })
      .on('meta[name="twitter:image"]', {
        element: (e) => {
          e.setAttribute('content', ogUrl)
        },
      })
      .on('meta[property="og:image:alt"]', {
        element: (e) => {
          e.setAttribute('content', `the garden ${from || 'someone'} grew`)
        },
      })
    // Left alone rather than restated here. The shell already declares twitter:card and
    // og:image:width/height, and two places setting the same value is how they drift apart.
  }

  return rewriter.transform(shell)
})

// Everything that isn't the API is the web SPA. run_worker_first routes it all through here.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export { Counters } from './counters.js'

export default app
