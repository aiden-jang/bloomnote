/*
 * The four pictures a garden can become: the square keepsake, a single pressed flower, the two-sided
 * reply, and the 1200x630 card a link preview shows.
 *
 * Self-contained SVG with no external assets, or the canvas that rasterizes them is tainted and the
 * export fails. Split from the saving and rasterizing side so a layout change cannot disturb the
 * user-gesture timing that navigator.share depends on.
 */
import type { FlowerSpec, GardenData } from '../garden'
import { drawableFlower } from '../garden'
import FlowerSVG from '../components/FlowerSVG'

function SoilDefs() {
  return (
    <>
      <linearGradient id="bnSoil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8b5e3c" />
        <stop offset="62%" stopColor="#7a5133" />
        <stop offset="100%" stopColor="#6d4729" />
      </linearGradient>
      <linearGradient id="bnSoilTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#b0805c" />
        <stop offset="100%" stopColor="#a0714f" />
      </linearGradient>
      {/* Co-prime tiles, or the specks settle into a visible lattice. */}
      <pattern id="bnGrainA" width="47" height="31" patternUnits="userSpaceOnUse">
        <circle cx="9" cy="12" r="3" fill="#3a2212" opacity="0.13" />
      </pattern>
      <pattern id="bnGrainB" width="61" height="43" patternUnits="userSpaceOnUse">
        <circle cx="34" cy="27" r="2.4" fill="#3a2212" opacity="0.1" />
      </pattern>
      <pattern id="bnGrainC" width="37" height="53" patternUnits="userSpaceOnUse">
        <circle cx="21" cy="8" r="2.2" fill="#ffe2c4" opacity="0.15" />
      </pattern>
    </>
  )
}

/* Fixed control points, not random: the same garden has to export the same picture every time. */
export function soilPaths(x: number, w: number, surfaceY: number, bottomY: number) {
  const seg = w / 4
  const edge =
    `M ${x} ${surfaceY + 7} ` +
    `C ${x + seg * 0.6} ${surfaceY - 5}, ${x + seg * 1.4} ${surfaceY + 13}, ${x + seg * 2} ${surfaceY + 3} ` +
    `C ${x + seg * 2.6} ${surfaceY - 4}, ${x + seg * 3.4} ${surfaceY + 12}, ${x + w} ${surfaceY + 5}`
  return { edge, body: `${edge} L ${x + w} ${bottomY} L ${x} ${bottomY} Z` }
}

function Soil({ x, w, surfaceY, bottomY }: { x: number; w: number; surfaceY: number; bottomY: number }) {
  const { edge, body } = soilPaths(x, w, surfaceY, bottomY)
  return (
    <>
      <path d={body} fill="url(#bnSoil)" />
      <path d={body} fill="url(#bnGrainA)" />
      <path d={body} fill="url(#bnGrainB)" />
      <path d={body} fill="url(#bnGrainC)" />
      <path d={edge} fill="none" stroke="url(#bnSoilTop)" strokeWidth="17" />
    </>
  )
}

export const W = 1080
export const H = 1080

export interface GardenImageOpts {
  flowers: FlowerSpec[]
  from?: string | undefined
  to?: string | undefined
}

export type GardenImageSaveResult = 'shared' | 'downloaded' | 'dismissed'

export interface GardenDuetImageOpts {
  previous: GardenData
  current: GardenData
}

export function wrapMeaning(value: string, max = 38): string[] {
  const words = value.trim().split(/\s+/)
  const lines: string[] = []
  for (const word of words) {
    const current = lines[lines.length - 1]
    if (!current || current.length + word.length + 1 > max) lines.push(word)
    else lines[lines.length - 1] = `${current} ${word}`
  }
  return lines.slice(0, 4)
}

