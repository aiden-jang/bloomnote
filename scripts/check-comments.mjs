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
// The gates' own source counts too, on its own budget.
const SCRIPTS_BUDGET = 96
const DUP_MIN_CHARS = 45

/**
 * Comment spans in one file.
 *
 * `//` is skipped when the character before it is `:`, or the whole of `http://…` inside a string
 * reads as a comment. That false positive is why the first version of this scan reported an SVG
 * xmlns as a duplicated comment.
 */
function comments(source, isCss) {
  // Strings are blanked first: the source is full of things that look like comment openers, and a
  // route path or glob containing `/*` opens a block comment that swallows the code after it.
  const masked = source.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, (m) =>
    ' '.repeat(m.length),
  )
  const out = []
  const re = isCss ? /\/\*[\s\S]*?\*\//g : /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
  for (const m of masked.matchAll(re)) {
    const text = source.slice(m.index, m.index + m[0].length)
    out.push({ text, lines: text.split('\n').length })
  }
  return out
}

// scripts/ included: the checks were not checking themselves, and a budget comment is exactly the
// place a changelog quietly accumulates.
const files = [...globSync('packages/*/{src,test,e2e}/**/*.{ts,tsx,css}'), ...globSync('scripts/*.mjs')]
const isSrc = (f) => f.includes('/src/') && !/\.test\.tsx?$/.test(f)

let srcLines = 0
let scriptLines = 0
const seen = new Map()

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  for (const c of comments(source, file.endsWith('.css'))) {
    if (isSrc(file)) srcLines += c.lines
    else if (file.startsWith('scripts/')) scriptLines += c.lines
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

if (scriptLines > SCRIPTS_BUDGET) {
  problems.push(`scripts carry ${scriptLines} comment lines, over the ${SCRIPTS_BUDGET} budget.`)
}

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

console.log(
  `comments ok: ${srcLines}/${SRC_BUDGET} in src, ${scriptLines}/${SCRIPTS_BUDGET} in scripts, ` +
    `no new duplicates`,
)
