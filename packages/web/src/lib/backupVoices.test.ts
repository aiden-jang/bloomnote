import { afterEach, describe, expect, it, vi } from 'vitest'
import { sampleEntry } from '../../../../shared/backup.fixture'
import { MAX_VOICE_BYTES } from '../../../../shared/backup'
import { addDeviceMemories, restoreDeviceMemories } from './backupVoices'
import { loadVoiceForBackup, saveVoiceMemory } from './voiceMemory'
import { loadFlowerJournal, setEntryMeaning } from './flowerJournal'
vi.mock('./voiceMemory', () => ({ loadVoiceForBackup: vi.fn(), saveVoiceMemory: vi.fn() }))
vi.mock('./gardenList', () => ({ readPinnedGardens: () => [] }))
vi.mock('./water', () => ({
  hasWatered: () => false,
  rememberWatered: vi.fn(),
  rememberedFeeling: () => null,
  rememberFeeling: vi.fn(),
}))
afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})
const voiceOnly = () => {
  const entry = sampleEntry()
  entry.pinned = false
  entry.wateredByMe = false
  delete entry.myFeeling
  return entry
}
const signal = () => new AbortController().signal

describe('device audio backup integrity', () => {
  it('does not silently omit a voice when the device database is unreadable', async () => {
    vi.mocked(loadVoiceForBackup).mockRejectedValue(new Error('Storage unavailable'))
    await expect(addDeviceMemories([voiceOnly()], true, signal())).rejects.toThrow('Storage unavailable')
  })
  it('checks clip size before allocating its audio bytes', async () => {
    const arrayBuffer = vi.fn()
    vi.mocked(loadVoiceForBackup).mockResolvedValue({
      entryId: 'AbCdEf',
      blob: { size: MAX_VOICE_BYTES + 1, arrayBuffer } as unknown as Blob,
      seconds: 2,
      savedAt: '2026-10-11T12:00:00Z',
    })
    await expect(addDeviceMemories([voiceOnly()], true, signal())).rejects.toThrow('exceeds 2 MB')
    expect(arrayBuffer).not.toHaveBeenCalled()
  })
  it('reads only included garden voices and preserves exact bytes and MIME type', async () => {
    const entry = voiceOnly()
    const bytes = new Uint8Array([0, 1, 2, 3, 255])
    vi.mocked(loadVoiceForBackup).mockResolvedValue({
      entryId: entry.id,
      blob: new Blob([bytes], { type: 'audio/wav' }),
      seconds: 2,
      savedAt: entry.voice!.savedAt,
    })
    await addDeviceMemories([entry], true, signal())
    expect(entry.voice!.base64).toBe('AAECA/8=')
    expect(loadVoiceForBackup).toHaveBeenCalledExactlyOnceWith(entry.id)
  })
  it('preserves a newer recording on a retried copy', async () => {
    const entry = voiceOnly()
    vi.mocked(loadVoiceForBackup).mockResolvedValue({
      entryId: 'copy',
      blob: new Blob(['newer']),
      seconds: 1,
      savedAt: '2026-11-02T12:00:00Z',
    })
    await restoreDeviceMemories(entry, 'copy')
    expect(saveVoiceMemory).not.toHaveBeenCalled()
  })
  it('explains that a saved garden needs retry when audio cannot be committed', async () => {
    vi.mocked(loadVoiceForBackup).mockResolvedValue(null)
    vi.mocked(saveVoiceMemory).mockResolvedValue(false)
    await expect(restoreDeviceMemories(voiceOnly(), 'copy')).rejects.toThrow('garden copy is kept')
  })
  it('does not report pins restored when browser storage refuses the write', async () => {
    const entry = voiceOnly()
    delete entry.voice
    entry.pinned = true
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('Quota exceeded')
      },
    })
    await expect(restoreDeviceMemories(entry, 'copy')).rejects.toThrow('pins could not be saved')
  })
})

function journalStorage(initial: unknown[] = []) {
  const values = new Map([['bloomnote.flower-journal.v1', JSON.stringify(initial)]])
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
    dispatchEvent: vi.fn(),
  })
}

