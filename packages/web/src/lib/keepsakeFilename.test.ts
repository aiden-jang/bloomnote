import { expect, test } from 'vitest'
import { keepsakeFilename } from './keepsakeFilename'

test('keeps names readable, normalizes accents and distinguishes downloads without unsafe path characters', () => {
  const at = new Date('2026-10-15T23:04:05.123Z')
  expect(keepsakeFilename('수진 / Jose\u0301', 'png', at)).toBe(
    'bloomnote-수진-josé-2026-10-15T23-04-05-123Z.png',
  )
  expect(keepsakeFilename('🌷', 'ics', at)).toBe('bloomnote-garden-2026-10-15T23-04-05-123Z.ics')
  expect(keepsakeFilename('Sam', 'png', new Date(at.getTime() + 1))).not.toBe(
    keepsakeFilename('Sam', 'png', at),
  )
  expect(keepsakeFilename('a'.repeat(200), 'png', at).length).toBeLessThan(120)
})
