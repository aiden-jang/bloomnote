/** Remove a stored leading flower name when the heading already says it. */
export function withoutLeadingFlowerName(name: string, meaning: string): string {
  const normalizedName = name.trim()
  if (!normalizedName || !meaning.toLowerCase().startsWith(normalizedName.toLowerCase())) return meaning
  // Only a comma proves the name stood alone, so "Roses" and "Lily of the valley" stay whole.
  const after = meaning.slice(normalizedName.length)
  const separator = /^\s*,\s*/.exec(after)
  if (!separator) return meaning
  const rest = after.slice(separator[0].length)
  if (!rest) return meaning
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}
