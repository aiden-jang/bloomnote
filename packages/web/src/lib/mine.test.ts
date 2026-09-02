import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  countSentGardens,
  loadSentGardens,
  recordSentGarden,
  removeSentGarden,
  updateSentGardenId,
  type MineRecord,
} from './mine'

const record = (id: string, to = 'Nadia'): MineRecord => ({
  id,
  to,
  from: 'Aiden',
  createdAt: '2026-08-20T10:00:00.000Z',
  swatches: ['#6f8fd0'],
})

let store: Map<string, string>

function stubStorage(overrides?: Partial<Storage>) {
  store = new Map()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      ...overrides,
    },
  })
}

beforeEach(() => stubStorage())
afterEach(() => vi.unstubAllGlobals())

describe('the on-device archive', () => {
  it('shows the newest garden first, though saves append', () => {
    recordSentGarden(record('first'))
    recordSentGarden(record('second'))
    expect(loadSentGardens().map((r) => r.id)).toEqual(['second', 'first'])
  })

  it('replaces a garden saved again under the same id rather than duplicating it', () => {
    recordSentGarden(record('same', 'Nadia'))
    recordSentGarden(record('same', 'Theo'))
    expect(countSentGardens()).toBe(1)
    expect(loadSentGardens()[0]!.to).toBe('Theo')
  })

  /* FIFO at 50, so a heavy sender loses their oldest links rather than their newest. */
  it('caps the archive and drops the oldest first', () => {
    for (let i = 0; i < 60; i += 1) recordSentGarden(record(`g${i}`))
    const ids = loadSentGardens().map((r) => r.id)
    expect(ids).toHaveLength(50)
    expect(ids[0]).toBe('g59')
    expect(ids).not.toContain('g0')
    expect(ids).not.toContain('g9')
  })

  it('repoints an entry after a re-roll without moving it in the list', () => {
    recordSentGarden(record('older'))
    recordSentGarden(record('rerolled'))
    recordSentGarden(record('newest'))
    updateSentGardenId('rerolled', record('replacement'))

    const ids = loadSentGardens().map((r) => r.id)
    expect(ids).toEqual(['newest', 'replacement', 'older'])
  })

  it('inserts instead when the entry being repointed has already gone', () => {
    // Storage cleared mid-session, so there is nothing to update. Losing the record is worse.
    updateSentGardenId('vanished', record('fresh'))
    expect(loadSentGardens().map((r) => r.id)).toEqual(['fresh'])
  })

  it('inserts when there was no previous id at all', () => {
    updateSentGardenId(null, record('brand-new'))
    expect(countSentGardens()).toBe(1)
  })

  it('removes one garden and leaves the rest', () => {
    recordSentGarden(record('keep'))
    recordSentGarden(record('drop'))
    removeSentGarden('drop')
    expect(loadSentGardens().map((r) => r.id)).toEqual(['keep'])
  })

  /* One corrupted entry must not take the whole archive view down with it. */
  it('drops entries with no string id instead of throwing', () => {
    store.set('bloomnote:mine', JSON.stringify([record('good'), { to: 'no id' }, null, 7]))
    expect(loadSentGardens().map((r) => r.id)).toEqual(['good'])
  })

  it('reads a pre-rename archive so it carries over', () => {
    store.set('blossom:mine', JSON.stringify([record('legacy')]))
    expect(loadSentGardens().map((r) => r.id)).toEqual(['legacy'])
  })

  it('treats junk in the key as an empty archive', () => {
    store.set('bloomnote:mine', '{not json')
    expect(loadSentGardens()).toEqual([])
    store.set('bloomnote:mine', '{"not":"an array"}')
    expect(loadSentGardens()).toEqual([])
  })

  /* Private-mode Safari throws on write. An outbox that does not persist beats a crash. */
  it('survives storage that refuses to be written to', () => {
    stubStorage({
      setItem: () => {
        throw new Error('quota exceeded')
      },
    })
    expect(() => recordSentGarden(record('doomed'))).not.toThrow()
    expect(loadSentGardens()).toEqual([])
  })
})
