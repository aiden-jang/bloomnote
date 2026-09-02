import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { draftStorageKey, readStoredDraft, removeStoredDraft, writeStoredDraft } from './draft'

const DRAFT = {
  from: 'Ada',
  recipient: 'Grace',
  message: 'thinking of you',
  secret: 'meet at 8',
  occasion: 'birthday',
  mood: 'warm',
  scheduleOpen: false,
  unlockLocal: '',
}

/** A tab's sessionStorage, with the path it was opened at. */
function stubWindow(pathname = '/', storage?: Partial<Storage>) {
  const values = new Map<string, string>()
  vi.stubGlobal('window', {
    location: { pathname },
    sessionStorage: storage ?? {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
}

beforeEach(() => stubWindow())
afterEach(() => vi.unstubAllGlobals())

describe('draft persistence', () => {
  it('round-trips a draft', () => {
    writeStoredDraft(draftStorageKey(), DRAFT)
    expect(readStoredDraft()).toEqual(DRAFT)
  })

  it('keeps a reply draft separate from a fresh one', () => {
    // Both are "the draft" to the composer. Sharing a key would surface a half-written reply
    // when someone starts a new note.
    stubWindow('/r/abc123')
    const replyKey = draftStorageKey()
    stubWindow('/')
    expect(draftStorageKey()).not.toBe(replyKey)
  })

  it('refuses a draft written by an older version', () => {
    window.sessionStorage.setItem(draftStorageKey(), JSON.stringify({ version: 0, draft: DRAFT }))
    expect(readStoredDraft()).toBeNull()
  })

  it('refuses a draft missing a field rather than restoring half a note', () => {
    const { message: _dropped, ...incomplete } = DRAFT
    window.sessionStorage.setItem(draftStorageKey(), JSON.stringify({ version: 1, draft: incomplete }))
    expect(readStoredDraft()).toBeNull()
  })

  it('survives junk in storage', () => {
    for (const junk of ['not json', '{}', 'null', '[]', '{"version":1}']) {
      window.sessionStorage.setItem(draftStorageKey(), junk)
      expect(readStoredDraft(), junk).toBeNull()
    }
  })

  it('defaults a missing secret rather than rejecting the draft', () => {
    // `secret` arrived after the first release, so drafts without it are still valid.
    const { secret: _s, ...older } = DRAFT
    window.sessionStorage.setItem(draftStorageKey(), JSON.stringify({ version: 1, draft: older }))
    expect(readStoredDraft()?.secret).toBe('')
  })

  it('never throws when storage is unavailable, so writing a note is never blocked', () => {
    const thrower = () => {
      throw new Error('private browsing')
    }
    stubWindow('/', { getItem: thrower, setItem: thrower, removeItem: thrower } as Partial<Storage>)
    expect(readStoredDraft()).toBeNull()
    expect(() => writeStoredDraft('k', DRAFT)).not.toThrow()
    expect(() => removeStoredDraft('k')).not.toThrow()
  })
})
