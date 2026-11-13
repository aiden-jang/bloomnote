import type { FlowerSpec } from '../garden'
import { MAX_MEANING } from './shelves'

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
  shelves?: string[]
  /** What the keeper says it means. Not the sender's `meaning`, and never replaces it. */
  mine?: string
}

export function decodeFlowerJournal(raw: string | null): FlowerJournalEntry[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is FlowerJournalEntry => {
      if (!entry || typeof entry !== 'object') return false
      const value = entry as Partial<FlowerJournalEntry>
      return (
        typeof value.id === 'string' &&
        typeof value.gardenId === 'string' &&
        typeof value.flowerName === 'string' &&
        typeof value.meaning === 'string' &&
        typeof value.memory === 'string' &&
        typeof value.savedAt === 'string' &&
        typeof value.flowerIndex === 'number' &&
        Array.isArray(value.colors)
      )
    })
  } catch {
    return []
  }
}

export function loadFlowerJournal(strict = false): FlowerJournalEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const entries = decodeFlowerJournal(raw)
    if (strict && raw !== null) {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length !== entries.length) throw new Error('Unreadable journal')
    }
    return entries.slice().reverse()
  } catch {
    if (strict)
      throw new Error('Could not read every flower journal memory. Keep the device data and try again.')
    return []
  }
}

export function flowerJournalEntry(gardenId: string, flowerIndex: number): FlowerJournalEntry | null {
  return loadFlowerJournal().find((entry) => entry.id === `${gardenId}:${flowerIndex}`) ?? null
}

export function saveFlowerJournalEntry(input: {
  gardenId: string
  flowerIndex: number
  flower: FlowerSpec
  memory: string
  from?: string | undefined
}): FlowerJournalEntry | null {
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
  if (typeof window === 'undefined') return null
  try {
    const current = decodeFlowerJournal(window.localStorage.getItem(STORAGE_KEY))
    const previous = current.find((item) => item.id === entry.id)
    const updated = { ...previous, ...entry }
    const others = current.filter((item) => item.id !== entry.id)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...others, updated].slice(-MAX_ENTRIES)))
    window.dispatchEvent(new Event(FLOWER_JOURNAL_EVENT))
    return updated
  } catch {
    return null
  }
}

function updateEntry(id: string, change: (entry: FlowerJournalEntry) => FlowerJournalEntry): boolean {
  if (typeof window === 'undefined') return false
  try {
    const current = decodeFlowerJournal(window.localStorage.getItem(STORAGE_KEY))
    const index = current.findIndex((entry) => entry.id === id)
    if (index < 0) return false
    current[index] = change(current[index]!)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    window.dispatchEvent(new Event(FLOWER_JOURNAL_EVENT))
    return true
  } catch {
    return false
  }
}

export function setEntryShelves(id: string, shelves: string[]): boolean {
  return updateEntry(id, (entry) => ({ ...entry, shelves }))
}

/** An empty string clears it, so the sender's meaning comes back rather than staying replaced. */
export function setEntryMeaning(id: string, mine: string): boolean {
  const trimmed = mine.trim().slice(0, MAX_MEANING)
  return updateEntry(id, (entry) => {
    const { mine: _dropped, ...rest } = entry
    return trimmed ? { ...rest, mine: trimmed } : rest
  })
}

export function removeFlowerJournalEntry(id: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const current = decodeFlowerJournal(window.localStorage.getItem(STORAGE_KEY)).filter(
      (entry) => entry.id !== id,
    )
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    window.dispatchEvent(new Event(FLOWER_JOURNAL_EVENT))
    return true
  } catch {
    return false
  }
}

export function mergeFlowerJournalEntries(entries: FlowerJournalEntry[]): boolean {
  if (typeof window === 'undefined') return false
  try {
    const current = loadFlowerJournal(true).reverse()
    const existing = new Set(current.map((entry) => entry.id))
    const merged = [...current, ...entries.filter((entry) => !existing.has(entry.id))]
    if (merged.length > MAX_ENTRIES) return false
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    window.dispatchEvent(new Event(FLOWER_JOURNAL_EVENT))
    return true
  } catch {
    return false
  }
}
