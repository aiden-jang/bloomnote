import type { CSSProperties } from 'react'
import type { FlowerSpec } from '../garden'
import { botanicalFamily, botanicalHeadY } from './BotanicalFlower'
import ClayHead from './ClayHead'
import ClayPaint, { useClayPaint } from './ClayPaint'

export default function ClayFlower({
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
  const { id, paint } = useClayPaint()
  const family = botanicalFamily(flower)
  const head = botanicalHeadY(scale)
  const lean = family === 'cosmos' ? 11 : family === 'bluebell' ? -9 : -5
  const stemPath = `M40 ${height}Q${40 + lean} ${head + (height - head) * 0.46} 40 ${head}`
  const animation = (name: string, delay = 0): CSSProperties => ({
    animation: still ? 'none' : `${name} 640ms cubic-bezier(.22,.9,.3,1.12) ${delay}ms both`,
    transformOrigin: `40px ${height}px`,
  })
  return (
    <svg
      width="80"
      height={height}
      viewBox={`0 0 80 ${height}`}
      aria-hidden="true"
      focusable="false"
      style={{
        overflow: 'visible',
        animation:
          bloomed && !still
            ? `sway ${4.8 + swayDelay * 0.3}s ease-in-out ${swayDelay * 0.4}s infinite`
            : 'none',
        transformOrigin: `40px ${height}px`,
      }}
    >
      <ClayPaint id={id} colors={{ stem: flower.stemColor }} />
      {bloomed && (
        <>
          <g style={animation('bloomStem')}>
            <path
              d={stemPath}
              fill="none"
              stroke={paint('stem')}
              strokeWidth={family === 'sunflower' ? 5 : 4}
              strokeLinecap="round"
            />
            <path
              d={stemPath}
              transform="translate(-.8 0)"
              fill="none"
              stroke="#ffffff"
              strokeOpacity=".15"
              strokeWidth="1"
            />
            {[0.28, 0.48, 0.67].map((fraction, i) => {
              const y = height - (height - head) * fraction
              // Leaves follow the same quadratic as the stem instead of floating next to it.
              const x = 40 + 2 * (1 - fraction) * fraction * lean
              return (
                <g key={fraction} transform={`translate(${x} ${y}) scale(${i % 2 ? -1 : 1} 1)`}>
                  <path d="M0 0C5-14 20-21 27-19C27-9 14 1 0 0Z" fill={paint('stem')} />
                  <path
                    d="M3-2Q12-9 22-15"
                    fill="none"
                    stroke="#ffffff"
                    strokeOpacity=".2"
                    strokeWidth=".8"
                    strokeLinecap="round"
                  />
                </g>
              )
            })}
          </g>
          <g style={{ ...animation('popIn', 420), transformOrigin: `40px ${head}px` }}>
            <g transform={`translate(40 ${head}) scale(${scale})`}>
              <ClayHead flower={flower} />
            </g>
          </g>
        </>
      )}
    </svg>
  )
}
