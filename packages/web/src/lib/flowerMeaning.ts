/** Remove a stored leading flower name when the heading already says it. */
export function withoutLeadingFlowerName(name: string, meaning: string): string {
  const normalizedName = name.trim()
  if (!normalizedName || !meaning.toLowerCase().startsWith(normalizedName.toLowerCase())) return meaning
  const rest = meaning.slice(normalizedName.length).replace(/^\s*,\s*|^\s+/, '')
  if (!rest) return meaning
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}
