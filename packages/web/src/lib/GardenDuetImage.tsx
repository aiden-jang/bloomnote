import { drawableFlower, type GardenData } from '../garden'
import { clipText } from './graphemes'
import FlowerSVG from '../components/FlowerSVG'
import { W, H, Soil, SoilDefs } from './imageCardPrimitives'
export interface GardenDuetImageOpts {
  previous: GardenData
  current: GardenData
}

export function duetLabel(garden: GardenData): string {
  const clip = (value: string): string => clipText(value, 16)
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
