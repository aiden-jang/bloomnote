import { describe, expect, test } from 'vitest'
import {
  claimGardens,
  createGarden,
  listMine,
  putOgImage,
  readGarden,
  readOgImage,
  recordReceived,
  removeFromAccount,
} from '../src/gardens.js'
import { testEnv } from './helpers.js'

/** A flower the renderers can actually draw. Every field below feeds SVG geometry. */
const FLOWER = {
  name: 'Rose',
  meaning: 'for the obvious reason',
  petalColors: ['#e11d48', '#f43f5e', '#fb7185'],
  centerColor: '#ffc53d',
  stemColor: '#7c9a6e',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 92,
}

const GARDEN = {
  flowers: [FLOWER],
  message: 'hi',
  from: 'Aria',
  to: 'Bo',
  occasion: 'birthday',
  createdAt: '2026-07-01T00:00:00.000Z',
}

describe('gardens (KV)', () => {
  test('create + read round-trip', async () => {
    const r = await createGarden(testEnv, GARDEN)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const g = (await readGarden(testEnv, r.id)) as { message?: string } | null
    expect(g?.message).toBe('hi')
  })

  test('rejects non-gardens and unknown ids', async () => {
    expect((await createGarden(testEnv, { nope: 1 })).ok).toBe(false)
    expect(await readGarden(testEnv, 'zzzzzz')).toBeNull()
  })

  test('refuses a garden too large to be a real one', async () => {
    // Anyone can POST here and a garden is stored with no expiry, so an oversized write is
    // permanent. Real gardens are about 2KB; the cap is 16KB.
    const huge = { ...GARDEN, message: 'x'.repeat(32 * 1024) }
    const r = await createGarden(testEnv, huge)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.status).toBe(413)
  })

  test('signed-in create indexes the Sent list', async () => {
    const r = await createGarden(testEnv, GARDEN, 'user1')
    if (!r.ok) throw new Error('create failed')
    const mine = await listMine(testEnv, 'user1')
    expect(mine.sent.map((s) => s.id)).toContain(r.id)
    expect(mine.sent[0]?.to).toBe('Bo')
    expect(mine.received).toHaveLength(0)
  })

  test('receive adds to Received for others but not the owner', async () => {
    const r = await createGarden(testEnv, GARDEN, 'owner')
    if (!r.ok) throw new Error('create failed')
    expect(await recordReceived(testEnv, 'owner', r.id)).toBe(false) // your own garden isn't "received"
    expect(await recordReceived(testEnv, 'bob', r.id)).toBe(true)
    expect((await listMine(testEnv, 'owner')).received).toHaveLength(0)
    const bob = await listMine(testEnv, 'bob')
    expect(bob.received.map((x) => x.id)).toContain(r.id)
    expect(bob.received[0]?.receivedAt).toBeTruthy()
  })

  test('removeFromAccount detaches from Sent/Received but keeps the garden', async () => {
    const r = await createGarden(testEnv, GARDEN, 'owner')
    if (!r.ok) throw new Error('create failed')
    await recordReceived(testEnv, 'bob', r.id)

    await removeFromAccount(testEnv, 'owner', r.id)
    await removeFromAccount(testEnv, 'bob', r.id)

    expect((await listMine(testEnv, 'owner')).sent).toHaveLength(0)
    expect((await listMine(testEnv, 'bob')).received).toHaveLength(0)
    // The garden itself survives, so a shared link still opens.
    expect(await readGarden(testEnv, r.id)).not.toBeNull()
  })

  // A flower missing any geometry field renders as a black smudge rather than failing, because
  // React only warns about a NaN attribute. Both doors are covered: write refuses it, read repairs
  // whatever is already stored.
  describe('unrenderable flowers', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['no stemHeight', { ...FLOWER, stemHeight: undefined }],
      ['no petalCount', { ...FLOWER, petalCount: undefined }],
      ['no petalColors', { ...FLOWER, petalColors: undefined }],
      ['one petal color instead of three', { ...FLOWER, petalColors: ['#e11d48'] }],
      ['a color that is not hex', { ...FLOWER, centerColor: 'red' }],
      ['an unknown petal shape', { ...FLOWER, petalShape: 'hexagonal' }],
      ['a fractional petal count', { ...FLOWER, petalCount: 8.5 }],
      ['a stem taller than the scene', { ...FLOWER, stemHeight: 4000 }],
    ]

    for (const [label, flower] of cases) {
      test(`write rejects ${label}`, async () => {
        const r = await createGarden(testEnv, { ...GARDEN, flowers: [flower] })
        expect(r.ok).toBe(false)
      })
    }

    test('write rejects a reply whose quoted garden is broken', async () => {
      const previous = { ...GARDEN, flowers: [{ ...FLOWER, stemHeight: undefined }] }
      expect((await createGarden(testEnv, { ...GARDEN, previous })).ok).toBe(false)
    })

    test('read repairs a garden stored before the write door existed', async () => {
      // Straight into KV, bypassing createGarden — this is what the old writes left behind.
      const id = 'legacy'
      await testEnv.GARDENS.put(
        `g:${id}`,
        JSON.stringify({ ...GARDEN, flowers: [{ name: 'Ghost', petalColors: ['#e11d48'] }] }),
      )
      const g = (await readGarden(testEnv, id)) as { flowers: Record<string, unknown>[] }
      const f = g.flowers[0]!
      expect(Number.isInteger(f.stemHeight)).toBe(true)
      expect(Number.isInteger(f.petalCount)).toBe(true)
      expect(f.petalColors).toHaveLength(3)
      expect(f.centerColor).toMatch(/^#[0-9a-f]{6}$/i)
      expect(f.stemColor).toMatch(/^#[0-9a-f]{6}$/i)
      expect(f.petalShape).toBe('round')
      expect(f.name).toBe('Ghost') // what survived is kept, not overwritten
    })

    test('read leaves a good garden exactly as it was', async () => {
      const r = await createGarden(testEnv, GARDEN)
      if (!r.ok) throw new Error('create failed')
      const g = (await readGarden(testEnv, r.id)) as { flowers: unknown[] }
      expect(g.flowers[0]).toEqual(FLOWER)
    })
  })

  test('claim adopts anonymous gardens once', async () => {
    const r = await createGarden(testEnv, GARDEN) // anonymous — no owner
    if (!r.ok) throw new Error('create failed')
    expect(await claimGardens(testEnv, 'u', [r.id])).toBe(1)
    expect((await listMine(testEnv, 'u')).sent.map((s) => s.id)).toContain(r.id)
    // Already owned → a second claim by anyone is a no-op.
    expect(await claimGardens(testEnv, 'other', [r.id])).toBe(0)
  })
})

