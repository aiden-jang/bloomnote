// Rasterize public/og.svg → public/og.png. Social platforms (iMessage, Slack, X, WhatsApp) don't
// render an SVG og:image, so the shipped share card must be a PNG. Output is committed; re-run
// with `npm run gen-og` after editing og.svg.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = resolve(ROOT, 'public/og.svg')

if (!existsSync(SRC)) {
  console.error(`No source SVG at ${SRC}`)
  process.exit(1)
}

const png = new Resvg(readFileSync(SRC, 'utf8'), {
  fitTo: { mode: 'width', value: 1200 },
  // Load system fonts so any text in the card resolves its sans-serif fallback.
  font: { loadSystemFonts: true, defaultFontFamily: 'sans-serif' },
})
  .render()
  .asPng()

writeFileSync(resolve(ROOT, 'public/og.png'), png)
console.log(`wrote og.png (${png.length.toLocaleString()} bytes)`)
