import { afterEach, describe, expect, it, vi } from 'vitest'
import { sampleEntry } from '../../../../shared/backup.fixture'
import { MAX_VOICE_BYTES } from '../../../../shared/backup'
import { addDeviceMemories, restoreDeviceMemories } from './backupVoices'
import { loadVoiceForBackup, saveVoiceMemory } from './voiceMemory'
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
