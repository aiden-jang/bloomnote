/*
 * Mechanical checks on the docs, run by `pnpm verify`. Only claims a machine can settle: paths,
 * script names, routes, and symbols. Whether the prose is any good is a reading job.
 *
 * Prose rots with nothing to fail. A rename left the request diagram naming a function that had
 * been gone a phase, and the sentence still read fine.
 */
import { globSync, readFileSync } from 'node:fs'

const DOCS = ['README.md', 'ARCHITECTURE.md', 'DEPLOY.md', 'CLAUDE.md', 'AGENTS.md']

/* Absent on purpose, or somebody else's API. Never add a name the code actually lost. */
const NOT_OURS = new Set([
  'dangerouslySetInnerHTML', // the point of the sentence is that it appears nowhere
  'reducedMotion', // Playwright's config option
  'expirationTtl', // KV's option, deliberately unused
  'generateContent', // Gemini's endpoint
  'isolatedStorage', // a vitest-pool-workers option, named here because we rely on its default
  'runTests',
])

const code = [
  ...globSync('packages/*/src/**/*.{ts,tsx}'),
  ...globSync('packages/*/e2e/**/*.ts'),
  ...globSync('packages/*/test/**/*.ts'),
  // Not this file: its own header names the symbol that prompted it, which was enough to make
  // that symbol resolve and the check silently useless.
  ...globSync('scripts/*.mjs').filter((f) => !f.endsWith('check-docs.mjs')),
  ...globSync('packages/*/*.{toml,json}'),
  'package.json',
]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

const scripts = new Set(
  [...globSync('packages/*/package.json'), 'package.json'].flatMap((f) =>
    Object.keys(JSON.parse(readFileSync(f, 'utf8')).scripts ?? {}),
  ),
)

const files = new Set(
  globSync('{packages,scripts,.github}/**/*', { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => `${d.parentPath}/${d.name}`),
)

const problems = []
const has = (name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(code)

for (const doc of DOCS) {
  readFileSync(doc, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const at = `${doc}:${i + 1}`

      for (const [, path] of line
        .matchAll(/[\w./@-]*\w+\.(?:ts|tsx|css|mjs|toml|yml)\b/g)
        .map((m) => [0, m[0]])) {
        const bare = path.replace(/^`|`$/g, '')
        if (![...files].some((f) => f.endsWith(bare) || f.endsWith(`/${bare.split('/').pop()}`))) {
          problems.push(`${at}: no such file \`${bare}\``)
        }
      }

      for (const m of line.matchAll(/pnpm (?:run |-r )?([a-z][\w:-]*)/g)) {
        const name = m[1]
        if (['install', 'exec', 'audit', 'why', 'dlx', 'add', 'create', 'run'].includes(name)) continue
        if (!scripts.has(name)) problems.push(`${at}: \`pnpm ${name}\` is not a script`)
      }

      // Anchored per prefix, or `/g` also swallows `/gardens.ts` and `/api` swallows `/apikey`.
      for (const m of line.matchAll(
        /(\/api\/[\w:-]+(?:\/[\w:-]+)*|\/og\/[\w:-]+|\/g\/[\w:-]+|\/health)\b/g,
      )) {
        const base = m[1]
        if (!code.includes(`'${base}'`) && !code.includes(base)) {
          problems.push(`${at}: no route \`${base}\``)
        }
      }

      // Bare, not just `name()`: the rename that prompted this gate sat in a diagram with no
      // parentheses and no backticks. camelCase in English prose is almost always a symbol.
      for (const m of line.matchAll(/(?<!\\)\b([a-z][a-z0-9]*(?:[A-Z][A-Za-z0-9]*)+)\b/g)) {
        const name = m[1]
        if (NOT_OURS.has(name) || !has(name)) {
          if (!NOT_OURS.has(name)) problems.push(`${at}: nothing named \`${name}\` in the code`)
        }
      }
    })
}

if (problems.length > 0) {
  console.error('docs check failed:\n')
  for (const p of [...new Set(problems)]) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

console.log(`docs ok: paths, scripts, routes and names in ${DOCS.length} files all resolve`)
