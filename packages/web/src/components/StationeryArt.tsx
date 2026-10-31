import styles from './StationeryArt.module.css'

export default function StationeryArt({ kind }: { kind: 'envelope' | 'bookmark' }) {
  return (
    <svg
      className={kind === 'bookmark' ? styles.mini : styles.art}
      viewBox={kind === 'bookmark' ? '0 0 64 64' : '0 0 180 120'}
      fill="none"
      aria-hidden="true"
    >
      <g stroke="#315443" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'envelope' ? (
          <>
            <g transform="rotate(-7 87 74)">
              <rect x="26" y="43" width="124" height="66" rx="7" fill="#fffdf8" />
              <path d="m27 45 61 39 61-39m-122 62 42-34m80 34-42-34" />
              <rect x="31" y="22" width="115" height="27" rx="4" fill="#e5eadb" />
              <path d="m40 31 69 0m-69 8h44" stroke="#a1b396" strokeWidth="1.5" />
            </g>
            <path
              d="M132 65c-10-13-13-29-6-45m-1 15c-18-1-20-11-15-15 13 0 15 15 15 15m1 10c12-15 21-11 21-6-1 12-21 6-21 6"
              fill="#b6c9ad"
            />
            <g fill="#dfb6c1">
              <ellipse cx="126" cy="15" rx="7" ry="10" />
              <ellipse cx="116" cy="21" rx="10" ry="6" />
              <ellipse cx="136" cy="21" rx="10" ry="6" />
              <ellipse cx="126" cy="27" rx="7" ry="10" />
            </g>
            <circle cx="126" cy="21" r="4" fill="#ead7aa" />
          </>
        ) : (
          <>
            <path d="M18 8h27v48L31 46 18 56Z" fill="#dfb6c1" />
            <path
              d="M31 41V19m0 14c-13 0-13-9-13-9 11-2 13 9 13 9m0 5c13 0 13-9 13-9-11-2-13 9-13 9"
              fill="#b6c9ad"
            />
            <g fill="#fffdf8">
              <circle cx="31" cy="15" r="5" />
              <circle cx="24" cy="20" r="5" />
              <circle cx="38" cy="20" r="5" />
              <circle cx="27" cy="27" r="5" />
              <circle cx="35" cy="27" r="5" />
            </g>
            <circle cx="31" cy="21" r="4" fill="#ead7aa" />
          </>
        )}
      </g>
    </svg>
  )
}
