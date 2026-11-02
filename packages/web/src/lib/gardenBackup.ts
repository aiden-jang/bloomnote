import {
  backupEntry,
  backupGarden,
  backupResponse,
  readBackup,
  MAX_BACKUP_BYTES,
  MAX_BACKUP_GARDENS,
  type GardenBackup,
  type BackupEntry,
} from '../../../../shared/backup'
import { loadSentGardens } from './mine'
import { addDeviceMemories, restoreDeviceMemories } from './backupVoices'

type Progress = (message: string) => void
const request = async (path: string, signal: AbortSignal, init?: RequestInit): Promise<Response> => {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Could not finish the backup request. Try again.')
  }
  return response
}

export async function downloadGardenBackup(
  userId: string | null,
  voices: boolean,
  signal: AbortSignal,
  progress: Progress,
): Promise<GardenBackup> {
  const entries = new Map<string, BackupEntry>()
  if (userId) {
    let cursor: string | null = null
    const seen = new Set<string>()
    do {
      const response = await request(
        `/api/backup/export${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
        signal,
        { headers: { 'X-Bloomnote-Account': userId } },
      )
      const page = (await response.json()) as { entries?: unknown; next?: unknown }
      if (!Array.isArray(page.entries) || (page.next !== null && typeof page.next !== 'string'))
        throw new Error('A backup page could not be read. Nothing was downloaded.')
      for (const value of page.entries) {
        const entry = backupEntry(value, false),
          previous = entries.get(entry.id)
        if (previous) {
          previous.libraries = [...new Set([...previous.libraries, ...entry.libraries])]
          if (entry.receivedAt) previous.receivedAt = entry.receivedAt
        } else entries.set(entry.id, entry)
      }
      if (entries.size > MAX_BACKUP_GARDENS)
        throw new Error(
          `This library exceeds the ${MAX_BACKUP_GARDENS}-garden backup limit. Nothing was downloaded.`,
        )
      cursor = page.next as string | null
      if (cursor && seen.has(cursor))
        throw new Error('Backup pages stopped advancing. Nothing was downloaded; try again.')
      if (cursor) seen.add(cursor)
      progress(`Reading ${entries.size} gardens…`)
    } while (cursor)
  } else {
    for (const record of loadSentGardens(true)) {
      const gardenResponse = await request(`/api/garden?id=${encodeURIComponent(record.id)}`, signal)
      const data = (await gardenResponse.json()) as { garden: unknown }
      const response = await (await request(`/api/garden/${record.id}/response`, signal)).json()
      entries.set(record.id, {
        id: record.id,
        libraries: ['sent'],
        createdAt: record.createdAt,
        garden: backupGarden(data.garden),
        response: backupResponse(response),
        pinned: false,
      })
      progress(`Reading ${entries.size} gardens…`)
    }
  }
  const items = [...entries.values()]
  await addDeviceMemories(items, voices, signal)
  signal.throwIfAborted()
  return readBackup({
    format: 'bloomnote-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    source: userId ? 'account' : 'device',
    deviceVoicesIncluded: voices,
    entries: items,
  })
}

export async function readGardenBackup(file: File): Promise<{ backup: GardenBackup; fileHash: string }> {
  if (file.size > MAX_BACKUP_BYTES)
    throw new Error('This file exceeds the 32 MB backup limit. Keep the original file.')
  const text = await file.text()
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Choose a readable Bloomnote JSON backup. Nothing has been changed.')
  }
  const backup = readBackup(value)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  const fileHash = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('')
  return { backup, fileHash }
}

export async function restoreGardenBackup(
  userId: string,
  backup: GardenBackup,
  fileHash: string,
  signal: AbortSignal,
  progress: Progress,
): Promise<void> {
  const checked = readBackup(backup)
  let done = 0
  for (const entry of checked.entries) {
    signal.throwIfAborted()
    // Voice bytes stay on this device. Only the garden content and its response counts go to KV.
    const { voice: _voice, ...serverEntry } = entry
    const response = await request('/api/backup/restore', signal, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Bloomnote-Account': userId },
      body: JSON.stringify({ version: 1, fileHash, entry: serverEntry }),
    })
    const result = (await response.json()) as { id?: unknown }
    if (typeof result.id !== 'string' || !/^[A-Za-z0-9]{12}$/.test(result.id))
      throw new Error('A restored copy could not be confirmed. Retry the same file.')
    signal.throwIfAborted()
    await restoreDeviceMemories(entry, result.id)
    done += 1
    progress(`Kept ${done} of ${checked.entries.length} copies.`)
  }
}

export function saveGardenBackup(backup: GardenBackup): void {
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  if (blob.size > MAX_BACKUP_BYTES) throw new Error('The backup exceeds 32 MB. Nothing was downloaded.')
  const url = URL.createObjectURL(blob),
    link = document.createElement('a')
  link.href = url
  link.download = `bloomnote-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