export function PressedFlowerImage({ flower, meaning }: { flower: FlowerSpec; meaning: string }) {
  const drawable = drawableFlower(flower)
  const lines = wrapMeaning(meaning)
  const svgH = drawable.stemHeight + 80
  /* The band caps the scale, so every flower's top lands at the same y whatever its stem height. */
  const FLOWER_BAND = 415
  const scale = Math.min(3.5, FLOWER_BAND / svgH)
  const flowerWidth = 80 * scale

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="pressedPaper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="100%" stopColor="#f1eadb" />
        </linearGradient>
        <filter id="pressedShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#60482f" floodOpacity="0.14" />
        </filter>
      </defs>
      <rect width={W} height={H} fill="#e9e1d2" />
      <rect
        x="54"
        y="54"
        width="972"
        height="972"
        rx="34"
        fill="url(#pressedPaper)"
        stroke="#d9cfbc"
        strokeWidth="2"
      />
      <text
        x="92"
        y="118"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="22"
        fontWeight="650"
        letterSpacing="4"
        fill="#829575"
      >
        PRESSED FROM A BLOOMNOTE
      </text>
      <g
        transform={`translate(${W / 2 - flowerWidth / 2}, ${565 - svgH * scale}) scale(${scale})`}
        filter="url(#pressedShadow)"
      >
        <FlowerSVG flower={drawable} index={0} bloomed staticRender />
      </g>
      <line x1="150" y1="620" x2="930" y2="620" stroke="#d9cfbc" strokeWidth="2" />
      <text
        x={W / 2}
        y="704"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="58"
        fontStyle="italic"
        fill="#3f6b3a"
      >
        {drawable.name}
      </text>
      <text
        x={W / 2}
        y="770"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="31"
        fill="#665f54"
      >
        {lines.map((line, index) => (
          <tspan key={line} x={W / 2} dy={index === 0 ? 0 : 43}>
            {line}
          </tspan>
        ))}
      </text>
      <text
        x={W / 2}
        y="980"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="22"
        fontWeight="650"
        letterSpacing="3"
        fill="#829575"
      >
        BLOOMNOTE
      </text>
    </svg>
  )
}

