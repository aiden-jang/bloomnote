import { env } from 'cloudflare:test'
import { describe, expect, test } from 'vitest'
import { createGarden, listMine, recordReceived } from '../src/gardens.js'

const flower = {
  name: 'Rose',
  meaning: 'because',
  petalColors: ['#e11d48', '#f43f5e', '#fb7185'],
  centerColor: '#ffc53d',
  stemColor: '#7c9a6e',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 92,
}
const garden = (to: string, createdAt: string) => ({
  flowers: [flower],
  message: 'hi',
  from: 'Aiden',
  to,
  createdAt,
})

/** Count KV gets across a call, which is what the subrequest budget actually spends. */
async function countingGets<T>(fn: () => Promise<T>): Promise<{ result: T; gets: number }> {
  let gets = 0
  const real = env.GARDENS.get.bind(env.GARDENS)
  ;(env.GARDENS as unknown as { get: unknown }).get = (...a: unknown[]) => {
    gets++
    return (real as (...x: unknown[]) => unknown)(...a)
  }
  try {
    return { result: await fn(), gets }
  } finally {
    ;(env.GARDENS as unknown as { get: unknown }).get = real
  }
}

describe('listMine', () => {
  test('lists a page of gardens without one read per garden', async () => {
    const user = `u${crypto.randomUUID().slice(0, 8)}`
    for (let i = 0; i < 25; i++) {
      const r = await createGarden(
        env as never,
        garden(`p${i}`, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`),
        user,
      )
      expect(r.ok).toBe(true)
    }

    const { result, gets } = await countingGets(() => listMine(env as never, user))
    expect(result.sent).toHaveLength(25)
    // The whole point: 25 gardens used to cost 25 gets. Metadata comes back with the list.
    expect(gets).toBe(0)
    // Newest first still holds when the data comes from metadata.
    expect(result.sent[0]?.to).toBe('p24')
    expect(result.sent[24]?.to).toBe('p0')
  })

  test('still reads entries written before metadata existed, and heals them', async () => {
    const user = `u${crypto.randomUUID().slice(0, 8)}`
    const r = await createGarden(env as never, garden('Legacy', '2026-02-01T00:00:00.000Z'), user)
    if (!r.ok) throw new Error('setup failed')
    const key = `sent:${user}:${r.id}`
    // Rewrite it the old way: value only, no metadata.
    const raw = await env.GARDENS.get(key)
    await env.GARDENS.put(key, raw!)

    const first = await countingGets(() => listMine(env as never, user))
    expect(first.result.sent).toHaveLength(1)
    expect(first.result.sent[0]?.to).toBe('Legacy')
    expect(first.gets).toBe(1) // fetched once...

    const second = await countingGets(() => listMine(env as never, user))
    expect(second.result.sent).toHaveLength(1)
    expect(second.gets).toBe(0) // ...and healed, so never again
  })

  test('received gardens keep receivedAt through metadata', async () => {
    const owner = `o${crypto.randomUUID().slice(0, 8)}`
    const reader = `r${crypto.randomUUID().slice(0, 8)}`
    const r = await createGarden(env as never, garden('Someone', '2026-03-01T00:00:00.000Z'), owner)
    if (!r.ok) throw new Error('setup failed')
    expect(await recordReceived(env as never, reader, r.id)).toBe(true)

    const { result, gets } = await countingGets(() => listMine(env as never, reader))
    expect(result.received).toHaveLength(1)
    expect(result.received[0]?.receivedAt).toBeTruthy()
    expect(gets).toBe(0)
  })
})
