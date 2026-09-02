import { describe, expect, it } from 'vitest'
import { buildMineRecord, charCountTierClass, classifyError } from './composerHelpers'

describe('classifyError', () => {
  it('buckets the failures the composer can actually hit', () => {
    expect(classifyError(new Error('The operation was aborted'))).toBe('aborted')
    expect(classifyError(new Error('Rate limit reached'))).toBe('rate_limited')
    expect(classifyError(new Error('Request timed out'))).toBe('timeout')
    expect(classifyError(new Error('network failure'))).toBe('network')
    expect(classifyError(new Error('invalid garden payload'))).toBe('validation')
    expect(classifyError(new Error('the model said something odd'))).toBe('model')
  })

  it('never returns anything but a fixed bucket, whatever it is handed', () => {
    // This value goes to analytics. A model error can quote the note back at you, so the one
    // thing this must never do is pass a message through.
    const buckets = ['unknown', 'aborted', 'rate_limited', 'timeout', 'network', 'validation', 'model']
    const nasty = new Error('failed on note: "meet me at 8, love you" — invalid')
    expect(buckets).toContain(classifyError(nasty))
    expect(classifyError(nasty)).not.toContain('meet me')
    for (const junk of [null, undefined, 'a string', 42, { message: 'x' }]) {
      expect(buckets).toContain(classifyError(junk))
    }
  })
})

describe('buildMineRecord', () => {
  const data = {
    to: 'Grace',
    from: 'Ada',
    occasion: 'birthday',
    mood: 'warm',
    createdAt: '2026-01-01T00:00:00.000Z',
    unlockAt: undefined,
    flowers: Array.from({ length: 8 }, (_, i) => ({ petalColors: [`#00000${i}`, '#ffffff'] })),
  } as unknown as Parameters<typeof buildMineRecord>[1]

  it('keeps at most five swatches, the first colour of each flower', () => {
    const record = buildMineRecord('abc123', data)
    expect(record.swatches).toEqual(['#000000', '#000001', '#000002', '#000003', '#000004'])
  })

  it('defaults the names rather than storing undefined', () => {
    const bare = { ...data, to: undefined, from: undefined }
    const record = buildMineRecord('abc123', bare as unknown as typeof data)
    expect(record.to).toBe('')
    expect(record.from).toBe('')
  })

  it('stamps a creation time when the garden has none', () => {
    const record = buildMineRecord('abc123', { ...data, createdAt: undefined } as typeof data)
    expect(Number.isNaN(Date.parse(record.createdAt))).toBe(false)
  })
})

describe('charCountTierClass', () => {
  const styles = { charCountThin: 'thin', charCountGood: 'good', charCountNear: 'near' }

  it('says nothing about an empty note', () => {
    expect(charCountTierClass(0, styles)).toBe('')
  })

  it('grows more confident as the note does, then warns near the limit', () => {
    expect(charCountTierClass(39, styles)).toBe('thin')
    expect(charCountTierClass(40, styles)).toBe('good')
    expect(charCountTierClass(319, styles)).toBe('good')
    expect(charCountTierClass(320, styles)).toBe('near')
  })

  it('returns an empty class rather than undefined when a style is missing', () => {
    expect(charCountTierClass(100, {})).toBe('')
  })
})
