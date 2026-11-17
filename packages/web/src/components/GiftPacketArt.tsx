import ClayHead from './ClayHead'
import ClayPaint, { useClayPaint } from './ClayPaint'
import styles from './GiftPacket.module.css'

export default function GiftPacketArt() {
  const { id, paint } = useClayPaint()
  return (
    <svg className={styles.art} viewBox="0 0 360 240" fill="none" aria-hidden="true" focusable="false">
      <ClayPaint id={id} colors={{ paper: '#f9f5e9', lining: '#eee9d9' }} />
      <ellipse cx="180" cy="220" rx="136" ry="8" fill="#315443" opacity=".07" />
      <g filter={paint('shadow')}>
        <rect x="30" y="54" width="300" height="154" rx="10" fill={paint('lining')} />
        <g className={styles.letter}>
          <rect x="49" y="39" width="262" height="156" rx="7" fill="#fffdf7" stroke="#e2dfd1" />
          <path d="M74 78h115M74 93h173M74 108h152" stroke="#c5cebb" strokeWidth="2" strokeLinecap="round" />
          <path d="M273 72q-8-15-14-5-3 8 14 16 17-8 14-16-6-10-14 5Z" fill="#e1b7bd" />
        </g>
        <path
          d="M30 61 180 150 330 61v137q0 10-10 10H40q-10 0-10-10Z"
          fill={paint('paper')}
          stroke="#ddd9c9"
        />
        <path d="M34 203 143 133m183 70-109-70" stroke="#e4dfcf" strokeWidth="1.2" />
        <g className={styles.flap}>
          <path
            d="M31 58h298l-139 94q-10 7-20 0Z"
            fill="#fffdf7"
            stroke="#dedbcd"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path d="m38 62 135 85q7 5 14 0L322 62" stroke="#ffffff" strokeWidth="2" />
        </g>
        <g className={styles.seal}>
          <g transform="translate(180 146) scale(.58)">
            <ClayHead
              flower={{
                artVersion: 3,
                name: 'Cosmos',
                meaning: '',
                petalColors: ['#e5b0be', '#eec8d2', '#f6dce3'],
                centerColor: '#dfb95c',
                stemColor: '#799269',
                petalShape: 'round',
                petalCount: 8,
                stemHeight: 80,
              }}
            />
          </g>
        </g>
      </g>
    </svg>
  )
}
