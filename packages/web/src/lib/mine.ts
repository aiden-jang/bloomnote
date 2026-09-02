//
// Never load-bearing: every access is wrapped because localStorage throws in private-mode Safari,
// and losing this costs an outbox, not a garden. Capped and FIFO, holding a thin summary only.

const STORAGE_KEY = 'bloomnote:mine'
const LEGACY_KEY = 'blossom:mine'
const MAX_ENTRIES = 50

export interface MineRecord {
  id: string
  to: string
  from: string
  occasion?: string | undefined
  mood?: string | undefined
  createdAt: string
  unlockAt?: string | undefined
  swatches: string[]
}

function read(): MineRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Drop anything without a string id, so one corrupted entry can't crash the archive view.
    return parsed.filter(
      (r): r is MineRecord => !!r && typeof r === 'object' && typeof (r as MineRecord).id === 'string',
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
    // Quota exceeded or storage disabled. Give up silently.
  }
}

export function loadSentGardens(): MineRecord[] {
  // Saves append, so the stored order is oldest-first. Reverse for display without mutating read().
  return read().slice().reverse()
}

export function countSentGardens(): number {
  return read().length
}

export function recordSentGarden(record: MineRecord): void {
  const records = read().filter((r) => r.id !== record.id)
  records.push(record)
  const trimmed = records.length > MAX_ENTRIES ? records.slice(records.length - MAX_ENTRIES) : records
  write(trimmed)
}

export function updateSentGardenId(oldId: string | null, next: MineRecord): void {
  if (!oldId) {
    recordSentGarden(next)
    return
  }
  const records = read()
  const i = records.findIndex((r) => r.id === oldId)
  if (i === -1) {
    recordSentGarden(next)
    return
  }
  records[i] = next
  write(records)
}

export function removeSentGarden(id: string): void {
  write(read().filter((r) => r.id !== id))
}
