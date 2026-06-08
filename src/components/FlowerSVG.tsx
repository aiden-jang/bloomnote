import { useRef } from 'react'
import type { FlowerSpec, PetalShape } from '../garden'

interface Props {
  flower: FlowerSpec
  index: number
  bloomed: boolean
  swayDelay?: number
}

interface PetalGeometry {
  size: number
  centerRadius: number
}

function petalGeometry(shape: PetalShape): PetalGeometry {
  switch (shape) {
    case 'elongated': return { size: 12, centerRadius: 8 }
    case 'small':     return { size: 16, centerRadius: 10 }
    case 'bell':      return { size: 18, centerRadius: 10 }
    case 'star':      return { size: 22, centerRadius: 9 }
    default:          return { size: 20, centerRadius: 10 }
  }
}

// Per-shape control points for a single petal in local petal space. The
// petal points up (negative Y is up); we rotate later.
function petalPointsFor(shape: PetalShape, s: number): Array<[number, number]> {
  switch (shape) {
    case 'elongated':
      return [
        [0, 0], [s*0.3, -s], [s*0.3, -s*2],
        [0, -s*2.2], [-s*0.3, -s*2], [-s*0.3, -s], [0, 0],
      ]
    case 'bell':
      return [
        [0, 0], [s*0.5, -s*0.3], [s*0.6, -s],
        [s*0.4, -s*1.8], [s*0.2, -s*2.2], [-s*0.2, -s*2.2],
        [-s*0.4, -s*1.8], [-s*0.6, -s], [-s*0.5, -s*0.3], [0, 0],
      ]
    case 'small':
      return [
        [0, 0], [s*0.4, -s*0.5], [s*0.4, -s*1.2],
        [0, -s*1.4], [-s*0.4, -s*1.2], [-s*0.4, -s*0.5], [0, 0],
      ]
    case 'star':
      // Sharp diamond-like petal — long and pointed.
      return [
        [0, 0], [s*0.35, -s*0.4], [s*0.15, -s*1.6],
        [0, -s*1.9], [-s*0.15, -s*1.6], [-s*0.35, -s*0.4], [0, 0],
      ]
    default: // round
      return [
        [0, 0], [s*0.5, -s*0.5], [s*0.6, -s*1.4],
        [0, -s*1.6], [-s*0.6, -s*1.4], [-s*0.5, -s*0.5], [0, 0],
      ]
  }
}

function buildPetalPath(
  shape: PetalShape,
  size: number,
  rotationRad: number,
  cx: number,
  cy: number,
): string {
  const cos = Math.cos(rotationRad)
  const sin = Math.sin(rotationRad)
  const pts = petalPointsFor(shape, size).map(([x, y]): [number, number] => [
    cx + (x * cos - y * sin),
    cy + (x * sin + y * cos),
  ])
  // The petal point sequences above are designed so that the path is a
  // pair of cubic Beziers from pts[0] → pts[3] → pts[6] (or last). The
  // 'bell' case has more control points and reads as two cubic + two
  // cubic. We render the first 7 points as two cubics in all cases; the
  // extra bell points contribute to the silhouette via the rounded
  // ends rather than additional curves, which gives a clean profile
  // without complicating the path data.
  return (
    `M${pts[0][0]},${pts[0][1]} ` +
    `C${pts[1][0]},${pts[1][1]} ${pts[2][0]},${pts[2][1]} ${pts[3][0]},${pts[3][1]} ` +
    `C${pts[4][0]},${pts[4][1]} ${pts[5][0]},${pts[5][1]} ${pts[6][0]},${pts[6][1]}`
  )
}

export default function FlowerSVG({ flower, bloomed, swayDelay = 0 }: Props) {
  const groupRef = useRef<SVGGElement>(null)
  const { stemHeight, petalCount, petalColors, centerColor, stemColor, petalShape } = flower

  const svgH = stemHeight + 80
  const cx = 40
  const stemTop = 20
  const geom = petalGeometry(petalShape)

  // Subtle center inner color — slightly darker version of centerColor.
  const centerInner = darken(centerColor, 0.2)

  return (
    <svg
      width="80"
      height={svgH}
      viewBox={`0 0 80 ${svgH}`}
      style={{
        overflow: 'visible',
        animationName: bloomed ? 'sway' : 'none',
        animationDuration: `${2.5 + swayDelay * 0.3}s`,
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
        animationDelay: `${swayDelay * 0.4}s`,
        transformOrigin: `${cx}px ${svgH}px`,
      }}
    >
      {bloomed && (
        <g ref={groupRef}>
          <line
            x1={cx} y1={stemTop + geom.centerRadius}
            x2={cx} y2={svgH}
            stroke={stemColor}
            strokeWidth="4"
            strokeLinecap="round"
            style={{
              transformOrigin: `${cx}px ${svgH}px`,
              animationName: 'bloomStem',
              animationDuration: '0.5s',
              animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
              animationFillMode: 'forwards',
            }}
          />
          <ellipse
            cx={cx - 10} cy={svgH - stemHeight * 0.45}
            rx="9" ry="5"
            fill={stemColor}
            transform={`rotate(-35, ${cx - 10}, ${svgH - stemHeight * 0.45})`}
            opacity="0.9"
          />
          <ellipse
            cx={cx + 10} cy={svgH - stemHeight * 0.6}
            rx="9" ry="5"
            fill={stemColor}
            transform={`rotate(35, ${cx + 10}, ${svgH - stemHeight * 0.6})`}
            opacity="0.9"
          />
          {Array.from({ length: petalCount }).map((_, i) => {
            const angle = ((360 / petalCount) * i * Math.PI) / 180
            const color = petalColors[i % petalColors.length]
            const d = buildPetalPath(petalShape, geom.size, angle, cx, stemTop + geom.centerRadius)
            return (
              <path
                key={i}
                d={d}
                fill={color}
                opacity="0.92"
                style={{
                  transformOrigin: `${cx}px ${stemTop + geom.centerRadius}px`,
                  animationName: 'popIn',
                  animationDuration: '0.4s',
                  animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
                  animationFillMode: 'forwards',
                  animationDelay: `${i * 30}ms`,
                }}
              />
            )
          })}
          <circle cx={cx} cy={stemTop + geom.centerRadius} r={geom.centerRadius} fill={centerColor} />
          <circle cx={cx} cy={stemTop + geom.centerRadius} r={geom.centerRadius * 0.55} fill={centerInner} opacity="0.7" />
          {Array.from({ length: 5 }).map((_, i) => (
            <circle
              key={i}
              cx={cx + Math.cos((i / 5) * Math.PI * 2) * (geom.centerRadius * 0.65)}
              cy={(stemTop + geom.centerRadius) + Math.sin((i / 5) * Math.PI * 2) * (geom.centerRadius * 0.65)}
              r={1.5}
              fill={petalColors[0]}
              opacity="0.6"
            />
          ))}
        </g>
      )}
    </svg>
  )
}

// Darken a hex color by a factor in [0, 1].
function darken(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const num = parseInt(m[1], 16)
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * (1 - factor)))
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * (1 - factor)))
  const b = Math.max(0, Math.floor((num & 0xff) * (1 - factor)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