export function ShareImage({ flowers, from, to }: GardenImageOpts) {
  /*
   * Repaired here, not just at the fetch boundary. This is the last place before the picture leaves
   * the app for somebody's photo roll or a stranger's link preview, and an unrepaired stemHeight
   * renders as a NaN attribute, which draws as a black smudge.
   */
  const drawable = flowers.map(drawableFlower)
  const panelX = 80
  const panelY = 230
  const panelW = 920
  const panelH = 540
  const groundH = 150
  const groundSurface = panelY + panelH - groundH

  const scale = 1.7
  const n = Math.max(1, flowers.length)
  // Names allow 60 chars but the headline is one non-wrapping line, so truncate or it runs off
  // both edges of the exported PNG.
  const clipName = (s: string): string => (s.length > 18 ? `${s.slice(0, 17)}…` : s)
  const toName = to ? clipName(to) : 'you'
  const headline = from ? `${clipName(from)} grew ${toName} a garden` : `a garden, for ${toName}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      fontFamily="Georgia, 'Times New Roman', serif"
    >
      <defs>
        <linearGradient id="bnSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbe7f2" />
          <stop offset="100%" stopColor="#eef3e4" />
        </linearGradient>
        <SoilDefs />
        <clipPath id="bnPanel">
          <rect x={panelX} y={panelY} width={panelW} height={panelH} rx="28" />
        </clipPath>
      </defs>

      <rect width={W} height={H} fill="#faf6ee" />
      <text x={W / 2} y={170} textAnchor="middle" fontSize="40" fontStyle="italic" fill="#3f6b3a">
        {headline}
      </text>

      <g clipPath="url(#bnPanel)">
        <rect x={panelX} y={panelY} width={panelW} height={panelH} fill="url(#bnSky)" />
        <Soil x={panelX} w={panelW} surfaceY={groundSurface} bottomY={panelY + panelH} />
        {drawable.map((f, i) => {
          const svgH = f.stemHeight + 80
          const dispW = 80 * scale
          const cx = panelX + (panelW * (i + 0.5)) / n
          const x = cx - dispW / 2
          const y = groundSurface + 6 - svgH * scale
          return (
            <g key={i} transform={`translate(${x}, ${y}) scale(${scale})`}>
              <FlowerSVG flower={f} index={i} bloomed staticRender />
            </g>
          )
        })}
      </g>
      <rect
        x={panelX}
        y={panelY}
        width={panelW}
        height={panelH}
        rx="28"
        fill="none"
        stroke="#dfe6d8"
        strokeWidth="2"
      />

      <text
        x={W / 2}
        y={panelY + panelH + 96}
        textAnchor="middle"
        fontSize="54"
        fontWeight="bold"
        fill="#3f6b3a"
      >
        bloomnote
      </text>
      <text
        x={W / 2}
        y={panelY + panelH + 138}
        textAnchor="middle"
        fontSize="24"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#8a877f"
      >
        bloomnote.aidenjang.com
      </text>
    </svg>
  )
}

export function duetLabel(garden: GardenData): string {
  const clip = (value: string): string => (value.length > 16 ? `${value.slice(0, 15)}…` : value)
  if (garden.from && garden.to) return `${clip(garden.from)} → ${clip(garden.to)}`
  if (garden.from) return `from ${clip(garden.from)}`
  if (garden.to) return `for ${clip(garden.to)}`
  return 'a little garden'
}

function DuetBouquet({ garden, x, indexOffset }: { garden: GardenData; x: number; indexOffset: number }) {
  const panelY = 254
  const panelW = 410
  const panelH = 520
  const groundSurface = 650
  const visibleFlowers = garden.flowers.slice(0, 7).map(drawableFlower)
  const tallest = Math.max(150, ...visibleFlowers.map((flower) => flower.stemHeight + 80))
  const scale = Math.min(1.65, 350 / tallest)
  const count = Math.max(1, visibleFlowers.length)

  return (
    <g>
      <clipPath id={`duetPanel${indexOffset}`}>
        <rect x={x} y={panelY} width={panelW} height={panelH} rx="28" />
      </clipPath>
      <g clipPath={`url(#duetPanel${indexOffset})`}>
        <rect x={x} y={panelY} width={panelW} height={panelH} fill="url(#duetSky)" />
        <circle cx={x + 72} cy={panelY + 78} r="40" fill="#fff7cf" opacity="0.72" />
        <Soil x={x} w={panelW} surfaceY={groundSurface} bottomY={panelY + panelH} />
        {visibleFlowers.map((flower, index) => {
          const svgH = flower.stemHeight + 80
          const displayWidth = 80 * scale
          const centerX = x + (panelW * (index + 0.5)) / count
          return (
            <g
              key={`${flower.name}-${index}`}
              transform={`translate(${centerX - displayWidth / 2}, ${groundSurface + 5 - svgH * scale}) scale(${scale})`}
            >
              <FlowerSVG flower={flower} index={index + indexOffset} bloomed staticRender />
            </g>
          )
        })}
      </g>
      <rect
        x={x}
        y={panelY}
        width={panelW}
        height={panelH}
        rx="28"
        fill="none"
        stroke="#d8dfd0"
        strokeWidth="2"
      />
      <text
        x={x + panelW / 2}
        y="820"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="21"
        fontWeight="650"
        fill="#625f58"
      >
        {duetLabel(garden)}
      </text>
    </g>
  )
}

