const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export function graphemes(value: string): string[] {
  return Array.from(segmenter.segment(value), ({ segment }) => segment)
}

export function clipText(value: string, max: number): string {
  if (value.length <= max) return value
  let clipped = ''
  for (const part of graphemes(value)) {
    if (clipped.length + part.length >= max) break
    clipped += part
  }
  return `${clipped}…`
}
