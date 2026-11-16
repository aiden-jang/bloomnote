import type { Feeling } from '../lib/water'

export default function FeelingMark({ kind }: { kind: Feeling }) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <g stroke="#7e6a62" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'love' ? (
          <path
            d="M12 20S3 14.5 3 8.7C3 3.4 10 3.5 12 7c2-3.5 9-3.6 9 1.7C21 14.5 12 20 12 20Z"
            fill="#e8bac2"
          />
        ) : kind === 'comfort' ? (
          <>
            <path
              d="M6 17a4 4 0 0 1-1-7.8A5.4 5.4 0 0 1 15 6.5a4.3 4.3 0 0 1 4 8.1A3 3 0 0 1 17 17Z"
              fill="#e1e6db"
            />
            <path d="M9 12h.1m5.8 0h.1m-6 2q3 2 6 0" />
          </>
        ) : kind === 'joy' ? (
          <>
            {[0, 72, 144, 216, 288].map((angle) => (
              <ellipse
                key={angle}
                cx="12"
                cy="6.6"
                rx="3.2"
                ry="5"
                fill="#eddaac"
                transform={`rotate(${angle} 12 12)`}
              />
            ))}
            <circle cx="12" cy="12" r="3.5" fill="#dba7ac" />
          </>
        ) : (
          <>
            <path d="M12 19C4 17 1 11 4 6c6 0 9 6 8 13Z" fill="#c0cdae" />
            <path d="M12 19c8-2 11-8 8-13-6 0-9 6-8 13Z" fill="#dce3d0" />
            <path d="m6 9 6 10 6-10" />
            <path d="M12 13S7 10 8 7.5c1-2 3-1.5 4 0 1-1.5 3-2 4 0 1 2.5-4 5.5-4 5.5Z" fill="#e8bac2" />
          </>
        )}
      </g>
    </svg>
  )
}