export function GardenDuetImage({ previous, current }: GardenDuetImageOpts) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="duetPaper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fffaf1" />
          <stop offset="100%" stopColor="#f0eadf" />
        </linearGradient>
        <linearGradient id="duetSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dce9f2" />
          <stop offset="100%" stopColor="#edf1df" />
        </linearGradient>
        <SoilDefs />
      </defs>
      <rect width={W} height={H} fill="#e8e0d3" />
      <rect
        x="42"
        y="42"
        width="996"
        height="996"
        rx="38"
        fill="url(#duetPaper)"
        stroke="#d7cebd"
        strokeWidth="2"
      />
      <text
        x={W / 2}
        y="118"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="50"
        fontStyle="italic"
        fill="#3f6b3a"
      >
        two gardens, one little story
      </text>
      <text
        x={W / 2}
        y="164"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="19"
        letterSpacing="3"
        fill="#829575"
      >
        A BLOOMNOTE DUET
      </text>
      <DuetBouquet garden={previous} x={92} indexOffset={0} />
      <DuetBouquet garden={current} x={578} indexOffset={20} />
      <path
        d="M 510 502 C 528 480, 552 480, 570 502"
        fill="none"
        stroke="#829575"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M 564 492 L 572 502 L 560 507"
        fill="none"
        stroke="#829575"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x={W / 2}
        y="884"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="31"
        fontStyle="italic"
        fill="#625f58"
      >
        grown, received, and grown back
      </text>
      <text
        x={W / 2}
        y="966"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="43"
        fontWeight="bold"
        fill="#3f6b3a"
      >
        bloomnote
      </text>
      <text
        x={W / 2}
        y="1002"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="19"
        fill="#8a877f"
      >
        bloomnote.aidenjang.com
      </text>
    </svg>
  )
}

/* `dpr` is fixed at 2 rather than read from the device, so the exported file is the same size
   for everyone. */
export const OG_W = 1200
export const OG_H = 630

export function OgCard({ flowers, from, to }: GardenImageOpts) {
  const drawable = flowers.map(drawableFlower)
  const panelX = 70
  const panelY = 128
  const panelW = OG_W - panelX * 2
  const panelH = 372
  const groundH = 104
  const groundSurface = panelY + panelH - groundH
  const n = Math.max(1, flowers.length)
  /* Fit the tallest flower rather than trusting a constant. Stem heights vary from 70 to 115. */
  const tallest = Math.max(150, ...drawable.map((f) => f.stemHeight + 80))
  const headroom = 18
  const scale = Math.min(1.9, (groundSurface + 5 - (panelY + headroom)) / tallest)
  const clipName = (s: string): string => (s.length > 18 ? `${s.slice(0, 17)}…` : s)
  const toName = to ? clipName(to) : 'you'
  const headline = from ? `${clipName(from)} grew ${toName} a garden` : `a garden, for ${toName}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={OG_W}
      height={OG_H}
      viewBox={`0 0 ${OG_W} ${OG_H}`}
      fontFamily="Georgia, 'Times New Roman', serif"
    >
      <defs>
        <linearGradient id="ogSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbe7f2" />
          <stop offset="100%" stopColor="#eef3e4" />
        </linearGradient>
        <SoilDefs />
        <clipPath id="ogPanel">
          <rect x={panelX} y={panelY} width={panelW} height={panelH} rx="26" />
        </clipPath>
      </defs>

      <rect width={OG_W} height={OG_H} fill="#faf6ee" />
      <text x={OG_W / 2} y={86} textAnchor="middle" fontSize="44" fontStyle="italic" fill="#3f6b3a">
        {headline}
      </text>

      <g clipPath="url(#ogPanel)">
        <rect x={panelX} y={panelY} width={panelW} height={panelH} fill="url(#ogSky)" />
        <Soil x={panelX} w={panelW} surfaceY={groundSurface} bottomY={groundSurface + groundH} />
        {drawable.map((f, i) => {
          const svgH = f.stemHeight + 80
          const dispW = 80 * scale
          const cx = panelX + (panelW * (i + 0.5)) / n
          return (
            <g
              key={i}
              transform={`translate(${cx - dispW / 2}, ${groundSurface + 5 - svgH * scale}) scale(${scale})`}
            >
              <FlowerSVG flower={f} index={i} bloomed staticRender />
            </g>
          )
        })}
      </g>
      <rect
        x={panelX}
        y={panelY}
        width={panelW}
        height={panelH}
        rx="26"
        fill="none"
        stroke="#dfe6d8"
        strokeWidth="2"
      />

      <text
        x={OG_W / 2}
        y={panelY + panelH + 60}
        textAnchor="middle"
        fontSize="40"
        fontWeight="bold"
        fill="#3f6b3a"
      >
        bloomnote
      </text>
    </svg>
  )
}
