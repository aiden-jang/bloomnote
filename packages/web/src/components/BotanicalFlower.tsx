import type { CSSProperties } from 'react'
import type { FlowerSpec } from '../garden'

export type BotanicalFamily =
  'dahlia' | 'cosmos' | 'sunflower' | 'rose' | 'bluebell' | 'hydrangea' | 'wildflower'

// Unknown names stay flowers. Shape is the fallback, never an invented botanical label.
export function botanicalFamily(flower: FlowerSpec): BotanicalFamily {
  const name = flower.name.toLowerCase()
  for (const family of ['dahlia', 'cosmos', 'sunflower', 'rose', 'bluebell', 'hydrangea'] as const)
    if (new RegExp(`\\b${family}s?\\b`).test(name)) return family
  return flower.petalShape === 'bell' ? 'bluebell' : 'wildflower'
}

export const botanicalHeadY = (scale: number) => 3 + 40 * scale

function PetalRing({
  count,
  radius,
  width,
  length,
  colors,
  offset = 0,
  cupped = false,
}: {
  count: number
  radius: number
  width: number
  length: number
  colors: string[]
  offset?: number
  cupped?: boolean
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <path
          key={i}
          transform={`rotate(${(i * 360) / count + offset})`}
          d={`M${-width / 2} ${-radius} C${-width} ${-radius - length * 0.6} ${-width * 0.6} ${-radius - length} 0 ${-radius - length} C${width * 0.6} ${-radius - length} ${width} ${-radius - length * 0.6} ${width / 2} ${-radius} Q0 ${-radius + (cupped ? 10 : 3)} ${-width / 2} ${-radius}Z`}
          fill={colors[i % colors.length]}
          stroke={colors[(i + 1) % colors.length]}
          strokeWidth="0.65"
        />
      ))}
    </>
  )
}

function SeedCenter({ color, petals, radius }: { color: string; petals: string; radius: number }) {
  return (
    <>
      <circle r={radius} fill={color} />
      {Array.from({ length: 19 }, (_, i) => {
        const angle = i * 2.39996
        const r = Math.sqrt(i / 19) * radius * 0.83
        return (
          <circle
            key={i}
            cx={Math.cos(angle) * r}
            cy={Math.sin(angle) * r}
            r={radius > 10 ? 0.9 : 0.65}
            fill={petals}
            opacity=".65"
          />
        )
      })}
    </>
  )
}

// All heads share an 88-unit envelope, including hanging bells and the clustered head.
// The same geometry is used by the scene, the library thumbnail and the exported keepsake.
export function BotanicalHead({ flower }: { flower: FlowerSpec }) {
  const family = botanicalFamily(flower)
  const colors = flower.petalColors
  const stem = flower.stemColor
  return (
    <g data-botanical={family}>
      {family === 'bluebell' ? (
        <>
          <path
            d="M-5 27Q-8-35 15-28Q31-22 23-8M-6-5Q-24-23-26-3M-2 10Q13-4 17 13"
            fill="none"
            stroke={stem}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {[
            [-26, -3, 12],
            [23, -8, -12],
            [17, 13, -17],
            [-6, 24, 8],
          ].map(([x, y, angle], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${angle})`}>
              <path
                d="M-3-8Q-10-1-9 8L-13 12Q-7 15-4 11Q0 17 4 11Q9 15 12 11L8 7Q8-2 3-8Z"
                fill={colors[i % 3]}
                stroke={colors[(i + 1) % 3]}
                strokeWidth=".8"
              />
              <path d="M-2-4Q-5 3-4 8" fill="none" stroke={colors[2]} strokeWidth="1.5" />
              <path d="M-3 12v3m6-3v3" stroke={flower.centerColor} strokeWidth="1.5" />
            </g>
          ))}
        </>
      ) : family === 'hydrangea' ? (
        <>
          {[
            [0, 0],
            [-15, -3],
            [14, -6],
            [-7, -19],
            [9, -21],
            [-22, -17],
            [23, -20],
            [-22, 11],
            [-8, 16],
            [10, 14],
            [24, 8],
            [0, -27],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${i * 23})`}>
              <PetalRing
                count={4}
                radius={1}
                width={5}
                length={8}
                colors={[colors[i % 3]!, colors[(i + 1) % 3]!]}
              />
              <circle r="1.7" fill={flower.centerColor} />
            </g>
          ))}
        </>
      ) : family === 'rose' ? (
        <>
          <path d="M-15 17-24 8-18 27 0 32 18 26 25 8 14 17" fill={stem} />
          <PetalRing count={5} radius={8} width={26} length={24} colors={colors} offset={18} cupped />
          <PetalRing
            count={5}
            radius={3}
            width={18}
            length={20}
            colors={[colors[1], colors[2], colors[0]]}
            offset={52}
            cupped
          />
          <PetalRing count={4} radius={0} width={11} length={12} colors={colors} offset={25} cupped />
          <path
            d="M-5-4Q6-11 8-1Q7 7-3 5Q-10 3-3-3Q1-5 3-1"
            fill={colors[0]}
            stroke={colors[2]}
            strokeWidth="1.4"
          />
        </>
      ) : (
        <>
          {family === 'dahlia' ? (
            <>
              <PetalRing count={14} radius={14} width={9} length={22} colors={colors} />
              <PetalRing
                count={12}
                radius={8}
                width={8}
                length={20}
                colors={[colors[1], colors[2], colors[0]]}
                offset={15}
              />
              <PetalRing count={9} radius={2} width={7} length={15} colors={colors} offset={32} />
            </>
          ) : family === 'sunflower' ? (
            <>
              <PetalRing count={16} radius={11} width={8} length={25} colors={colors} />
              <PetalRing count={13} radius={10} width={6} length={21} colors={colors} offset={12} />
            </>
          ) : family === 'cosmos' ? (
            <>
              {Array.from({ length: 8 }, (_, i) => (
                <path
                  key={i}
                  transform={`rotate(${i * 45 + (i % 2 ? 3 : -2)})`}
                  d={`M-3-3Q-16-17-12-${27 + (i % 3) * 2}L-6-31-2-29 2-33 7-30 11-31Q17-17 4-3Z`}
                  fill={colors[i % 3]}
                  stroke={colors[(i + 1) % 3]}
                  strokeWidth=".6"
                />
              ))}
            </>
          ) : (
            <PetalRing
              count={flower.petalCount}
              radius={3}
              width={flower.petalShape === 'star' ? 6 : 12}
              length={flower.petalShape === 'small' ? 23 : 30}
              colors={colors}
            />
          )}
          <SeedCenter
            color={flower.centerColor}
            petals={colors[2]}
            radius={family === 'sunflower' ? 14 : family === 'dahlia' ? 4 : 6}
          />
        </>
      )}
    </g>
  )
}