/**
 * The link-preview card.
 *
 * Write-once and unauthenticated, which is a combination worth pinning down. bloomnote is
 * anonymous-first, so requiring a session would mean most gardens never get a card at all; what
 * stands in for auth is that the id is unguessable and the first write is the only write. Without
 * that second half, anyone who saw a shared link could replace the picture on someone's gift.
 */
describe('share-card image', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).buffer
  const NOT_PNG = new TextEncoder().encode('<svg>nope</svg>').buffer

  const madeGarden = async (): Promise<string> => {
    const r = await createGarden(testEnv, GARDEN)
    if (!r.ok) throw new Error('create failed')
    return r.id
  }

  test('stores the first card and serves it back', async () => {
    const id = await madeGarden()
    expect((await putOgImage(testEnv, id, PNG)).ok).toBe(true)
    expect(await readOgImage(testEnv, id)).not.toBeNull()
  })

  test('refuses a second write, so a link-holder cannot replace the picture', async () => {
    const id = await madeGarden()
    expect((await putOgImage(testEnv, id, PNG)).ok).toBe(true)
    const second = await putOgImage(testEnv, id, PNG)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.status).toBe(409)
  })

  test('refuses anything that is not a PNG', async () => {
    const id = await madeGarden()
    expect((await putOgImage(testEnv, id, NOT_PNG)).ok).toBe(false)
    expect(await readOgImage(testEnv, id)).toBeNull()
  })

  test('refuses a card for a garden that does not exist', async () => {
    // Otherwise the store doubles as free image hosting on someone else's domain.
    expect((await putOgImage(testEnv, 'nosuch', PNG)).ok).toBe(false)
  })

  test('has no card before one is uploaded', async () => {
    expect(await readOgImage(testEnv, await madeGarden())).toBeNull()
  })
})
