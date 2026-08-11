import type { FlowerSpec } from '../garden'

const STORAGE_KEY = 'bloomnote.flower-journal.v1'
const MAX_ENTRIES = 80
export const FLOWER_JOURNAL_EVENT = 'bloomnote:flower-journal'

export interface FlowerJournalEntry {
  id: string
  gardenId: string
  flowerIndex: number
  flowerName: string
  meaning: string
  colors: string[]
  memory: string
  from?: string | undefined
  savedAt: string
}

export function decodeFlowerJournal(raw: string | null): FlowerJournalEntry[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is FlowerJournalEntry => {
      if (!entry || typeof entry !== 'object') return false
      const value = entry as Partial<FlowerJournalEntry>
      return typeof value.id === 'string' && typeof value.gardenId === 'string' &&
        typeof value.flowerName === 'string' && typeof value.meaning === 'string' &&
        typeof value.memory === 'string' && typeof value.savedAt === 'string' &&
        typeof value.flowerIndex === 'number' && Array.isArray(value.colors)
    })
  } catch {
    return []
  }
}

export function loadFlowerJournal(): FlowerJournalEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return decodeFlowerJournal(window.localStorage.getItem(STORAGE_KEY)).slice().reverse()
  } catch {
    return []
  }
}

export function flowerJournalEntry(gardenId: string, flowerIndex: number): FlowerJournalEntry | null {
  return loadFlowerJournal().find(entry => entry.id === `${gardenId}:${flowerIndex}`) ?? null
}

export function saveFlowerJournalEntry(input: {
  gardenId: string
  flowerIndex: number
  flower: FlowerSpec
  memory: string
  from?: string | undefined
}): FlowerJournalEntry {
  const entry: FlowerJournalEntry = {
    id: `${input.gardenId}:${input.flowerIndex}`,
    gardenId: input.gardenId,
    flowerIndex: input.flowerIndex,
    flowerName: input.flower.name,
    meaning: input.flower.meaning,
    colors: input.flower.petalColors.slice(0, 4),
    memory: input.memory.trim().slice(0, 240),
    ...(input.from?.trim() ? { from: input.from.trim() } : {}),
    savedAt: new Date().toISOString(),
  }
  if (typeof window === 'undefined') return entry
  try {
    const current = decodeFlowerJournal(window.localStorage.getItem(STORAGE_KEY)).filter(item => item.id !== entry.id)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, entry].slice(-MAX_ENTRIES)))
    window.dispatchEvent(new Event(FLOWER_JOURNAL_EVENT))
  } catch {
    // A flower journal is an optional on-device keepsake; storage failures never block the garden.
  }
  return entry
}

export function removeFlowerJournalEntry(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const current = decodeFlowerJournal(window.localStorage.getItem(STORAGE_KEY)).filter(entry => entry.id !== id)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    window.dispatchEvent(new Event(FLOWER_JOURNAL_EVENT))
  } catch {
    // no-op
  }
}
