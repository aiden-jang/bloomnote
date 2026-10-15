/*
 * Ceilings on file length and component state, run by `pnpm verify`.
 *
 * Nothing else here notices a file growing, and a god-file is never added. It accretes twenty
 * lines at a time and no single diff looks wrong, which is how Composer reached 889 lines and 15
 * pieces of state despite an earlier cleanup having already pulled its draft and hero demo out.
 *
 * Lines are the proxy; the state count is the signal. Ratchet both down after a refactor rather
 * than leaving slack. Splitting the file is almost always the right answer to a failure here.
 */
import { globSync, readFileSync } from 'node:fs'

const MAX_LINES = 400
const MAX_STATE = 12

/*
 * Already over, and being decomposed. Listed at their own size rather than the ceiling being raised
 * for everyone, so nothing else can grow past it meanwhile.
 * An entry sitting above its file fails too, so nobody has to remember to shrink one.
 */
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
