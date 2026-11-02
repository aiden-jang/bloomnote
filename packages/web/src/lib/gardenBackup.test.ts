import { afterEach, describe, expect, it, vi } from 'vitest'
import { sampleBackup, sampleEntry } from '../../../../shared/backup.fixture'
import { downloadGardenBackup, restoreGardenBackup } from './gardenBackup'
import { addDeviceMemories, restoreDeviceMemories } from './backupVoices'
vi.mock('./backupVoices', () => ({ addDeviceMemories: vi.fn(), restoreDeviceMemories: vi.fn() }))
vi.mock('./mine', () => ({ loadSentGardens: () => [{ id: 'AbCdEf', createdAt: '2026-10-10T12:00:00Z' }] }))
const progress = vi.fn()
const signal = () => new AbortController().signal
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('backup requests', () => {
  it('reads all pages, merges shared classifications and sends an account expectation each time', async () => {
    const entry = sampleEntry()
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ entries: [{ ...entry, libraries: ['sent'] }], next: 'second' }))
      .mockResolvedValueOnce(Response.json({ entries: [{ ...entry, libraries: ['received'] }], next: null }))
    vi.stubGlobal('fetch', fetcher)
    const backup = await downloadGardenBackup('owner', true, signal(), progress)
    expect(backup.entries).toHaveLength(1)
    expect(backup.entries[0]!.libraries).toEqual(['sent', 'received'])
    expect(fetcher.mock.calls[1]![0]).toBe('/api/backup/export?cursor=second')
    for (const call of fetcher.mock.calls) expect(call[1].headers['X-Bloomnote-Account']).toBe('owner')
    expect(addDeviceMemories).toHaveBeenCalledWith(backup.entries, true, expect.any(AbortSignal))
  })
  it('does not return a partial file or fall back to device contents on account failure', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ entries: [sampleEntry()], next: 'second' }))
      .mockResolvedValueOnce(Response.json({ error: 'Sign-in could not be checked' }, { status: 503 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(downloadGardenBackup('owner', false, signal(), progress)).rejects.toThrow('Sign-in')
    expect(addDeviceMemories).not.toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('rejects a repeated cursor rather than repeatedly reading the same page', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() => Promise.resolve(Response.json({ entries: [sampleEntry()], next: 'same' }))),
    )
    await expect(downloadGardenBackup('owner', false, signal(), progress)).rejects.toThrow(
      'stopped advancing',
    )
  })
  it('downloads full device garden content and fails on unavailable reaction counts', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ garden: sampleEntry().garden }))
      .mockResolvedValueOnce(Response.json({ error: 'Counts unavailable' }, { status: 503 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(downloadGardenBackup(null, false, signal(), progress)).rejects.toThrow('Counts unavailable')
    expect(addDeviceMemories).not.toHaveBeenCalled()
  })
  it('validates every file entry before sending the first restore request', async () => {
    const backup = sampleBackup()
    backup.entries.push({ ...sampleEntry('XyZaBc'), garden: {} } as never)
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(restoreGardenBackup('owner', backup, 'a'.repeat(64), signal(), progress)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('keeps voices on the device and saves them only against the confirmed new copy', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 'abcdefABCDEF' }))
    vi.stubGlobal('fetch', fetcher)
    await restoreGardenBackup('owner', sampleBackup(), 'a'.repeat(64), signal(), progress)
    const request = fetcher.mock.calls[0]![1]
    expect(request.credentials).toBe('include')
    expect(request.headers['X-Bloomnote-Account']).toBe('owner')
    expect(JSON.parse(request.body).entry).not.toHaveProperty('voice')
    expect(restoreDeviceMemories).toHaveBeenCalledWith(sampleEntry(), 'abcdefABCDEF')
  })
  it('stops on an account change without writing further copies or device memories', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ error: 'Your account changed' }, { status: 409 }))
    vi.stubGlobal('fetch', fetcher)
    const backup = sampleBackup()
    backup.entries.push(sampleEntry('XyZaBc'))
    await expect(restoreGardenBackup('owner', backup, 'a'.repeat(64), signal(), progress)).rejects.toThrow(
      'account changed',
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(restoreDeviceMemories).not.toHaveBeenCalled()
  })
})
