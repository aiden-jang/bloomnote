import ClayPaint, { useClayPaint } from './ClayPaint'
import styles from './GardenBee.module.css'

export default function ClayBee({
  hat = false,
  petalColor = '#dba9bd',
}: {
  hat?: boolean
  petalColor?: string
}) {
  const { id, paint } = useClayPaint()
  return (
    <svg viewBox="-3 -8 38 35" className={styles.art} aria-hidden="true" focusable="false">
      <ClayPaint id={id} colors={{ honey: '#efc24f', ink: '#49402c', wing: '#f8f4df', petal: petalColor }} />
      <g filter={paint('shadow')} transform="rotate(-12 16 15)">
        <ellipse cx="14" cy="7" rx="4.5" ry="6" fill={paint('wing')} transform="rotate(-28 14 7)" />
        <ellipse cx="22" cy="7" rx="4" ry="5.5" fill={paint('wing')} transform="rotate(26 22 7)" />
        <ellipse cx="18" cy="16" rx="10" ry="7" fill={paint('honey')} />
        <path d="M17 9.1Q21 16 17 22.9M23 10Q27 16 23 22" fill="none" stroke={paint('ink')} strokeWidth="3" />
        <ellipse cx="9" cy="15" rx="5.8" ry="5.5" fill={paint('honey')} />
        <circle cx="6.5" cy="14" r="1.1" fill="#37372a" />
        <ellipse cx="5.4" cy="17" rx="1.3" ry=".7" fill="#dca391" />
        <path d="M7 10Q5 6 3 7" fill="none" stroke="#49402c" strokeWidth="1" strokeLinecap="round" />
        {hat && (
          <g className={styles.hat} data-petal-hat="">
            <path d="M3 9C0 3 1-5 8-5C17-5 19 2 15 8Q8 5 3 9Z" fill={paint('petal')} />
            <path
              d="M6 5Q7 0 11-2"
              fill="none"
              stroke="#ffffff"
              strokeOpacity=".25"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <ellipse cx="9" cy="8" rx="6" ry="1.3" fill={paint('petal')} />
          </g>
        )}
      </g>
    </svg>
  )
}
