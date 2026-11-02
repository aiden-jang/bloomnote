export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024
export const MAX_BACKUP_GARDENS = 200
export const MAX_VOICE_BYTES = 2 * 1024 * 1024
export const GARDEN_ID = /^[A-Za-z0-9]{4,12}$/

export interface BackupFlower {
  name: string
  meaning: string
  petalColors: [string, string, string]
  centerColor: string
  stemColor: string
  petalShape: 'round' | 'elongated' | 'bell' | 'small' | 'star'
  petalCount: number
  stemHeight: number
}
export interface BackupGarden {
  flowers: BackupFlower[]
  bouquetNote: string
  message: string
  from: string
  to?: string
  secret?: string
  createdAt?: string
  unlockAt?: string
  occasion?: string
  mood?: string
  previous?: BackupGarden
}
export interface BackupResponse {
  waters: number
  feelings: Partial<Record<'love' | 'comfort' | 'joy' | 'hug', number>>
}
export interface BackupVoice {
  type: string
  base64: string
  seconds: number
  savedAt: string
}
export interface BackupEntry {
  id: string
  libraries: ('sent' | 'received')[]
  createdAt: string
  receivedAt?: string
  garden: BackupGarden
  response: BackupResponse
  pinned: boolean
  wateredByMe?: boolean
  myFeeling?: 'love' | 'comfort' | 'joy' | 'hug'
  voice?: BackupVoice
}
export interface GardenBackup {
  format: 'bloomnote-backup'
  version: 1
  exportedAt: string
  source: 'account' | 'device'
  deviceVoicesIncluded: boolean
  entries: BackupEntry[]
}

export class BackupError extends Error {}
const fail = (message: string): never => {
  throw new BackupError(message)
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('This backup contains an unreadable record.')
  return value as Record<string, unknown>
}
function text(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'string') return fail('A garden text field could not be read.')
  return value
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    return fail('A garden measurement is outside its supported range.')
  return value
}
function color(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value))
    return fail('A flower colour could not be read.')
  return value
}

// Copy only renderable content. Stored owner IDs, credentials and restore receipts never enter a file.
export function backupGarden(value: unknown, depth = 0): BackupGarden {
  if (depth > 1) return fail('This backup has a reply nested too deeply.')
  const g = object(value)
  if (!Array.isArray(g.flowers) || g.flowers.length < 1 || g.flowers.length > 5)
    return fail('A garden must contain one to five flowers.')
  const flowers = g.flowers.map((value): BackupFlower => {
    const f = object(value)
    if (!Array.isArray(f.petalColors) || f.petalColors.length !== 3)
      return fail('A flower needs three petal colours.')
    const shape = f.petalShape
    if (!['round', 'elongated', 'bell', 'small', 'star'].includes(String(shape)))
      return fail('A flower shape is unsupported.')
    return {
      name: text(f.name),
      meaning: text(f.meaning),
      petalColors: f.petalColors.map(color) as [string, string, string],
      centerColor: color(f.centerColor),
      stemColor: color(f.stemColor),
      petalShape: shape as BackupFlower['petalShape'],
      petalCount: integer(f.petalCount, 3, 20),
      stemHeight: integer(f.stemHeight, 40, 160),
    }
  })
  const garden: BackupGarden = {
    flowers,
    bouquetNote: text(g.bouquetNote),
    message: text(g.message),
    from: text(g.from),
  }
  for (const key of ['to', 'secret', 'createdAt', 'unlockAt', 'occasion', 'mood'] as const) {
    if (g[key] !== undefined && g[key] !== null) garden[key] = text(g[key])
  }
  if (g.previous !== undefined) garden.previous = backupGarden(g.previous, depth + 1)
  if (new TextEncoder().encode(JSON.stringify(garden)).length > 16 * 1024)
    return fail('A garden exceeds the supported 16 KB size.')
  return garden
}

export function backupResponse(value: unknown): BackupResponse {
  const r = object(value)
  const feelings = object(r.feelings)
  const out: BackupResponse = { waters: integer(r.waters, 0, 99), feelings: {} }
  for (const key of ['love', 'comfort', 'joy', 'hug'] as const) {
    if (feelings[key] !== undefined) out.feelings[key] = integer(feelings[key], 0, 99)
  }
  return out
}

