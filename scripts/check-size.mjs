// Enforce module and local-state budgets; existing exceptions may only shrink.
import { globSync, readFileSync } from 'node:fs'

const MAX_LINES = 400
const MAX_STATE = 12

// Existing exceptions are pinned and must shrink with their files.
const ALREADY_OVER = {}

const files = globSync('packages/*/src/**/*.{ts,tsx}').filter((f) => !/\.test\.tsx?$/.test(f))
const problems = []
let widest = { lines: 0 }
let busiest = { state: 0 }

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n').length
  // useState in a component, not every hook: a count of these is how much one file is keeping track of.
  const state = (source.match(/\buseState[(<]/g) ?? []).length

  if (lines > widest.lines) widest = { file, lines }
  if (state > busiest.state) busiest = { file, state }

  const allowed = ALREADY_OVER[file] ?? { lines: MAX_LINES, state: MAX_STATE }

  if (ALREADY_OVER[file]) {
    if (lines <= MAX_LINES && state <= MAX_STATE) {
      problems.push(`${file} is under the ceiling now: drop it from ALREADY_OVER`)
    } else {
      if (allowed.lines !== undefined && lines < allowed.lines) {
        problems.push(`${file} is down to ${lines} lines: lower its ALREADY_OVER entry from ${allowed.lines}`)
      }
      if (allowed.state !== undefined && state < allowed.state) {
        problems.push(`${file} is down to ${state} state: lower its ALREADY_OVER entry from ${allowed.state}`)
      }
    }
  }

  if (lines > allowed.lines) {
    problems.push(`${file} is ${lines} lines, over ${allowed.lines}. Split it rather than raising this.`)
  }
  if (state > allowed.state) {
    problems.push(
      `${file} holds ${state} pieces of state, over ${allowed.state}. Extract a component or a hook.`,
    )
  }
}

if (problems.length > 0) {
  console.error('size check failed:\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

const exempt = Object.keys(ALREADY_OVER).length
console.log(
  `size ok: ceiling ${MAX_LINES} lines / ${MAX_STATE} state` +
    (exempt > 0 ? `, with ${exempt} file(s) still being decomposed` : ''),
)
