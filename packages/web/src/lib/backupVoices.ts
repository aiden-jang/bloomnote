import { backupVoice, MAX_VOICE_BYTES, type BackupVoice, type BackupEntry } from '../../../../shared/backup'
import { loadVoiceForBackup, saveVoiceMemory } from './voiceMemory'
import { hasWatered, rememberWatered, rememberedFeeling, rememberFeeling } from './water'
import { readPinnedGardens } from './gardenList'
import { loadFlowerJournal, mergeFlowerJournalEntries } from './flowerJournal'

async function encodeVoice(id: string): Promise<BackupVoice | null> {
  const voice = await loadVoiceForBackup(id)
  if (!voice) return null
  if (voice.blob.size > MAX_VOICE_BYTES)
    throw new Error(
      'A voice memory exceeds 2 MB. Download without device voices, or keep the original recording separately.',
    )
  const bytes = new Uint8Array(await voice.blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return backupVoice({
    type: voice.blob.type,
    base64: btoa(binary),
    seconds: voice.seconds,
    savedAt: voice.savedAt,
  })
}

async function restoreVoice(voice: BackupVoice | undefined, id: string): Promise<void> {
  if (!voice || (await loadVoiceForBackup(id))) return
  const bytes = Uint8Array.from(atob(voice.base64), (c) => c.charCodeAt(0))
  if (
    !(await saveVoiceMemory({
      entryId: id,
      blob: new Blob([bytes], { type: voice.type }),
      seconds: voice.seconds,
      savedAt: voice.savedAt,
    }))
  )
    throw new Error(
      'The garden copy is kept, but this browser could not save its voice memory. Allow site storage and retry the same file.',
    )
}

export async function addDeviceMemories(
  entries: BackupEntry[],
  includeVoices: boolean,
  signal: AbortSignal,
): Promise<void> {
  const pins = new Set(readPinnedGardens())
  const journal = loadFlowerJournal(true)
  for (const entry of entries) {
    signal.throwIfAborted()
    entry.pinned = pins.has(entry.id)
    entry.wateredByMe = hasWatered(entry.id)
    const feeling = rememberedFeeling(entry.id)
    if (feeling) entry.myFeeling = feeling
    const flowers = journal.filter((memory) => memory.gardenId === entry.id)
    if (flowers.length) {
      entry.journal = flowers.map(({ flowerIndex, memory, savedAt, mine, shelves }) => ({
        flowerIndex,
        memory,
        savedAt,
        ...(mine !== undefined ? { mine } : {}),
        ...(shelves ? { shelves } : {}),
      }))
    }
    if (!includeVoices) continue
    const voice = await encodeVoice(entry.id)
    if (voice) entry.voice = voice
    for (const memory of entry.journal ?? []) {
      signal.throwIfAborted()
      const voice = await encodeVoice(`${entry.id}:${memory.flowerIndex}`)
      if (voice) memory.voice = voice
    }
  }
}

export async function restoreDeviceMemories(entry: BackupEntry, id: string): Promise<void> {
  await restoreVoice(entry.voice, id)
  for (const memory of entry.journal ?? []) await restoreVoice(memory.voice, `${id}:${memory.flowerIndex}`)
  if (
    entry.journal?.length &&
    !mergeFlowerJournalEntries(
      entry.journal.map(({ voice: _voice, ...memory }) => {
        const flower = entry.garden.flowers[memory.flowerIndex]!
        return {
          ...memory,
          id: `${id}:${memory.flowerIndex}`,
          gardenId: id,
          flowerName: flower.name,
          meaning: flower.meaning,
          colors: flower.petalColors,
          from: entry.garden.from,
        }
      }),
    )
  )
    throw new Error(
      'The garden copy is kept, but its flower journal could not be saved. Allow site storage or free journal space, then retry the same file.',
    )
  if (entry.pinned) {
    const pins = [...new Set([...readPinnedGardens(), id])]
    try {
      localStorage.setItem('bloomnote:pinned-gardens', JSON.stringify(pins))
    } catch {
      throw new Error(
        'The copies are kept, but pins could not be saved on this device. Allow site storage and retry.',
      )
    }
    if (!readPinnedGardens().includes(id))
      throw new Error(
        'The copies are kept, but pins could not be saved on this device. Allow site storage and retry.',
      )
  }
  if (entry.wateredByMe && !hasWatered(id)) {
    rememberWatered(id)
    if (!hasWatered(id))
      throw new Error(
        'The copy is kept, but its watering choice could not be saved. Allow site storage and retry.',
      )
  }
  if (entry.myFeeling && !rememberedFeeling(id)) {
    rememberFeeling(id, entry.myFeeling)
    if (rememberedFeeling(id) !== entry.myFeeling)
      throw new Error('The copy is kept, but its feeling could not be saved. Allow site storage and retry.')
  }
}
