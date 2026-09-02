import { afterEach, describe, expect, test } from 'vitest'
import app from '../src/index.js'
import { testEnv } from './helpers.js'

/**
 * The SSE path: POST /api/design-garden.
 *
 * The README listed this as the honest gap, and it is the one route where a failure is invisible
 * to every other kind of check. It always returns 200 with a stream, so a broken generation is
 * not an HTTP error, it is a well-formed response carrying an `error` event. Typecheck and lint
 * cannot see the difference; neither can a smoke test that only asserts the status.
 *
 * Gemini is stubbed at `fetch`, so none of this spends a request against the 20/day free tier.
 */

const BODY = {
  message: 'you drove four hours in the rain and never once made it a thing.',
  recipient: 'Nadia',
  from: 'Aiden',
}

const FLOWER = {
  name: 'Hydrangea',
  meaning: 'For four hours in the rain.',
  petalColors: ['#e11d48', '#f43f5e', '#fb7185'],
  centerColor: '#ffc53d',
  stemColor: '#7c9a6e',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 92,
}

/** A Gemini response shaped the way the real one is: a forced function call. */
function geminiOk(args: unknown): Response {
  return Response.json({
    candidates: [{ content: { parts: [{ functionCall: { name: 'design_garden', args } }] } }],
  })
}

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

function stubGemini(make: () => Response): void {
  globalThis.fetch = (async () => make()) as typeof fetch
}

async function post(body: unknown, env: unknown = testEnv): Promise<Response> {
  return app.fetch(
    new Request('https://x/api/design-garden', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env as never,
  )
}

async function events(res: Response): Promise<[string, Record<string, unknown>][]> {
  const text = await res.text()
  return text
    .split('\n\n')
    .filter((chunk) => chunk.trim())
    .map((chunk) => {
      const name = /^event: (.+)$/m.exec(chunk)?.[1] ?? ''
      const data = /^data: (.+)$/m.exec(chunk)?.[1] ?? '{}'
      return [name, JSON.parse(data) as Record<string, unknown>]
    })
}

describe('POST /api/design-garden (SSE)', () => {
  test('streams start, thinking, then complete with the garden', async () => {
    stubGemini(() => geminiOk({ bouquet_note: 'for the drive.', flowers: [FLOWER, FLOWER, FLOWER] }))
    const res = await post(BODY)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const got = await events(res)
    expect(got.map(([name]) => name)).toEqual(['start', 'thinking', 'complete'])

    const garden = got[2]![1].garden as { flowers: unknown[]; bouquet_note: string }
    expect(garden.flowers).toHaveLength(3)
    expect(garden.bouquet_note).toBe('for the drive.')
  })

  /**
   * The important one. A generation failure must arrive as an `error` event inside a 200 stream,
   * because by the time it fails the response headers are long gone. If this ever became a 500
   * the client would sit on a dead stream with no message.
   */
  test('a failed generation is an error event, not an HTTP error', async () => {
    stubGemini(() => new Response('nope', { status: 500 }))
    const res = await post(BODY)

    expect(res.status).toBe(200)
    const got = await events(res)
    expect(got.map(([name]) => name)).toContain('error')
    // Asserts the shape, not the sentence: a transient upstream failure has to surface the status
    // so it stays distinguishable from the daily-cap message, which is the one that must NOT invite
    // a retry. Pinning this to the exact prose made a copy edit look like a broken retry path.
    expect(String(got.at(-1)![1].error)).toContain('500')
    // Explicit timeout: a 500 is retryable, so this sleeps through the real 500ms + 1000ms
    // backoff. The 5s default leaves too little headroom under workerd contention, which is
    // exactly how the burst test in designGarden.test.ts became flaky.
  }, 20_000)

  test('model output that fails validation surfaces as an error event, not a broken garden', async () => {
    // Two flowers where the schema requires 3 to 5, so validateGarden rejects it. Without this
    // the client would render a garden the scene isn't laid out for.
    stubGemini(() => geminiOk({ bouquet_note: 'too few.', flowers: [FLOWER, FLOWER] }))
    const got = await events(await post(BODY))
    expect(got.map(([name]) => name)).toContain('error')
  })

  test('prose instead of a function call is an error event', async () => {
    stubGemini(() => Response.json({ candidates: [{ content: { parts: [{ text: 'here you go!' }] } }] }))
    const got = await events(await post(BODY))
    // Any error will do here; the point is that prose instead of a function call is an error
    // event rather than a half-drawn garden.
    expect(String(got.at(-1)![1].error ?? '')).not.toBe('')
  })

  test('a bad request never reaches Gemini', async () => {
    let called = 0
    globalThis.fetch = (async () => {
      called++
      return geminiOk({})
    }) as typeof fetch

    const res = await post({ message: 'hi', recipient: 'Nadia' }) // too short
    expect(res.status).toBe(400)
    expect(called).toBe(0) // validation runs before we spend a request
  })

  test('no API key configured is a 503, not a stream that fails later', async () => {
    const res = await post(BODY, { ...testEnv, GEMINI_API_KEY: '' })
    expect(res.status).toBe(503)
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})