export function backupVoice(value: unknown): BackupVoice {
  const v = object(value)
  const type = text(v.type)
  if (!/^audio\/(?:webm|mp4|ogg|mpeg|wav|x-wav)(?:;[a-z0-9= ._-]+)?$/i.test(type) || type.length > 100)
    return fail('A voice memory uses an unsupported audio format.')
  const base64 = text(v.base64)
  if (
    !base64 ||
    base64.length > Math.ceil(MAX_VOICE_BYTES / 3) * 4 ||
    base64.length % 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  )
    return fail('A voice memory is unreadable or exceeds 2 MB.')
  const bytes = atob(base64)
  if (bytes.length > MAX_VOICE_BYTES) return fail('A voice memory exceeds 2 MB.')
  const savedAt = text(v.savedAt)
  if (savedAt.length > 64 || !Number.isFinite(Date.parse(savedAt)))
    return fail('A voice memory date could not be read.')
  return { type, base64, seconds: integer(v.seconds, 1, 86400), savedAt }
}

export function backupEntry(value: unknown, withVoice = true): BackupEntry {
  const e = object(value)
  const id = text(e.id)
  if (!GARDEN_ID.test(id)) return fail('A garden identifier could not be read.')
  if (
    !Array.isArray(e.libraries) ||
    e.libraries.length < 1 ||
    e.libraries.length > 2 ||
    e.libraries.some((x) => x !== 'sent' && x !== 'received') ||
    new Set(e.libraries).size !== e.libraries.length
  )
    return fail('A garden library could not be read.')
  if (typeof e.pinned !== 'boolean') return fail('A garden pin could not be read.')
  const entry: BackupEntry = {
    id,
    libraries: e.libraries as BackupEntry['libraries'],
    createdAt: text(e.createdAt),
    garden: backupGarden(e.garden),
    response: backupResponse(e.response),
    pinned: e.pinned,
  }
  if (entry.createdAt.length > 100) return fail('A garden date is too long.')
  if (e.receivedAt !== undefined) {
    entry.receivedAt = text(e.receivedAt)
    if (entry.receivedAt.length > 100) return fail('A received date is too long.')
  }
  if (e.wateredByMe !== undefined) {
    if (typeof e.wateredByMe !== 'boolean') return fail('A saved watering choice could not be read.')
    entry.wateredByMe = e.wateredByMe
  }
  if (e.myFeeling !== undefined) {
    if (!['love', 'comfort', 'joy', 'hug'].includes(String(e.myFeeling)))
      return fail('A saved feeling could not be read.')
    entry.myFeeling = e.myFeeling as NonNullable<BackupEntry['myFeeling']>
  }
  if (withVoice && e.voice !== undefined) entry.voice = backupVoice(e.voice)
  return entry
}

export function readBackup(value: unknown): GardenBackup {
  const b = object(value)
  if (b.format !== 'bloomnote-backup') return fail('Choose a Bloomnote JSON backup.')
  if (b.version !== BACKUP_VERSION)
    return fail('This backup version is not supported. Keep the original file.')
  if (b.source !== 'account' && b.source !== 'device') return fail('This backup source is unsupported.')
  if (typeof b.deviceVoicesIncluded !== 'boolean')
    return fail('This backup does not identify its voice contents.')
  if (!Array.isArray(b.entries) || b.entries.length > MAX_BACKUP_GARDENS)
    return fail(`Backups support up to ${MAX_BACKUP_GARDENS} gardens.`)
  const entries = b.entries.map((e) => backupEntry(e))
  if (new Set(entries.map((e) => e.id)).size !== entries.length)
    return fail('This backup repeats a garden identifier.')
  if (!b.deviceVoicesIncluded && entries.some((e) => e.voice))
    return fail('This backup has inconsistent voice contents.')
  const exportedAt = text(b.exportedAt)
  if (exportedAt.length > 64 || !Number.isFinite(Date.parse(exportedAt)))
    return fail('This backup date could not be read.')
  const out: GardenBackup = {
    format: 'bloomnote-backup',
    version: BACKUP_VERSION,
    exportedAt,
    source: b.source,
    deviceVoicesIncluded: b.deviceVoicesIncluded,
    entries,
  }
  if (new TextEncoder().encode(JSON.stringify(out)).length > MAX_BACKUP_BYTES)
    return fail('This backup exceeds 32 MB. Keep the original file.')
  return out
}
