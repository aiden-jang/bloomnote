import FlowerSVG, { flowerExportHeight } from '../components/FlowerSVG'
import { drawableFlower } from '../garden'
import { clipText } from './graphemes'
import type { GardenImageOpts } from './imageCards'

// New clay keepsakes carry the open meadow; earlier gifts keep their existing export layout.
export default function MeadowImage({
  flowers,
  from,
  to,
  wide = false,
}: GardenImageOpts & { wide?: boolean }) {
  const plants = flowers.map(drawableFlower)
  const width = wide ? 1200 : 1080
  const height = wide ? 630 : 1080
  const ground = wide ? 490 : 770
  const top = wide ? 180 : 330
  const tallest = Math.max(150, ...plants.map(flowerExportHeight))
  const scale = Math.min(wide ? 1.65 : 2.25, (ground - top) / tallest)
  const margin = wide ? 125 : 115
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <radialGradient id="meadowGlow">
          <stop offset="0" stopColor="#dce4c3" stopOpacity=".72" />
          <stop offset="1" stopColor="#f7f6ee" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={width} height={height} fill="#f7f6ee" />
      <text
        x={width / 2}
        y={wide ? 86 : 180}
        textAnchor="middle"
        fill="#294b3a"
        fontFamily="Georgia, serif"
        fontSize={wide ? 44 : 58}
      >
        A garden for {clipText(to || 'you', 20)}.
      </text>
      {from && (
        <text
          x={width / 2}
          y={wide ? 129 : 234}
          textAnchor="middle"
          fill="#526354"
          fontFamily="Georgia, serif"
          fontStyle="italic"
          fontSize={wide ? 25 : 32}
        >
          from {clipText(from, 28)}
        </text>
      )}
      <ellipse cx={width / 2} cy={ground} rx={width * 0.45} ry={wide ? 32 : 46} fill="url(#meadowGlow)" />
      {plants.map((flower, i) => {
        const x = margin + ((width - margin * 2) * (i + 0.5)) / Math.max(1, plants.length)
        return (
          <g
            key={i}
            transform={`translate(${x - 40 * scale} ${ground - flowerExportHeight(flower) * scale}) scale(${scale})`}
          >
            <FlowerSVG flower={flower} index={i} bloomed staticRender />
          </g>
        )
      })}
      <text
        x={width / 2}
        y={wide ? 585 : 950}
        textAnchor="middle"
        fill="#294b3a"
        fontFamily="Georgia, serif"
        fontSize={wide ? 30 : 42}
      >
        bloomnote
      </text>
      {!wide && (
        <text
          x={width / 2}
          y="994"
          textAnchor="middle"
          fill="#526354"
          fontFamily="system-ui, sans-serif"
          fontSize="19"
        >
          A note. With flowers.
        </text>
      )}
    </svg>
  )
}
