// Rasterize public/favicon.svg → PNGs needed by iOS, Android, and
// social platforms that don't accept SVG.
//
// Why this exists: iOS Safari ignores SVG favicons for system surfaces
// (the share sheet, "Add to Home Screen", the app switcher). Without
// a real PNG, those surfaces show a generic Safari snapshot of your
// site — not your brand mark. Same story for older Android, some
// chat-app previewers, and the Open Graph fallback on platforms that
// strip SVG.
//
// Output sizes:
//   180×180  → apple-touch-icon.png  (iOS Safari, the share sheet)
//   192×192  → icon-192.png          (PWA manifest, Android)
//   512×512  → icon-512.png          (PWA manifest splash)
//
// Run with: `npm run gen-icons`. The output PNGs are committed; this
// script regenerates them when the SVG source changes.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = resolve(ROOT, 'public/favicon.svg')

if (!existsSync(SRC)) {
  console.error(`No source SVG at ${SRC}`)
  process.exit(1)
}

const svg = readFileSync(SRC, 'utf8')

const fullBleed = svg.replace('rx="120"', 'rx="0"')
const TARGETS = [
  ['icon-32.png', 32, svg],
  ['apple-touch-icon.png', 180, fullBleed],
  ['icon-192.png', 192, svg],
  ['icon-512.png', 512, fullBleed],
]

for (const [name, size, source] of TARGETS) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(resolve(ROOT, 'public', name), png)
  console.log(`wrote ${name} (${size}×${size}, ${png.length.toLocaleString()} bytes)`)
}
