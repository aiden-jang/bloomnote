export function keepsakeFilename(label: string, extension: 'png' | 'ics', at = new Date()): string {
  const clean = label
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  const name = Array.from(clean).slice(0, 64).join('') || 'garden'
  const stamp = at.toISOString().replace(/[:.]/g, '-')
  return `bloomnote-${name}-${stamp}.${extension}`
}
