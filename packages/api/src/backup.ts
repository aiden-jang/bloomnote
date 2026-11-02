import {
  backupEntry,
  backupGarden,
  BackupError,
  GARDEN_ID,
  type BackupEntry,
} from '../../../shared/backup.js'
import { readGarden, readGardenResponse, type GardenSummary } from './gardens.js'
import type { Env } from './env.js'

type Page = { kind: 'sent' | 'received'; cursor?: string }
const encodeCursor = (page: Page) => btoa(JSON.stringify(page))
function decodeCursor(raw?: string): Page {
  if (!raw) return { kind: 'sent' }
  if (raw.length > 4096) throw new BackupError('Invalid backup page.')
  let value: Partial<Page>
  try {
    value = JSON.parse(atob(raw)) as Partial<Page>
  } catch {
    throw new BackupError('Invalid backup page.')
  }
  if (!value || typeof value !== 'object') throw new BackupError('Invalid backup page.')
  if (
    (value.kind !== 'sent' && value.kind !== 'received') ||
    (value.cursor !== undefined && typeof value.cursor !== 'string')
  )
    throw new BackupError('Invalid backup page.')
  return value as Page
}

export async function exportBackupPage(
  env: Env,
  userId: string,
  raw?: string,
): Promise<{ entries: BackupEntry[]; next: string | null }> {
  const page = decodeCursor(raw)
  const prefix = `${page.kind === 'sent' ? 'sent' : 'recv'}:${userId}:`
  // Ten entries fit the free Worker's subrequest budget even when every summary is legacy.
  const listed = await env.GARDENS.list<GardenSummary>({
    prefix,
    limit: 10,
    ...(page.cursor ? { cursor: page.cursor } : {}),
  })
  const entries: BackupEntry[] = []
  for (const key of listed.keys) {
    if (!key.name.startsWith(prefix)) throw new BackupError('Invalid backup page.')
    const id = key.name.slice(prefix.length)
    if (!GARDEN_ID.test(id)) throw new Error('A library entry could not be read.')
    const summary = key.metadata ?? (await env.GARDENS.get<GardenSummary>(key.name, 'json'))
    const garden = await readGarden(env, id)
    if (!summary || garden === null) throw new Error('A saved garden could not be read. Try exporting again.')
    const entry: BackupEntry = {
      id,
      libraries: [page.kind],
      createdAt: summary.createdAt,
      garden: backupGarden(garden),
      response: await readGardenResponse(env, id),
      pinned: false,
    }
    if (page.kind === 'received' && summary.receivedAt) entry.receivedAt = summary.receivedAt
    entries.push(backupEntry(entry, false))
  }
  if (!listed.list_complete && !listed.cursor) throw new Error('Backup pages stopped advancing.')
  const next = !listed.list_complete
    ? encodeCursor({ kind: page.kind, cursor: listed.cursor })
    : page.kind === 'sent'
      ? encodeCursor({ kind: 'received' })
      : null
  return { entries, next }
}

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('')
}
function restoredId(hash: string): string {
  let n = BigInt(`0x${hash}`),
    id = ''
  for (let i = 0; i < 12; i++) {
    id += ALPHABET[Number(n % BigInt(ALPHABET.length))]
    n /= BigInt(ALPHABET.length)
  }
  return id
}

export class RestoreConflict extends Error {}

// Each item is repeatable. A network failure may leave copies already saved; retrying the same
// file repairs missing indexes rather than duplicating gardens or overwriting original gifts.
export async function restoreBackupEntry(
  env: Env,
  userId: string,
  fileHash: string,
  value: unknown,
): Promise<{ id: string }> {
  if (!/^[a-f0-9]{64}$/.test(fileHash)) throw new BackupError('Invalid backup fingerprint.')
  const entry = backupEntry(value, false)
  const fingerprint = await digest(JSON.stringify([userId, fileHash, entry]))
  const id = restoredId(fingerprint)
  const existing = await env.GARDENS.get<Record<string, unknown>>(`g:${id}`, 'json')
  if (existing && (existing.ownerId !== userId || existing.restoreFingerprint !== fingerprint)) {
    throw new RestoreConflict('A restored identifier is already in use. No existing garden was changed.')
  }
  if (!existing) {
    const permit = await env.COUNTERS.get(env.COUNTERS.idFromName('backup-restores')).bump(
      'new-copies',
      200,
      86400,
    )
    if (!permit.ok)
      throw new RestoreConflict(
        'The daily restore limit has been reached. Keep the file and continue tomorrow.',
      )
    await env.GARDENS.put(
      `g:${id}`,
      JSON.stringify({ ...entry.garden, ownerId: userId, restoreFingerprint: fingerprint }),
    )
  }
  if ((await env.GARDENS.get(`water:${id}`)) === null)
    await env.GARDENS.put(`water:${id}`, JSON.stringify(entry.response))
  const summary: GardenSummary = {
    id,
    from: entry.garden.from,
    to: entry.garden.to ?? '',
    createdAt: entry.createdAt,
    swatches: entry.garden.flowers.map((f) => f.petalColors[0]),
    restored: true,
    ...(entry.garden.occasion !== undefined ? { occasion: entry.garden.occasion } : {}),
    ...(entry.garden.unlockAt !== undefined ? { unlockAt: entry.garden.unlockAt } : {}),
  }
  for (const library of entry.libraries) {
    const key = `${library === 'sent' ? 'sent' : 'recv'}:${userId}:${id}`
    if ((await env.GARDENS.get(key)) !== null) continue
    const record = {
      ...summary,
      ...(library === 'received' && entry.receivedAt ? { receivedAt: entry.receivedAt } : {}),
    }
    const body = JSON.stringify(record)
    await env.GARDENS.put(
      key,
      body,
      new TextEncoder().encode(body).length <= 1024 ? { metadata: record } : {},
    )
  }
  return { id }
}
