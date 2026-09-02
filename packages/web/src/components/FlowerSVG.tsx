import { useRef } from 'react'
import { drawableFlower } from '../garden'
import { prefersReducedMotion } from '../lib/motion'
import type { FlowerSpec, PetalShape } from '../garden'

interface Props {
  flower: FlowerSpec
  index: number
  bloomed: boolean
  swayDelay?: number
  /** Render the fully-open flower with no CSS animations, so it rasterizes into a static share
      image instead of freezing mid-bloom. */
  staticRender?: boolean
}

interface PetalGeometry {
  size: number
  centerRadius: number
}

/* Head scales with its stem. Stems run 40 to 160, and a fixed head on a long one reads as a
   lollipop. */
const HEAD_SCALE = { min: 0.85, max: 1.2, atStem: { min: 40, max: 160 } }

export function headScale(stemHeight: number): number {
  const t = (stemHeight - HEAD_SCALE.atStem.min) / (HEAD_SCALE.atStem.max - HEAD_SCALE.atStem.min)
  return HEAD_SCALE.min + Math.min(1, Math.max(0, t)) * (HEAD_SCALE.max - HEAD_SCALE.min)
}

export function flowerBoxHeight(flower: unknown): number {
  const { stemHeight } = drawableFlower(flower as never)
  return stemHeight + Math.round(80 * headScale(stemHeight))
}

export function flowerHeadOffset(flower: unknown): number {
  const { stemHeight, petalShape } = drawableFlower(flower as never)
  const scale = headScale(stemHeight)
  return flowerBoxHeight(flower) - (STEM_TOP + petalGeometry(petalShape).centerRadius * scale)
}

const STEM_TOP = 20

// prettier-ignore
function petalGeometry(shape: PetalShape): PetalGeometry {
  switch (shape) {
    case 'elongated': return { size: 12, centerRadius: 8 }
    case 'small':     return { size: 16, centerRadius: 10 }
    case 'bell':      return { size: 18, centerRadius: 10 }
    case 'star':      return { size: 22, centerRadius: 9 }
    default:          return { size: 20, centerRadius: 10 }
  }
}

// prettier-ignore
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
      return [
        [0, 0], [s*0.35, -s*0.4], [s*0.15, -s*1.6],
        [0, -s*1.9], [-s*0.15, -s*1.6], [-s*0.35, -s*0.4], [0, 0],
      ]
    default:
      return [
        [0, 0], [s*0.5, -s*0.5], [s*0.6, -s*1.4],
        [0, -s*1.6], [-s*0.6, -s*1.4], [-s*0.5, -s*0.5], [0, 0],
      ]
  }
}

/* Measured off the control points rather than written down per shape, so editing a silhouette
   above can't leave a stale number here. */
function petalReach(shape: PetalShape, s: number): number {
  return Math.max(...petalPointsFor(shape, s).map(([x, y]) => Math.hypot(x, y)))
}

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
  // The first seven control points render as two cubics. Every sequence above supplies at least
  // that many, so the head is treated as a fixed tuple.
  type Pt = [number, number]
  const [p0, p1, p2, p3, p4, p5, p6] = pts as [Pt, Pt, Pt, Pt, Pt, Pt, Pt, ...Pt[]]
  return (
    `M${p0[0]},${p0[1]} ` +
    `C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]} ` +
    `C${p4[0]},${p4[1]} ${p5[0]},${p5[1]} ${p6[0]},${p6[1]}`
  )
}

export function FlowerHead({ flower, size = 34 }: { flower: FlowerSpec; size?: number }) {
  const { petalCount, petalColors, centerColor, petalShape } = drawableFlower(flower)
  const base = petalGeometry(petalShape)
  /* Normalise the footprint: a `small` petal reaches 22 units and a `star` 42, so without this one
     row's flowers come out different sizes. */
  const c = 44
  const zoom = 38 / petalReach(petalShape, base.size)
  const petalSize = base.size * zoom
  const centerRadius = base.centerRadius * zoom
  const centerInner = darken(centerColor, 0.2)

  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden focusable="false">
      {Array.from({ length: petalCount }).map((_, i) => (
        <path
          key={i}
          d={buildPetalPath(petalShape, petalSize, ((360 / petalCount) * i * Math.PI) / 180, c, c)}
          fill={petalColors[i % petalColors.length]}
          opacity="0.92"
        />
      ))}
      <circle cx={c} cy={c} r={centerRadius} fill={centerColor} />
      <circle cx={c} cy={c} r={centerRadius * 0.55} fill={centerInner} opacity="0.7" />
      {Array.from({ length: 5 }).map((_, i) => (
        <circle
          key={i}
          cx={c + Math.cos((i / 5) * Math.PI * 2) * (centerRadius * 0.65)}
          cy={c + Math.sin((i / 5) * Math.PI * 2) * (centerRadius * 0.65)}
          r={1.5 * zoom}
          fill={petalColors[0]}
          opacity="0.6"
        />
      ))}
    </svg>
  )
}

