/*
 * The composer's in-progress note, cached so an accidental refresh does not lose it.
 *
 * sessionStorage, not localStorage: a note survives a refresh but never follows someone to
 * another browser and never outlives the tab. That matters here — the thing being cached is
 * a private message someone is part-way through writing.
 *
 * Every read and write is wrapped. Private browsing and a full quota both throw, and losing a
 * draft is a disappointment, not a reason for the composer to look broken.
 */

export interface Draft {
  from: string
  recipient: string
  message: string
  secret: string
  occasion: string
  mood: string
  scheduleOpen: boolean
  unlockLocal: string
}

const STORAGE_VERSION = 1

/**
 * Keyed on the path, so a half-written reply to one garden never surfaces when someone starts
 * a fresh note somewhere else.
 */
export function draftStorageKey(): string {
  return `bloomnote:draft:${window.location.pathname}`
}

/** The stored draft, or null if there isn't one, it's from an older shape, or storage threw. */
export function readStoredDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(draftStorageKey())
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as { version?: unknown; draft?: unknown }
    if (record.version !== STORAGE_VERSION || !record.draft || typeof record.draft !== 'object') {
      return null
    }
    const draft = record.draft as Partial<Draft>
    if (
      typeof draft.from !== 'string' ||
      typeof draft.recipient !== 'string' ||
      typeof draft.message !== 'string' ||
      (draft.secret !== undefined && typeof draft.secret !== 'string') ||
      typeof draft.occasion !== 'string' ||
      typeof draft.mood !== 'string' ||
      typeof draft.scheduleOpen !== 'boolean' ||
      typeof draft.unlockLocal !== 'string'
    ) {
      return null
    }
    return { ...draft, secret: typeof draft.secret === 'string' ? draft.secret : '' } as Draft
  } catch {
    return null
  }
}

export function writeStoredDraft(key: string, draft: Draft): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, draft }))
  } catch {
    // See readStoredDraft.
  }
}

export function removeStoredDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // See readStoredDraft.
  }
}
