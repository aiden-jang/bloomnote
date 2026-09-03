/*
 * Ceilings on file length and component state, run by `pnpm verify`.
 *
 * Nothing else here notices a file growing, and a god-file is never added -- it accretes twenty
 * lines at a time and no single diff looks wrong. Composer reached 889 lines holding 16 pieces of
 * state *after* a cleanup had already extracted its draft, hero demo and validation.
 *
 * Lines are the proxy; the state count is the signal. Ratchet both down after a refactor rather
 * than leaving slack. Splitting the file is almost always the right answer to a failure here.
 */
import { globSync, readFileSync } from 'node:fs'

const MAX_LINES = 600
const MAX_STATE = 12

/*
 * Two files are already over and are being decomposed. They are listed at their current size rather
 * than the ceiling being raised for everyone, so nothing else can grow past 600 in the meantime.
 * Shrink an entry when the file shrinks; delete it when the file is under the ceiling.
 */
const ALREADY_OVER = {
  'packages/web/src/components/Composer.tsx': { lines: 890, state: 15 },
  'packages/web/src/components/MyGardens.tsx': { lines: 771, state: 12 },
}

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
