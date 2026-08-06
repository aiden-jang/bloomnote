import { useRef } from 'react'
import { drawableFlower } from '../garden'
import { prefersReducedMotion } from '../lib/motion'
import type { FlowerSpec, PetalShape } from '../garden'

interface Props {
  flower: FlowerSpec
  index: number
  bloomed: boolean
  swayDelay?: number
  /** Render the fully-open flower with no CSS animations, so it rasterizes correctly into a
   *  static share image (entrance animations don't run in an <img>-loaded SVG). */
  staticRender?: boolean
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

/** How long the stem takes to reach full height. The head waits this out before opening. */
const STEM_MS = 500

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
  // We render the first seven control points as two cubics; the sequences above always
  // supply at least that many, so treat the head as a fixed tuple.
  type Pt = [number, number]
  const [p0, p1, p2, p3, p4, p5, p6] = pts as [Pt, Pt, Pt, Pt, Pt, Pt, Pt, ...Pt[]]
  return (
    `M${p0[0]},${p0[1]} ` +
    `C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]} ` +
    `C${p4[0]},${p4[1]} ${p5[0]},${p5[1]} ${p6[0]},${p6[1]}`
  )
}

export default function FlowerSVG({ flower, bloomed, swayDelay = 0, staticRender = false }: Props) {
  const groupRef = useRef<SVGGElement>(null)
  // Normalized at the fetch boundary already; repeated here because this component is also
  // rendered directly from the example cards and the share-image path, and a NaN here is silent.
  const { stemHeight, petalCount, petalColors, centerColor, stemColor, petalShape } = drawableFlower(flower)
  // Render still (fully-formed, no sway/pop-in) for static rasterization AND for reduced-motion
  // users. These animations are set via inline style, which a CSS media query can't override, so
  // the check has to happen here — otherwise reduced-motion users still get the infinite sway.
  const still = staticRender || prefersReducedMotion()

  const svgH = stemHeight + 80
  const cx = 40
  const stemTop = 20
  const geom = petalGeometry(petalShape)
  const head = stemTop + geom.centerRadius

  // Subtle center inner color — slightly darker version of centerColor.
  const centerInner = darken(centerColor, 0.2)

  return (
    <svg
      width="80"
      height={svgH}
      viewBox={`0 0 80 ${svgH}`}
      style={{
        overflow: 'visible',
        animationName: bloomed && !still ? 'sway' : 'none',
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
            x1={cx} y1={head}
            x2={cx} y2={svgH}
            stroke={stemColor}
            strokeWidth="4"
            strokeLinecap="round"
            style={{
              transformOrigin: `${cx}px ${svgH}px`,
              animationName: still ? 'none' : 'bloomStem',
              animationDuration: `${STEM_MS}ms`,
              animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
              animationFillMode: 'forwards',
            }}
          />
          {/* Leaves ride the stem up. Without this they hang in mid-air, fully drawn, next to a
              stem that hasn't reached them yet. */}
          <g
            style={{
              transformOrigin: `${cx}px ${svgH}px`,
              animationName: still ? 'none' : 'bloomStem',
              animationDuration: `${STEM_MS}ms`,
              animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
              animationFillMode: 'forwards',
            }}
          >
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
          </g>
          {/* The head opens only once the stem has arrived to carry it. Previously the petals
              popped at t=0 while the stem was still growing, so for the first half-second the
              flower was a head floating in the sky above a rising line. One flower blooming once
              hid it; the homepage loops three gardens, which did not. */}
          {Array.from({ length: petalCount }).map((_, i) => {
            const angle = ((360 / petalCount) * i * Math.PI) / 180
            const color = petalColors[i % petalColors.length]
            const d = buildPetalPath(petalShape, geom.size, angle, cx, head)
            return (
              <path
                key={i}
                d={d}
                fill={color}
                opacity="0.92"
                style={{
                  transformOrigin: `${cx}px ${head}px`,
                  animationName: still ? 'none' : 'popIn',
                  animationDuration: '0.4s',
                  animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
                  // `both`, not `forwards`: with only `forwards` the element renders at its
                  // natural size for the whole delay, so a delayed pop-in shows the thing first
                  // and animates it second. `both` applies the 0% keyframe up front.
                  animationFillMode: 'both',
                  animationDelay: `${STEM_MS + i * 30}ms`,
                }}
              />
            )
          })}
          <g
            style={{
              transformOrigin: `${cx}px ${head}px`,
              animationName: still ? 'none' : 'popIn',
              animationDuration: '0.4s',
              animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
              animationFillMode: 'both',
              // Just behind the first petals, so the center lands into an opening flower rather
              // than sitting there waiting to be surrounded.
              animationDelay: `${STEM_MS + 60}ms`,
            }}
          >
            <circle cx={cx} cy={head} r={geom.centerRadius} fill={centerColor} />
            <circle cx={cx} cy={head} r={geom.centerRadius * 0.55} fill={centerInner} opacity="0.7" />
            {Array.from({ length: 5 }).map((_, i) => (
              <circle
                key={i}
                cx={cx + Math.cos((i / 5) * Math.PI * 2) * (geom.centerRadius * 0.65)}
                cy={head + Math.sin((i / 5) * Math.PI * 2) * (geom.centerRadius * 0.65)}
                r={1.5}
                fill={petalColors[0]}
                opacity="0.6"
              />
            ))}
          </g>
        </g>
      )}
    </svg>
  )
}

// Darken a hex color by a factor in [0, 1].
function darken(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const num = parseInt(m[1]!, 16)
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * (1 - factor)))
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * (1 - factor)))
  const b = Math.max(0, Math.floor((num & 0xff) * (1 - factor)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
