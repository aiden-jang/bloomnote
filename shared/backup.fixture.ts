import type { BackupEntry, GardenBackup } from './backup'

// Synthetic content shared by API, file validation and browser restore checks.
export function sampleEntry(id = 'AbCdEf'): BackupEntry {
  const garden = {
    flowers: [
      {
        name: 'Dahlia',
        meaning: 'A little joy',
        petalColors: ['#d1477a', '#e06b96', '#ef9ab8'] as [string, string, string],
        centerColor: '#f7e3a1',
        stemColor: '#5f8a52',
        petalShape: 'star' as const,
        petalCount: 12,
        stemHeight: 104,
      },
    ],
    bouquetNote: 'A note to keep',
    message: 'Thanks for being here',
    from: 'Alex',
    to: 'Sam',
    secret: 'A private memory',
    createdAt: '2026-10-10T12:00:00Z',
    occasion: 'just because',
    mood: 'warm',
  }
  return {
    id,
    libraries: ['sent', 'received'],
    createdAt: garden.createdAt,
    receivedAt: '2026-10-11T12:00:00Z',
    garden: { ...garden, previous: { ...garden, message: 'The first note', secret: 'The first secret' } },
    response: { waters: 4, feelings: { love: 2, joy: 1 } },
    pinned: true,
    wateredByMe: true,
    myFeeling: 'joy',
    voice: { type: 'audio/wav', base64: 'AAECA/8=', seconds: 2, savedAt: '2026-10-11T12:00:00Z' },
  }
}
export function sampleBackup(): GardenBackup {
  return {
    format: 'bloomnote-backup',
    version: 1,
    exportedAt: '2026-11-02T12:00:00Z',
    source: 'account',
    deviceVoicesIncluded: true,
    entries: [sampleEntry()],
  }
}
