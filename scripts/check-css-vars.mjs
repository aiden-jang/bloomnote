#!/usr/bin/env node
/*
 * Fails the build when a `var(--x)` names a custom property nothing declares.
 *
 * Three of these have now shipped and been found by accident, because the failure is silent by
 * construction. An undefined `var()` with a fallback quietly uses the fallback, so seven inline
 * styles wore an off-palette grey. Without a fallback it is worse and quieter: `color` inherits, so
 * four rules wore whatever colour they sat inside, and `fill` does not, so the wax seal on the
 * sealed screen rendered as a black dot nobody ever saw.
 *
 * A fallback does not make a reference legitimate. It is exactly what hid the first one, so a
 * reference is reported whether or not it passes a default.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'packages/web/src')

/*
 * Properties set by something this scan cannot see. Nothing here yet, and the aim is to keep it
 * that way — an entry is a promise that some runtime really does set it.
 */
const EXTERNAL = new Set([])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(css|ts|tsx)$/.test(full)) out.push(full)
  }
  return out
}

const declared = new Set(EXTERNAL)
const references = []

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8')
  const isStyleSheet = file.endsWith('.css')

  if (isStyleSheet) {
    // `--x:` opening a declaration, and `@property --x { }` which registers one.
    for (const m of source.matchAll(/(?:^|[;{}\s])(--[\w-]+)\s*:/g)) declared.add(m[1])
    for (const m of source.matchAll(/@property\s+(--[\w-]+)/g)) declared.add(m[1])
  } else {
    /*
     * In TS a custom property is declared by naming it as a style key or passing it to
     * setProperty, both of which are a string literal holding the name and nothing else. Matching
     * the whole literal is what keeps `'var(--chip-edge)'` a reference rather than a declaration.
     */
    for (const m of source.matchAll(/['"`](--[\w-]+)['"`]/g)) declared.add(m[1])
  }

  for (const m of source.matchAll(/var\(\s*(--[\w-]+)/g)) {
    references.push({
      name: m[1],
      file: relative(ROOT, file),
      line: source.slice(0, m.index).split('\n').length,
    })
  }
}

const undefinedRefs = references.filter(r => !declared.has(r.name))

if (undefinedRefs.length === 0) {
  const unique = new Set(references.map(r => r.name)).size
  console.log(`css-vars: ${references.length} references to ${unique} custom properties, all declared.`)
  process.exit(0)
}

const byName = new Map()
for (const ref of undefinedRefs) {
  if (!byName.has(ref.name)) byName.set(ref.name, [])
  byName.get(ref.name).push(ref)
}

console.error(`css-vars: ${byName.size} custom ${byName.size === 1 ? 'property is' : 'properties are'} referenced but never declared.\n`)
for (const [name, refs] of byName) {
  console.error(`  ${name}`)
  for (const ref of refs) console.error(`    ${ref.file}:${ref.line}`)
}
console.error('\nDeclare it (index.css holds the palette), or fix the name at the reference.')
process.exit(1)