it('backs up the flower IDs that the journal actually records', async () => {
  const entry = voiceOnly()
  delete entry.voice
  journalStorage([
    {
      id: `${entry.id}:0`,
      gardenId: entry.id,
      flowerIndex: 0,
      flowerName: 'Dahlia',
      meaning: 'A little joy',
      colors: ['#d1477a'],
      memory: 'The rainy afternoon.',
      savedAt: '2026-11-02T12:00:00Z',
      shelves: ['remember'],
      mine: 'A fresh start.',
    },
  ])
  vi.mocked(loadVoiceForBackup).mockImplementation(async (id) =>
    id === `${entry.id}:0`
      ? {
          entryId: id,
          blob: new Blob(['voice'], { type: 'audio/wav' }),
          seconds: 2,
          savedAt: '2026-11-02T12:00:00Z',
        }
      : null,
  )
  await addDeviceMemories([entry], true, signal())
  expect(entry).toHaveProperty('journal', [
    expect.objectContaining({
      flowerIndex: 0,
      memory: 'The rainy afternoon.',
      mine: 'A fresh start.',
      shelves: ['remember'],
      voice: expect.objectContaining({ base64: btoa('voice') }),
    }),
  ])
})

it('restores the flower journal and audio under the copied garden without replacing newer memories', async () => {
  const entry = voiceOnly()
  delete entry.voice
  Object.assign(entry, {
    journal: [
      {
        flowerIndex: 0,
        memory: 'The rainy afternoon.',
        mine: 'A fresh start.',
        shelves: ['remember'],
        savedAt: '2026-11-02T12:00:00Z',
        voice: sampleEntry().voice,
      },
    ],
  })
  journalStorage()
  vi.mocked(loadVoiceForBackup).mockResolvedValue(null)
  vi.mocked(saveVoiceMemory).mockResolvedValue(true)
  await restoreDeviceMemories(entry, 'copy')
  expect(loadFlowerJournal()).toEqual([
    expect.objectContaining({
      id: 'copy:0',
      gardenId: 'copy',
      flowerIndex: 0,
      flowerName: 'Dahlia',
      memory: 'The rainy afternoon.',
      mine: 'A fresh start.',
      shelves: ['remember'],
    }),
  ])
  expect(saveVoiceMemory).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'copy:0' }))
  expect(setEntryMeaning('copy:0', 'My newer meaning.')).toBe(true)
  vi.mocked(saveVoiceMemory).mockClear()
  vi.mocked(loadVoiceForBackup).mockResolvedValue({
    entryId: 'copy:0',
    blob: new Blob(['newer']),
    seconds: 1,
    savedAt: '2026-11-03T12:00:00Z',
  })
  await restoreDeviceMemories(entry, 'copy')
  expect(loadFlowerJournal()[0]?.mine).toBe('My newer meaning.')
  expect(saveVoiceMemory).not.toHaveBeenCalled()
})

it('does not silently export an unreadable flower journal', async () => {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: () => {
        throw new Error('denied')
      },
    },
  })
  await expect(addDeviceMemories([voiceOnly()], false, signal())).rejects.toThrow('flower journal')
})

it('does not evict kept memories when a restored journal exceeds device capacity', async () => {
  const existing = Array.from({ length: 80 }, (_, i) => ({
    id: `kept-${i}`,
    gardenId: `garden${i}`,
    flowerIndex: 0,
    flowerName: 'Dahlia',
    meaning: 'Joy.',
    colors: ['#d1477a'],
    memory: 'Already kept.',
    savedAt: '2026-11-02T12:00:00Z',
  }))
  journalStorage(existing)
  const entry = voiceOnly()
  delete entry.voice
  Object.assign(entry, {
    journal: [{ flowerIndex: 0, memory: 'Imported.', savedAt: '2026-11-02T12:00:00Z' }],
  })
  await expect(restoreDeviceMemories(entry, 'copy')).rejects.toThrow('flower journal could not be saved')
  expect(loadFlowerJournal()).toHaveLength(80)
  expect(loadFlowerJournal().every((entry) => entry.memory === 'Already kept.')).toBe(true)
})
