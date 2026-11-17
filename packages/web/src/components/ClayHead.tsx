import type { FlowerSpec } from '../garden'
import { botanicalFamily } from './BotanicalFlower'
import ClayPaint, { useClayPaint } from './ClayPaint'

function Petals({
  count,
  radius,
  width,
  length,
  offset = 0,
  paint,
}: {
  count: number
  radius: number
  width: number
  length: number
  offset?: number
  paint: (part: string) => string
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <g key={i} transform={`rotate(${(i * 360) / count + offset})`}>
          <path
            d={`M${-width * 0.35} ${-radius + 3}C${-width * 0.7} ${-radius - length * 0.25} ${-width * 0.7} ${-radius - length * 0.92} ${-width * 0.15} ${-radius - length}C${width * 0.68} ${-radius - length * 1.12} ${width * 0.72} ${-radius - length * 0.2} ${width * 0.35} ${-radius + 3}Q0 ${-radius + 8} ${-width * 0.35} ${-radius + 3}Z`}
            fill={paint(`petal${i % 3}`)}
          />
          <path
            d={`M0 ${-radius - 2}Q-1 ${-radius - length * 0.4} 0 ${-radius - length * 0.72}`}
            fill="none"
            stroke="#ffffff"
            strokeOpacity=".12"
            strokeWidth=".65"
            strokeLinecap="round"
          />
        </g>
      ))}
    </>
  )
}

// Version 3 heads use the same 88-unit envelope as the botanical art, including hanging bells.
export default function ClayHead({ flower }: { flower: FlowerSpec }) {
  const { id, paint } = useClayPaint()
  const family = botanicalFamily(flower)
  const colors = {
    petal0: flower.petalColors[0],
    petal1: flower.petalColors[1] || flower.petalColors[0],
    petal2: flower.petalColors[2] || flower.petalColors[0],
    center: flower.centerColor,
    stem: flower.stemColor,
  }
  const center = family === 'sunflower' ? 13 : family === 'dahlia' ? 5 : 6.5
  return (
    <g data-clay={family}>
      <ClayPaint id={id} colors={colors} />
      <g filter={paint('shadow')}>
        {family === 'bluebell' ? (
          <>
            <path
              d="M-5 29Q-16-36 12-29Q31-24 22-8M-7-3Q-25-21-26-2M-3 9Q11-3 15 13"
              fill="none"
              stroke={paint('stem')}
              strokeWidth="4"
              strokeLinecap="round"
            />
            {[
              [-26, -2, 12],
              [22, -8, -12],
              [15, 13, -12],
            ].map(([x, y, angle], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${angle})`}>
                <path
                  d="M-4-9C-11-7-10 1-11 8Q-17 15-8 13Q-4 20 0 13Q6 19 9 12Q17 14 11 7C10 0 11-7 4-9Q0-11-4-9Z"
                  fill={paint(`petal${i}`)}
                />
                <path
                  d="M-4-5Q-7 0-6 5"
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity=".25"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <ellipse cy="13" rx="4" ry="1.5" fill={paint('petal0')} />
              </g>
            ))}
          </>
        ) : family === 'hydrangea' ? (
          <>
            {[
              [-15, -13],
              [5, -22],
              [21, -8],
              [-25, 5],
              [-7, 1],
              [10, -2],
              [23, 14],
              [-10, 21],
              [7, 20],
            ].map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${i * 31})`}>
                <Petals count={4} radius={1} width={8} length={12} paint={paint} />
                <circle r="2" fill={paint('center')} />
              </g>
            ))}
          </>
        ) : family === 'rose' ? (
          <>
            <Petals count={5} radius={9} width={27} length={26} offset={16} paint={paint} />
            <Petals count={5} radius={4} width={21} length={23} offset={52} paint={paint} />
            <Petals count={4} radius={0} width={14} length={15} offset={26} paint={paint} />
            <path
              d="M-6-3Q1-11 8-3Q11 6 0 8Q-9 7-5 0Q-1-5 3 0"
              fill={paint('petal1')}
              stroke={flower.petalColors[0]}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            {family === 'dahlia' ? (
              <>
                <Petals count={12} radius={15} width={13} length={22} paint={paint} />
                <Petals count={10} radius={9} width={12} length={20} offset={18} paint={paint} />
                <Petals count={8} radius={3} width={10} length={15} offset={36} paint={paint} />
              </>
            ) : family === 'sunflower' ? (
              <>
                <Petals count={13} radius={11} width={11} length={25} offset={13} paint={paint} />
              </>
            ) : (
              <Petals
                count={family === 'cosmos' ? 8 : Math.min(10, flower.petalCount)}
                radius={3}
                width={flower.petalShape === 'star' ? 13 : 21}
                length={flower.petalShape === 'small' ? 26 : 32}
                paint={paint}
              />
            )}
            <circle r={center} fill={paint('center')} />
            {Array.from({ length: family === 'sunflower' ? 43 : 12 }, (_, i) => {
              const angle = i * 2.39996
              const radius = Math.sqrt((i + 0.5) / (family === 'sunflower' ? 43 : 12)) * center * 0.81
              return (
                <circle
                  key={i}
                  cx={Math.cos(angle) * radius}
                  cy={Math.sin(angle) * radius}
                  r={family === 'sunflower' ? 1.25 : 0.7}
                  fill={paint('center')}
                  stroke={flower.petalColors[2]}
                  strokeOpacity=".24"
                  strokeWidth=".5"
                />
              )
            })}
          </>
        )}
      </g>
    </g>
  )
}
