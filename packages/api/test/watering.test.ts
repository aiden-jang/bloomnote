import { env } from 'cloudflare:test'
import { describe, expect, test } from 'vitest'
import {
  createGarden,
  feelGarden,
  readGardenResponse,
  readResponsesBatch,
  readWaters,
  waterGarden,
} from '../src/gardens.js'

const GARDEN = {
  flowers: [
    {
      name: 'Rose',
      meaning: 'because',
      petalColors: ['#e11d48', '#f43f5e', '#fb7185'],
      centerColor: '#ffc53d',
      stemColor: '#7c9a6e',
      petalShape: 'round',
      petalCount: 8,
      stemHeight: 92,
    },
  ],
  message: 'hi',
  from: 'A',
  to: 'B',
}

async function newGarden(): Promise<string> {
  const r = await createGarden(env as never, GARDEN)
  if (!r.ok) throw new Error(r.message)
  return r.id
}

describe('watering', () => {
  test('counts up and refuses a garden that does not exist', async () => {
    const id = await newGarden()
    expect(await readWaters(env as never, id)).toBe(0)
    expect(await waterGarden(env as never, id)).toEqual({ ok: true, waters: 1 })
    expect(await waterGarden(env as never, id)).toEqual({ ok: true, waters: 2 })

    const missing = await waterGarden(env as never, 'zzzzzz')
    expect(missing.ok).toBe(false)
  })

  /**
   * The cap has to stop the WRITE, not just the number.
   *
   * Math.min clamped the value but still put() it every request, so a loop against one garden was an
   * unbounded stream of KV writes, the scarce quota, shared with garden creation. This counts the
   * puts directly, because a test that only asserted `waters === 99` passed the whole time the bug
   * was there.
   */
  test('stops writing once it is capped', async () => {
    const id = await newGarden()
    await env.GARDENS.put(`water:${id}`, '99')

    const puts: string[] = []
    const realPut = env.GARDENS.put.bind(env.GARDENS)
    ;(env.GARDENS as unknown as { put: unknown }).put = (key: string, value: string) => {
      puts.push(key)
      return realPut(key, value)
    }
    try {
      for (let i = 0; i < 5; i++) {
        expect(await waterGarden(env as never, id)).toEqual({ ok: true, waters: 99 })
      }
    } finally {
      ;(env.GARDENS as unknown as { put: unknown }).put = realPut
    }
    expect(puts).toEqual([])
    expect(await readWaters(env as never, id)).toBe(99)
  })
})

describe('readResponsesBatch', () => {
  test('returns a response per id and omits the gardens nobody answered', async () => {
    const a = await newGarden()
    const b = await newGarden()
    const c = await newGarden()
    await waterGarden(env as never, a)
    await waterGarden(env as never, a)
    await waterGarden(env as never, b)

    expect(await readResponsesBatch(env as never, [a, b, c])).toEqual({
      [a]: { waters: 2, feelings: {} },
      [b]: { waters: 1, feelings: {} },
    })
  })

  /**
   * The cap is a subrequest budget, not a preference. Every id is one KV read, KV reads count as
   * subrequests, and the free tier allows 50 per request, so the fan-out has to stay under it or
   * the whole list request fails on exactly the page that needed it.
   */
  test('never fans out past its cap, however many ids are asked for', async () => {
    const id = await newGarden()
    const many = Array.from({ length: 300 }, (_, i) => (i === 0 ? id : `zz${String(i).padStart(4, '0')}`))

    let reads = 0
    const realGet = env.GARDENS.get.bind(env.GARDENS)
    ;(env.GARDENS as unknown as { get: unknown }).get = (...args: unknown[]) => {
      reads++
      return (realGet as (...a: unknown[]) => unknown)(...args)
    }
    try {
      await readResponsesBatch(env as never, many)
    } finally {
      ;(env.GARDENS as unknown as { get: unknown }).get = realGet
    }
    expect(reads).toBeLessThanOrEqual(40)
  })

  /**
   * Junk ids are dropped before the cap, not after. `readGardenResponse` already returns an empty
   * response for one, so filtering later would look identical here while quietly letting 40 pieces
   * of junk fill the budget and push the one real garden out of the batch.
   */
  test('does not let unusable ids crowd a real garden out of the cap', async () => {
    const id = await newGarden()
    await waterGarden(env as never, id)
    // Distinct, or the Set collapses them to one and nothing is competing for the cap.
    const junkThenReal = [...Array.from({ length: 60 }, (_, i) => `../../etc/${i}`), id]

    expect(await readResponsesBatch(env as never, junkThenReal)).toEqual({
      [id]: { waters: 1, feelings: {} },
    })
  })
})

describe('garden feelings', () => {
  test('keeps a tiny anonymous feeling alongside the existing water count', async () => {
    const id = await newGarden()
    await waterGarden(env as never, id)
    await feelGarden(env as never, id, 'hug')
    await feelGarden(env as never, id, 'hug')
    await feelGarden(env as never, id, 'joy')

    expect(await readGardenResponse(env as never, id)).toEqual({
      waters: 1,
      feelings: { hug: 2, joy: 1 },
    })
    expect(await readResponsesBatch(env as never, [id])).toEqual({
      [id]: { waters: 1, feelings: { hug: 2, joy: 1 } },
    })
  })

  test('rejects unknown feelings and missing gardens', async () => {
    const id = await newGarden()
    expect((await feelGarden(env as never, id, 'shrug')).ok).toBe(false)
    expect((await feelGarden(env as never, 'zzzzzz', 'love')).ok).toBe(false)
  })

  test('reads legacy numeric water counters without losing them on a feeling', async () => {
    const id = await newGarden()
    await env.GARDENS.put(`water:${id}`, '4')
    await feelGarden(env as never, id, 'comfort')
    expect(await readGardenResponse(env as never, id)).toEqual({
      waters: 4,
      feelings: { comfort: 1 },
    })
  })
})
