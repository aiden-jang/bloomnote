import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { safeMeta } from '../src/eventMeta.js'

/**
 * /api/event is public and unauthenticated, and what it logs goes to Workers Logs. bloomnote
 * carries people's private messages, so the server decides what is loggable — the client being
 * careful is not the same as the endpoint being safe.
 */
describe('event meta is filtered server-side', () => {
  it('keeps the keys the app actually sends', () => {
    expect(safeMeta({ mode: 'remix', flowerCount: 5, hasFromName: true })).toEqual({
      mode: 'remix',
      flowerCount: 5,
      hasFromName: true,
    })
  })

  it('drops a key nobody asked for', () => {
    expect(safeMeta({ mode: 'fresh', note: 'i love you, meet me at 8' })).toEqual({ mode: 'fresh' })
  })

  it('caps a permitted key so it cannot smuggle a payload', () => {
    const out = safeMeta({ mode: 'x'.repeat(500) })
    expect((out.mode as string).length).toBe(64)
  })

  it('ignores nested objects and arrays, which is how text would sneak through', () => {
    expect(safeMeta({ mode: { secret: 'private message' }, flowerCount: [1, 2, 3] })).toEqual({})
  })

  it('ignores values that are not finite numbers', () => {
    expect(safeMeta({ durationMs: NaN, attempt: Infinity })).toEqual({})
  })

  it('survives junk instead of an object', () => {
    for (const junk of [null, undefined, 'string', 42, []]) expect(safeMeta(junk)).toEqual({})
  })

  it('still accepts the request, so a bad event never breaks the page', async () => {
    const res = await SELF.fetch('https://x/api/event', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '88.9.9.9' },
      body: JSON.stringify({ name: 'composer_opened', meta: { anything: 'at all' } }),
    })
    expect(res.status).toBe(204)
  })
})
