/*
 * Find `styles.foo` where the CSS module has no `.foo`.
 *
 * The gap no other check covers: TypeScript does not read CSS modules (they are typed as a loose
 * record), eslint does not read CSS, and `styles.typo` is `undefined`, which React puts in the DOM
 * as no class at all. The element renders, unstyled, and nothing anywhere errors. It is the same
 * silent-failure shape as `var(--undeclared)`, which is why check-css-vars.mjs exists.
 *
 * Only the referenced-but-undefined direction is checked. Reporting classes the CSS defines but
 * nothing uses needs to understand `styles[`ghostSproutGrowing${growth}`]` and the tier class
 * composerHelpers builds by hand; a scan that does not produces about fifty false positives, which
 * is worse than no check.
 */
import { readFileSync, globSync } from 'node:fs'
import { basename } from 'node:path'

/** Class names a module stylesheet defines, including those only reached through composition. */
function definedClasses(cssPath) {
  const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  return new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]))
}

const problems = []

for (const cssPath of globSync('packages/web/src/**/*.module.css')) {
  const defined = definedClasses(cssPath)
  const moduleName = basename(cssPath)

  /* Every file importing this module, since a module is often read by more than its sibling. */
  for (const src of globSync('packages/web/src/**/*.{ts,tsx}')) {
    const code = readFileSync(src, 'utf8')
    const imported = new RegExp(`import\\s+(\\w+)\\s+from\\s+'[^']*${moduleName.replace('.', '\\.')}'`).exec(
      code,
    )
    if (!imported) continue
    const alias = imported[1]

    for (const m of code.matchAll(new RegExp(`\\b${alias}\\.(\\w+)\\b`, 'g'))) {
      if (!defined.has(m[1])) {
        const line = code.slice(0, m.index).split('\n').length
        problems.push(`${src}:${line}  ${alias}.${m[1]} is not defined in ${moduleName}`)
      }
    }
    for (const m of code.matchAll(new RegExp(`\\b${alias}\\['([^']+)'\\]`, 'g'))) {
      if (!defined.has(m[1])) {
        const line = code.slice(0, m.index).split('\n').length
        problems.push(`${src}:${line}  ${alias}['${m[1]}'] is not defined in ${moduleName}`)
      }
    }
  }
}

if (problems.length > 0) {
  console.error('css class check failed:\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error('')
  process.exit(1)
}

console.log('css classes ok: every styles.x reference resolves')
