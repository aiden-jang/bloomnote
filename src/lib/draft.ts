// Composer draft autosave — survives accidental refresh.
//
// The whole thing is best-effort: every operation is wrapped in try/catch
// because localStorage can throw under (a) Safari private mode quota=0
// rules and (b) certain enterprise / locked-down profiles. A failing
// draft save must never break the app, so we silently degrade.
//
// We don't save while in remix mode (see Composer.tsx) — a stale draft
// addressed to one recipient should not bleed into a reply to a
// different one.

const DRAFT_KEY = 'blossom:draft:v1'

export interface Draft {
  from: string
  recipient: string
  message: string
}

const EMPTY: Draft = { from: '', recipient: '', message: '' }

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Draft> | null
    if (!parsed || typeof parsed !== 'object') return null
    const draft: Draft = {
      from: typeof parsed.from === 'string' ? parsed.from : '',
      recipient: typeof parsed.recipient === 'string' ? parsed.recipient : '',
      message: typeof parsed.message === 'string' ? parsed.message : '',
    }
    // Don't return a draft that's entirely empty — saves one branch on
    // the consumer side.
    if (draft.from === '' && draft.recipient === '' && draft.message === '') return null
    return draft
  } catch {
    return null
  }
}

export function saveDraft(draft: Draft): void {
  try {
    // Optimization: if all fields are empty, clear instead of writing
    // an empty object. Keeps the storage tidy.
    if (draft.from === '' && draft.recipient === '' && draft.message === '') {
      localStorage.removeItem(DRAFT_KEY)
      return
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Private mode / quota — fail silently.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}

// Exported for tests / debugging in case we ever add them.
export const _DRAFT_KEY = DRAFT_KEY
export const _EMPTY_DRAFT = EMPTY
