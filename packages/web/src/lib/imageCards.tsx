// Export SVGs must contain their own assets to avoid tainting the rasterization canvas.
import { clipText, graphemes } from './graphemes'
import type { FlowerSpec } from '../garden'
import { drawableFlower } from '../garden'
import FlowerSVG from '../components/FlowerSVG'
import { W, H, Soil, SoilDefs } from './imageCardPrimitives'
export { W, H, soilPaths } from './imageCardPrimitives'
export { GardenDuetImage, duetLabel, type GardenDuetImageOpts } from './GardenDuetImage'

export interface GardenImageOpts {
  flowers: FlowerSpec[]
  from?: string | undefined
  to?: string | undefined
}

export type GardenImageSaveResult = 'shared' | 'downloaded' | 'dismissed'

export function wrapMeaning(value: string, max = 24): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of value.trim().split(/\s+/).filter(Boolean)) {
    if (line && graphemes(`${line} ${word}`).length <= max) line += ` ${word}`
    else {
      if (line) lines.push(line)
      const parts = graphemes(word)
      while (parts.length > max) lines.push(parts.splice(0, max).join(''))
      line = parts.join('')
    }
  }
  if (line) lines.push(line)
  if (lines.length <= 4) return lines
  return [
    ...lines.slice(0, 3),
    `${graphemes(lines[3]!)
      .slice(0, max - 1)
      .join('')}…`,
  ]
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
  const clipName = (s: string): string => clipText(s, 18)
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
  const clipName = (s: string): string => clipText(s, 18)
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
