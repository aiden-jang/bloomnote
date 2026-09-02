const DAY_MS = 86_400_000
const MIN_MEMORY_DAYS = 14

export interface DatedGardenMemory {
  id: string
  createdAt: string
  receivedAt?: string | undefined
  unlockAt?: string | undefined
}

function memoryDate(garden: DatedGardenMemory): Date {
  return new Date(garden.receivedAt ?? garden.createdAt)
}

function isAnniversary(date: Date, now: Date): boolean {
  return (
    date.getFullYear() < now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

/** Exact anniversaries get the first slot, so the one date that actually means something is
    never buried under a random pick. */
export function gardenMemoryDeck<T extends DatedGardenMemory>(gardens: T[], now = new Date()): T[] {
  const eligible = gardens.filter((garden) => {
    const date = memoryDate(garden)
    if (Number.isNaN(date.getTime())) return false
    if (garden.unlockAt && new Date(garden.unlockAt).getTime() > now.getTime()) return false
    return now.getTime() - date.getTime() >= MIN_MEMORY_DAYS * DAY_MS
  })
  if (eligible.length === 0) return []

  const anniversaries = eligible
    .filter((garden) => isAnniversary(memoryDate(garden), now))
    .sort((a, b) => memoryDate(b).getTime() - memoryDate(a).getTime())
  const rest = eligible
    .filter((garden) => !isAnniversary(memoryDate(garden), now))
    .sort((a, b) => a.id.localeCompare(b.id))
  const daySeed = now.getFullYear() * 372 + now.getMonth() * 31 + now.getDate()
  const offset = rest.length > 0 ? daySeed % rest.length : 0
  const rotated = [...rest.slice(offset), ...rest.slice(0, offset)]
  return [...anniversaries, ...rotated]
}

export function gardenMemoryLabel(value: string, now = new Date()): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (isAnniversary(date, now)) {
    const years = now.getFullYear() - date.getFullYear()
    return `on this day, ${years} ${years === 1 ? 'year' : 'years'} ago`
  }
  const days = Math.max(1, Math.floor((now.getTime() - date.getTime()) / DAY_MS))
  if (days < 60) return `${days} days ago`
  const months = Math.max(2, Math.round(days / 30.44))
  if (months < 12) return `${months} months ago`
  const years = Math.max(1, Math.round(days / 365.25))
  return `${years} ${years === 1 ? 'year' : 'years'} ago`
}
