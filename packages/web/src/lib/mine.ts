// An on-device archive of the gardens you've sent, so you can find last week's link without having
// stashed it yourself. Nothing here is uploaded.
//
// Never load-bearing: every access is wrapped because localStorage throws in private-mode Safari,
// and losing it costs an outbox, not a garden. Capped and FIFO, holding a thin summary rather than
// a copy of the record that already lives server-side.

const STORAGE_KEY = 'bloomnote:mine'
const LEGACY_KEY = 'blossom:mine' // pre-rename; read as a fallback so on-device archives carry over
const MAX_ENTRIES = 50

export interface MineRecord {
  /** The `/g/<id>` the recipient opens. */
  id: string
  to: string
  from: string
  occasion?: string | undefined
  mood?: string | undefined
  createdAt: string
  /** Set only for a time capsule. */
  unlockAt?: string | undefined
  /** One petal colour per flower, so /mine draws a recognisable card without re-fetching it. */
  swatches: string[]
}

function read(): MineRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Defensive filter: drop anything that doesn't at least have a
    // string id, so a corrupted entry can't crash the archive view.
    return parsed.filter(
      (r): r is MineRecord =>
        !!r && typeof r === 'object' && typeof (r as MineRecord).id === 'string',
    )
  } catch {
    return []
  }
}

function write(records: MineRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Quota exceeded or storage disabled — silently give up.
  }
}

/** Stored gardens, newest first (ready for display). */
export function loadSentGardens(): MineRecord[] {
  // We append on save, so the on-disk order is oldest-first; reverse
  // for display without mutating the read() result.
  return read().slice().reverse()
}

/** How many gardens are archived. Cheap enough to call on every mount
 *  to decide whether to surface the "your gardens" link. */
export function countSentGardens(): number {
  return read().length
}

/** Append a freshly-created garden. De-dupes on id (a repeat save of
 *  the same id replaces in place) and trims the oldest entries past
 *  the cap. */
export function recordSentGarden(record: MineRecord): void {
  const records = read().filter(r => r.id !== record.id)
  records.push(record)
  const trimmed =
    records.length > MAX_ENTRIES ? records.slice(records.length - MAX_ENTRIES) : records
  write(trimmed)
}

/**
 * Point an existing archive entry at a newly-generated garden — used
 * after a re-roll, which creates a brand-new short ID for what is
 * conceptually the same "I'm sending Maya a garden" session. We
 * replace the old entry in place (preserving its list position) so the
 * archive shows one card per session, tracking the latest re-roll.
 *
 * Falls back to a plain insert when the old ID isn't found (e.g. the
 * archive was cleared mid-session, or storage was unavailable at
 * first-design time).
 */
export function updateSentGardenId(oldId: string | null, next: MineRecord): void {
  if (!oldId) {
    recordSentGarden(next)
    return
  }
  const records = read()
  const i = records.findIndex(r => r.id === oldId)
  if (i === -1) {
    recordSentGarden(next)
    return
  }
  records[i] = next
  write(records)
}

/** Remove a single garden from the archive (the per-card "remove"
 *  affordance on /mine). Server-side record is untouched — the link
 *  still works for anyone who already has it. */
export function removeSentGarden(id: string): void {
  write(read().filter(r => r.id !== id))
}
