/*
 * Two mechanical checks on comments, run by `pnpm verify`.
 *
 * A budget, because a cleanup pass is a moment and drift is permanent. And a duplicate check,
 * because the same fact copied into four files is the failure this repo actually had: each copy
 * reads as reasonable on its own, and only a whole-repo view shows it.
 */
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

/*
 * Raise this only when a phase adds a module, never to fit prose into it.
 *
 * 700 was set when src stood at 666. Phase 5 added route.ts and lazyWithReload.ts, whose comments
 * are a deploy-time trap, a magic number's justification and two silent-failure notes, so the
 * growth is substance. If this number has to move to accommodate an explanation you are rewriting
 * rather than a module you are adding, trim the explanation instead.
 *
 * 730 -> 760: phase 7 added imageCards.tsx (528 lines) and phase 8 added two hooks and a shared
 * component. The trim came first and reclaimed 12 lines; the rest is new modules, not new prose.
 */
const SRC_BUDGET = 760
const DUP_MIN_CHARS = 45

/**
 * Comment spans in one file.
 *
 * `//` is skipped when the character before it is `:`, or the whole of `http://…` inside a string
 * reads as a comment. That false positive is why the first version of this scan reported an SVG
 * xmlns as a duplicated comment.
 */
function comments(source, isCss) {
  const out = []
  const re = isCss ? /\/\*[\s\S]*?\*\//g : /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
  for (const m of source.matchAll(re)) {
    if (m[0].startsWith('//') && source[m.index - 1] === ':') continue
    out.push({ text: m[0], lines: m[0].split('\n').length })
  }
  return out
}

const files = globSync('packages/*/{src,test,e2e}/**/*.{ts,tsx,css}')
const isSrc = (f) => f.includes('/src/') && !/\.test\.tsx?$/.test(f)

let srcLines = 0
const seen = new Map()

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  for (const c of comments(source, file.endsWith('.css'))) {
    if (isSrc(file)) srcLines += c.lines
    const flat = c.text.replace(/\s+/g, ' ').trim()
    if (flat.length < DUP_MIN_CHARS) continue
    // Directives are meant to repeat: two files suppressing the same rule is not duplication.
    if (/^(\/\/|\/\*)\s*(eslint-|prettier-|@ts-|c8 |v8 )/.test(flat)) continue
    const where = seen.get(flat) ?? []
    if (!where.includes(file)) where.push(file)
    seen.set(flat, where)
  }
}

const problems = []

if (srcLines > SRC_BUDGET) {
  problems.push(`src carries ${srcLines} comment lines, over the ${SRC_BUDGET} budget.`)
}

for (const [text, where] of seen) {
  if (where.length < 2) continue
  problems.push(
    `the same comment is in ${where.length} files: "${text.slice(0, 70)}…"\n    ${where.join('\n    ')}`,
  )
}

if (problems.length > 0) {
  console.error('comment check failed:\n')
  for (const p of problems) console.error(`  ${p}\n`)
  process.exit(1)
}

console.log(`comments ok: ${srcLines}/${SRC_BUDGET} lines in src, no new duplicates`)
