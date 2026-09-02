import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

/*
 * Print what the browser actually downloads, so a dependency that doubles the bundle shows up in
 * the diff instead of six months later on someone's phone.
 *
 * Reports rather than fails. A budget invented today would be arbitrary, and a red build nobody
 * agreed to is a build people learn to ignore. Pick a ceiling once the numbers have settled.
 */
const dist = new URL('../packages/web/dist/', import.meta.url).pathname

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(path)))
    else out.push(path)
  }
  return out
}

const files = await walk(dist)
const rows = []
let rawTotal = 0
let gzipTotal = 0

for (const path of files) {
  if (!/\.(js|css)$/.test(path)) continue
  const raw = (await stat(path)).size
  const gzip = gzipSync(readFileSync(path)).length
  rawTotal += raw
  gzipTotal += gzip
  rows.push({ name: path.slice(dist.length), raw, gzip })
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`
rows.sort((a, b) => b.gzip - a.gzip)
for (const row of rows.slice(0, 10)) {
  console.log(`  ${kb(row.gzip).padStart(9)} gzip  ${kb(row.raw).padStart(9)} raw   ${row.name}`)
}
console.log(`\nJS + CSS total: ${kb(gzipTotal)} gzip, ${kb(rawTotal)} raw, across ${rows.length} files.`)
