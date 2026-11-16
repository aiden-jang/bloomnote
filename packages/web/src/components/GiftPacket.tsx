import styles from './GiftPacket.module.css'

export default function GiftPacket({
  from,
  to,
  count,
  opening,
  onOpen,
}: {
  from: string
  to?: string | undefined
  count: number
  opening: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className={styles.packet}
      data-opening={opening}
      onClick={onOpen}
      disabled={opening}
      aria-label="open the garden"
    >
      <svg className={styles.art} viewBox="0 0 360 230" fill="none" aria-hidden="true" focusable="false">
        <ellipse cx="180" cy="214" rx="132" ry="8" fill="#315443" opacity=".06" />
        <path
          d="M31 62Q31 57 38 57H322Q329 57 329 64V202Q329 208 322 208H38Q31 208 31 202Z"
          fill="#f4ead6"
          stroke="#c7b99f"
          strokeWidth="1.2"
        />
        <path d="m32 66 148 93L328 66v136H32Z" fill="#fffaf0" />
        <path d="M32 204 143 127m185 77-111-77" stroke="#d9cbb6" strokeWidth="1.2" />
        <g className={styles.flap}>
          <path d="M32 60h296L190 156q-10 7-20 0Z" fill="#faf1df" stroke="#d4c3a7" strokeWidth="1.2" />
          <path d="m39 64 132 85q9 6 18 0L321 64" stroke="#fffdf7" strokeWidth="2" />
        </g>
        <path d="M180 61v148" stroke="#b8c3a4" strokeWidth="2" />
        <path
          d="M180 142c-28-2-36-17-27-22 13-7 27 22 27 22Zm0 0c27-3 35-18 26-22-13-6-26 22-26 22Z"
          fill="#e2e7d7"
          stroke="#96a786"
          strokeWidth="1.2"
        />
        <g className={styles.seal}>
          <path
            d="M160 147q-3-12 8-18 10-7 20-1 13 2 13 16 3 12-9 19-12 8-22 0-12-3-10-16Z"
            fill="#dba7ac"
            stroke="#b77985"
            strokeWidth="1.2"
          />
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse
              key={angle}
              cx="180"
              cy="140"
              rx="3.8"
              ry="6.4"
              fill="#f7d9d7"
              transform={`rotate(${angle} 180 146)`}
            />
          ))}
          <circle cx="180" cy="146" r="3" fill="#f2d68f" />
        </g>
        <path
          d="M55 182q8-12 9-24m-4 13q-12-2-12-9 10-2 12 9m3-6q11-10 14-5-1 8-14 5"
          fill="#c3cfb2"
          stroke="#849a78"
          strokeWidth="1"
        />
      </svg>
      <span className={styles.address}>for {to || 'you'}</span>
      {from && <span className={styles.sender}>a little something from {from}</span>}
      <span className={styles.action}>
        {opening ? 'opening…' : 'open the garden'} <span aria-hidden>↗</span>
      </span>
      <span className={styles.count}>
        {count} {count === 1 ? 'flower' : 'flowers'}, chosen for you.
      </span>
    </button>
  )
}
