import { describe, expect, it } from 'vitest'
import { backupGarden, readBackup, MAX_VOICE_BYTES } from '../../../../shared/backup'
import { sampleBackup, sampleEntry } from '../../../../shared/backup.fixture'
import { readGardenBackup } from './gardenBackup'

describe('portable garden files', () => {
  it('round trips the full garden, reply, secret, responses and exact voice bytes', async () => {
    const source = sampleBackup()
    const { backup, fileHash } = await readGardenBackup(new File([JSON.stringify(source)], 'backup.json'))
    expect(backup).toEqual(source)
    expect([...Uint8Array.from(atob(backup.entries[0]!.voice!.base64), (c) => c.charCodeAt(0))]).toEqual([
      0, 1, 2, 3, 255,
    ])
    expect(fileHash).toMatch(/^[a-f0-9]{64}$/)
    expect((await readGardenBackup(new File([JSON.stringify(source)], 'again.json'))).fileHash).toBe(fileHash)
  })
  it('strips internal ownership and receipts from both garden levels', () => {
    const garden = sampleEntry().garden
    const content = backupGarden({
      ...garden,
      ownerId: 'private-account',
      restoreFingerprint: 'private-receipt',
      previous: { ...garden.previous, ownerId: 'someone-else' },
    })
    expect(content).toEqual(garden)
    expect(JSON.stringify(content)).not.toMatch(/ownerId|restoreFingerprint/)
  })
  it.each([
    ['future version', (b: ReturnType<typeof sampleBackup>) => ({ ...b, version: 2 })],
    [
      'duplicate IDs',
      (b: ReturnType<typeof sampleBackup>) => ({ ...b, entries: [...b.entries, ...b.entries] }),
    ],
    [
      'too many entries',
      (b: ReturnType<typeof sampleBackup>) => ({
        ...b,
        entries: Array.from({ length: 201 }, (_, i) => ({ ...b.entries[0], id: `test${i}` })),
      }),
    ],
    [
      'nested replies',
      (b: ReturnType<typeof sampleBackup>) => ({
        ...b,
        entries: [{ ...b.entries[0], garden: { ...b.entries[0]!.garden, previous: b.entries[0]!.garden } }],
      }),
    ],
    [
      'invalid geometry',
      (b: ReturnType<typeof sampleBackup>) => ({
        ...b,
        entries: [
          {
            ...b.entries[0],
            garden: {
              ...b.entries[0]!.garden,
              flowers: [{ ...b.entries[0]!.garden.flowers[0], petalCount: 500 }],
            },
          },
        ],
      }),
    ],
    ['inconsistent audio', (b: ReturnType<typeof sampleBackup>) => ({ ...b, deviceVoicesIncluded: false })],
    [
      'oversized audio',
      (b: ReturnType<typeof sampleBackup>) => ({
        ...b,
        entries: [
          {
            ...b.entries[0],
            voice: { ...b.entries[0]!.voice, base64: btoa('a'.repeat(MAX_VOICE_BYTES + 1)) },
          },
        ],
      }),
    ],
  ])('rejects %s before restoration', (_name, change) => {
    expect(() => readBackup(change(sampleBackup()))).toThrow()
  })
  it('keeps the original file when JSON cannot be read', async () => {
    await expect(readGardenBackup(new File(['{broken'], 'bad.json'))).rejects.toThrow(
      /Nothing has been changed/,
    )
  })
})
