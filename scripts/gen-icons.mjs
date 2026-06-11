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

// Each entry: [output filename, pixel size]. Add new sizes here when
// a new surface needs one (e.g. 'icon-32.png' for browser-tab favicon
// fallback on legacy Edge).
const TARGETS = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]

for (const [name, size] of TARGETS) {
  // fitTo: width tells resvg to render at exactly `size` pixels wide.
  // Since our SVG has a square viewBox (32×32) and we want square
  // outputs, that's all we need to pin the aspect ratio.
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  const png = resvg.render().asPng()
  const outPath = resolve(ROOT, 'public', name)
  writeFileSync(outPath, png)
  console.log(`wrote ${name} (${size}×${size}, ${png.length.toLocaleString()} bytes)`)
}
