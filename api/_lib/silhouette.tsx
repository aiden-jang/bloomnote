// Inline SVG flower silhouette for satori / @vercel/og renderers.
//
// All three image endpoints (og, card, story) used to ship their own
// near-identical copy of this. Extracted here so a tweak to the
// silhouette logic only happens in one place. Callers pass their own
// scale via `size` (the SVG box dimension) — different image formats
// want different flower sizes, but the underlying drawing is the same.

import type { FlowerSpec } from '../../src/garden'

interface Props {
  flower: FlowerSpec
  /** SVG viewBox dimension. The petal ring scales relative to this. */
  size?: number
  /** Stem thickness in CSS px. */
  stemWidth?: number
  /**
   * Vertical clamp for the stem. Story-format flowers want taller
   * stems than square-card flowers, so each caller picks the cap.
   */
  maxStemHeight?: number
}

export default function FlowerSilhouette({
  flower,
  size = 120,
  stemWidth = 5,
  maxStemHeight = 160,
}: Props) {
  const [c1, c2] = flower.petalColors
  const petalCount = flower.petalCount || 8
  const center = { x: size / 2, y: size / 2 }
  const ringRadius = size * 0.17
  const petalRx = size * 0.14
  const petalRy = size * 0.21
  const centerR = size * 0.1
  const stemHeight = Math.min(flower.stemHeight || 90, maxStemHeight)

  const petals = []
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2
    const px = center.x + Math.cos(angle) * ringRadius
    const py = center.y + Math.sin(angle) * ringRadius
    petals.push(
      <ellipse
        key={i}
        cx={px}
        cy={py}
        rx={petalRx}
        ry={petalRy}
        transform={`rotate(${(angle * 180) / Math.PI + 90} ${px} ${py})`}
        fill={i % 2 === 0 ? c1 : c2}
      />,
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {petals}
        <circle cx={center.x} cy={center.y} r={centerR} fill={flower.centerColor} />
      </svg>
      <div
        style={{
          width: `${stemWidth}px`,
          height: `${stemHeight}px`,
          background: flower.stemColor,
          borderRadius: '4px',
          marginTop: '-8px',
        }}
      />
    </div>
  )
}
