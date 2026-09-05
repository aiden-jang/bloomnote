/*
 * Three mechanical checks on comments, run by `pnpm verify`.
 *
 * A budget, because a cleanup pass is a moment and drift is permanent. A duplicate check, because
 * the same fact copied into four files is the failure this repo actually had: each copy reads as
 * reasonable on its own, and only a whole-repo view shows it. And a stranded check, because moving
 * code leaves its comment behind describing something that is no longer underneath it.
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
/*
 * A share here too, at a higher rate than src because a gate's header is mostly the reason it
 * exists. It was a count, and a count charges every new gate for its own header: adding the
 * stranded check put it one line over and the fix would have been to move the number.
 */
const SCRIPTS_CEILING = 0.25
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
let scriptTotal = 0
const seen = new Map()
const stranded = []

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const nonBlank = source.split('\n').filter((l) => l.trim() !== '').length
  if (isSrc(file)) srcTotal += nonBlank
  else if (file.startsWith('scripts/')) scriptTotal += nonBlank
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

  const lines = source.split('\n')
  let afterDeclaration = false
  for (let i = 1; i < lines.length - 2; i++) {
    if (/^\}\)?;?$/.test(lines[i])) afterDeclaration = true
    /*
     * A doc block with nothing under it but a closing brace. `/**` exists to describe the next
     * declaration, so one describing a brace documents a prop or a field that has been removed.
     * Ungated: the first interface in a file is where this happens.
     */
    if (/\*\/\s*$/.test(lines[i])) {
      let open = i
      while (open >= 0 && !lines[open].includes('/*')) open--
      const under = lines.slice(i + 1).find((l) => l.trim()) ?? ''
      if (open >= 0 && lines[open].includes('/**') && /^[)}\]]/.test(under.trim())) {
        const quoted = (open === i ? lines[open] : lines[open + 1]) ?? ''
        stranded.push(
          `${file}:${open + 1} — a doc block with nothing under it: "${quoted.trim().slice(0, 56)}…"`,
        )
      }
    }
    if (!afterDeclaration) continue
    /*
     * A comment, then a blank line, then a declaration. A file header sits above the first one of
     * those and is fine; a paragraph floating above an export further down is one whose subject
     * moved without it. Keep a comment on the line above what it describes and this never fires.
     */
    const ends = /^\s*(\/\/|\*\/)/.test(lines[i])
    const next = lines.slice(i + 2, i + 4).find((l) => l.trim()) ?? ''
    if (ends && lines[i + 1].trim() === '' && /^(export |const |function )/.test(next.trim())) {
      stranded.push(
        `${file}:${i + 1} — "${lines[i].trim().slice(0, 56)}…" then a gap, then ${next.trim().slice(0, 36)}`,
      )
    }
  }
}

const density = srcTotal === 0 ? 0 : srcLines / srcTotal
const problems = []

const scriptsAllowed = Math.floor(scriptTotal * SCRIPTS_CEILING)
if (scriptLines > scriptsAllowed) {
  problems.push(
    `scripts are ${((scriptLines / scriptTotal) * 100).toFixed(1)}% comments, over the ` +
      `${(SCRIPTS_CEILING * 100).toFixed(0)}% ceiling (${scriptLines} lines, ${scriptsAllowed} allowed).`,
  )
}

const srcCeiling = Math.floor(srcTotal * MAX_SRC_DENSITY)
if (srcLines > srcCeiling) {
  problems.push(
    `src is ${(density * 100).toFixed(2)}% comments, over the ${(MAX_SRC_DENSITY * 100).toFixed(0)}% ceiling ` +
      `(${srcLines} lines, ${srcCeiling} allowed at ${srcTotal} lines of source).`,
  )
}

for (const s of stranded) problems.push(`a comment left behind by a move: ${s}`)

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
    `(${srcLines}/${srcCeiling}), scripts ${((scriptLines / scriptTotal) * 100).toFixed(1)}%, ` +
    `no new duplicates, none stranded`,
)