export default function FlowerSVG({ flower, bloomed, swayDelay = 0, staticRender = false }: Props) {
  const groupRef = useRef<SVGGElement>(null)
  // Normalized at the fetch boundary already, and repeated here because this also renders from the
  // example cards and the share-image path, where a NaN is silent.
  const { stemHeight, petalCount, petalColors, centerColor, stemColor, petalShape } = drawableFlower(flower)
  // These animations are set via inline style, which a CSS media query cannot override, so the
  // reduced-motion check has to happen here or those users still get the infinite sway.
  const still = staticRender || prefersReducedMotion()

  const scale = headScale(stemHeight)
  const svgH = flowerBoxHeight(flower)
  const cx = 40
  const stemTop = STEM_TOP
  const base = petalGeometry(petalShape)
  const geom = { size: base.size * scale, centerRadius: base.centerRadius * scale }
  const head = stemTop + geom.centerRadius
  /* Tapered and slightly leaning, or a long stem reads as wire. The lean comes from stemHeight,
     not random, so it is the same every time. */
  const stemBase = 3 + stemHeight / 90
  const stemTip = 1.6 + stemHeight / 260
  const lean = ((stemHeight % 7) - 3) * 0.9
  const stemPath =
    `M ${cx - stemBase / 2} ${svgH} ` +
    `Q ${cx - stemTip / 2 + lean} ${head + (svgH - head) * 0.45} ${cx - stemTip / 2 + lean} ${head} ` +
    `L ${cx + stemTip / 2 + lean} ${head} ` +
    `Q ${cx + stemTip / 2 + lean} ${head + (svgH - head) * 0.45} ${cx + stemBase / 2} ${svgH} Z`
  const leafFractions = stemHeight < 70 ? [0.5] : stemHeight < 120 ? [0.45, 0.62] : [0.36, 0.55, 0.74]

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
          <path
            d={stemPath}
            fill={stemColor}
            style={{
              transformOrigin: `${cx}px ${svgH}px`,
              animationName: still ? 'none' : 'bloomStem',
              animationDuration: `${STEM_MS}ms`,
              animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
              animationFillMode: 'forwards',
            }}
          />
          {/* Leaves ride the stem up. Without this they hang in mid-air, fully drawn, beside a stem that
              hasn't reached them. */}
          <g
            style={{
              transformOrigin: `${cx}px ${svgH}px`,
              animationName: still ? 'none' : 'bloomStem',
              animationDuration: `${STEM_MS}ms`,
              animationTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
              animationFillMode: 'forwards',
            }}
          >
            {leafFractions.map((f, li) => {
              const side = li % 2 === 0 ? -1 : 1
              const y = svgH - stemHeight * f
              const rx = 9 - f * 2.5
              return (
                <ellipse
                  key={f}
                  cx={cx + side * 10}
                  cy={y}
                  rx={rx}
                  ry={rx * 0.55}
                  fill={stemColor}
                  transform={`rotate(${side * 35}, ${cx + side * 10}, ${y})`}
                  opacity="0.9"
                />
              )
            })}
          </g>
          {/* The head opens only once the stem has arrived to carry it. */}
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
                  // `both`, not `forwards`: with only `forwards` the element renders at its natural size for the
                  // whole delay, so a delayed pop-in shows the thing first and animates it second.
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

function darken(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const num = parseInt(m[1]!, 16)
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * (1 - factor)))
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * (1 - factor)))
  const b = Math.max(0, Math.floor((num & 0xff) * (1 - factor)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