export default function BotanicalFlower({
  flower,
  bloomed,
  still,
  scale,
  height,
  swayDelay,
}: {
  flower: FlowerSpec
  bloomed: boolean
  still: boolean
  scale: number
  height: number
  swayDelay: number
}) {
  const family = botanicalFamily(flower)
  const head = botanicalHeadY(scale)
  const lean = family === 'bluebell' ? -7 : family === 'cosmos' ? 7 : -3
  const stem = flower.stemColor
  const animation = (name: string, delay = 0): CSSProperties => ({
    animation: still ? 'none' : `${name} 600ms cubic-bezier(.22,.9,.3,1.15) ${delay}ms both`,
    transformOrigin: `40px ${height}px`,
  })
  return (
    <svg
      width="80"
      height={height}
      viewBox={`0 0 80 ${height}`}
      style={{
        overflow: 'visible',
        animation:
          bloomed && !still
            ? `sway ${4.6 + swayDelay * 0.3}s ease-in-out ${swayDelay * 0.4}s infinite`
            : 'none',
        transformOrigin: `40px ${height}px`,
      }}
    >
      {bloomed && (
        <>
          <g style={animation('bloomStem')}>
            <path
              d={`M40 ${height}Q${40 + lean} ${head + (height - head) * 0.45} 40 ${head}`}
              fill="none"
              stroke={stem}
              strokeWidth={family === 'sunflower' ? 4 : 2.5}
              strokeLinecap="round"
            />
            {[0.31, 0.55, 0.73].map((fraction, i) => {
              const y = height - (height - head) * fraction
              const side = i % 2 ? -1 : 1
              const broad = ['rose', 'sunflower', 'hydrangea'].includes(family)
              return (
                <g key={fraction} transform={`translate(40 ${y}) scale(${side} 1)`}>
                  <path
                    d={broad ? 'M0 0Q7-23 26-22Q29-3 0 0Z' : 'M0 0Q10-14 25-12Q20 0 0 0Z'}
                    fill={stem}
                    opacity={i === 2 ? '.8' : '1'}
                  />
                  <path
                    d={broad ? 'M2-2 23-19' : 'M2-1 21-10'}
                    stroke={flower.petalColors[2]}
                    opacity=".3"
                    strokeWidth=".8"
                  />
                </g>
              )
            })}
          </g>
          <g style={{ ...animation('popIn', 420), transformOrigin: `40px ${head}px` }}>
            <g transform={`translate(40 ${head}) scale(${scale})`}>
              <BotanicalHead flower={flower} />
            </g>
          </g>
        </>
      )}
    </svg>
  )
}
