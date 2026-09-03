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
 * A share of the code, not a line count. An absolute budget charged new modules for their own
 * headers, so it blocked a deploy-time trap and a silent-failure note the same way it blocks
 * padding, and a real doc comment was deleted to fit a bug explanation underneath it.
 *
 * A share still bites on what this repo actually got wrong, which was prose added to code that
 * already existed: 150 comment lines with no new code puts src over 6%.
 */
const MAX_SRC_DENSITY = 0.06
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
let srcTotal = 0
let scriptLines = 0
const seen = new Map()

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  if (isSrc(file)) srcTotal += source.split('\n').filter((l) => l.trim() !== '').length
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

const density = srcTotal === 0 ? 0 : srcLines / srcTotal
const problems = []

if (scriptLines > SCRIPTS_BUDGET) {
  problems.push(`scripts carry ${scriptLines} comment lines, over the ${SCRIPTS_BUDGET} budget.`)
}

const srcCeiling = Math.floor(srcTotal * MAX_SRC_DENSITY)
if (srcLines > srcCeiling) {
  problems.push(
    `src is ${(density * 100).toFixed(2)}% comments, over the ${(MAX_SRC_DENSITY * 100).toFixed(0)}% ceiling ` +
      `(${srcLines} lines, ${srcCeiling} allowed at ${srcTotal} lines of source).`,
  )
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
  `comments ok: src ${(density * 100).toFixed(2)}% of ${srcTotal} lines ` +
    `(${srcLines}/${srcCeiling}), scripts ${scriptLines}/${SCRIPTS_BUDGET}, no new duplicates`,
)
