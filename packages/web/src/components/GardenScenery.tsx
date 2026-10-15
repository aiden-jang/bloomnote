import type { RitualTime } from '../lib/rituals'
import type { Placement } from '../lib/scene'
import styles from './GardenScene.module.css'

const MOOD_AURAS = {
  tender: { className: styles.auraTender, marks: ['♡', '·', '♡', '·', '♡', '·'] },
  playful: { className: styles.auraPlayful, marks: ['✦', '●', '✦', '●', '✦', '●'] },
  wistful: { className: styles.auraWistful, marks: ['·', '◦', '·', '◦', '·', '◦'] },
  celebratory: { className: styles.auraCelebratory, marks: ['✦', '✧', '✦', '✧', '✦', '✧'] },
  steady: { className: styles.auraSteady, marks: ['•', '·', '•', '·', '•', '·'] },
} as const

export function auraFor(mood?: string) {
  // Object.hasOwn, not `in`. See gradientFor in lib/scene.ts for what `in` does with '__proto__'.
  return mood && Object.hasOwn(MOOD_AURAS, mood) ? MOOD_AURAS[mood as keyof typeof MOOD_AURAS] : null
}

// prettier-ignore
export const TIME_SKY: Record<RitualTime, { top: string; bottom: string; weight: number; sun: string; sunStrength: number }> = {
  morning:   { top: '#ffffff', bottom: '#ffffff', weight: 0,    sun: '255, 250, 235', sunStrength: 0.72 },
  afternoon: { top: '#fff6df', bottom: '#fffaf0', weight: 0.12, sun: '255, 248, 226', sunStrength: 0.78 },
  evening:   { top: '#f0a679', bottom: '#f8d9b4', weight: 0.42, sun: '255, 214, 170', sunStrength: 0.62 },
  night:     { top: '#1d2742', bottom: '#33395a', weight: 0.74, sun: '206, 219, 255', sunStrength: 0.20 },
}

/* Hand-placed, no Math.random, so a garden looks the same every time it opens. left %, top %, twinkle delay. */
// prettier-ignore
export const STARS: Array<[number, number, number]> = [
  [8, 14, 0], [21, 31, 1.6], [34, 9, 0.8], [46, 24, 2.4],
  [58, 12, 1.1], [12, 44, 3.1], [67, 34, 0.4], [29, 52, 2.0],
  [52, 44, 1.4], [41, 38, 2.8],
]

// Hand-tuned, no Math.random, so re-renders don't jitter the positions. Colours are filled in
// at render time from the actual flowers.
// prettier-ignore
export const PETAL_DRIFTERS = [
  { startX: 15, driftX:  40, delay:  300, duration: 3800, size:  9, rotate:  25 },
  { startX: 30, driftX: -35, delay:  650, duration: 4200, size: 11, rotate: -40 },
  { startX: 50, driftX:  30, delay: 1000, duration: 3500, size:  8, rotate:  60 },
  { startX: 70, driftX: -45, delay: 1400, duration: 4500, size: 12, rotate: -20 },
  { startX: 82, driftX:  25, delay: 1800, duration: 3700, size: 10, rotate:  45 },
  { startX: 55, driftX: -30, delay: 2200, duration: 4000, size:  9, rotate: -65 },
] as const

export function Bee() {
  return (
    <svg viewBox="0 0 16 11" className={styles.beeBody} aria-hidden>
      <ellipse cx="7" cy="3.4" rx="3.1" ry="2.1" fill="#eaf4ff" opacity="0.75" />
      <ellipse cx="10" cy="3.6" rx="2.6" ry="1.8" fill="#eaf4ff" opacity="0.6" />
      <ellipse cx="8.6" cy="6.4" rx="4.4" ry="3" fill="#f0b429" />
      <path d="M7.2 3.9 A4.4 3 0 0 0 7.2 8.9 Z" fill="#4a3b1a" opacity="0.85" />
      <path d="M10.1 4.3 A4.4 3 0 0 0 10.1 8.5 Z" fill="#4a3b1a" opacity="0.85" />
      <circle cx="4.6" cy="6.4" r="1.5" fill="#4a3b1a" />
      <path
        d="M3.6 4.9 L2.2 3.4 M4.4 4.6 L3.6 2.9"
        stroke="#4a3b1a"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

const SOIL_DETAIL = [
  { x: 4, tuft: true },
  { x: 21, tuft: false },
  { x: 44, tuft: true },
  { x: 58, tuft: false },
  { x: 82, tuft: true },
  { x: 96, tuft: false },
] as const

/* Mounds upward only, never below the flat line. The stems are anchored to the soil surface,
   so a crest that dips leaves them hanging in the air. */
function SoilCrest() {
  return (
    <svg className={styles.crest} viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 6 L0 4 Q6 1.5 13 3.5 Q20 5.5 27 3 Q34 1 41 3.5 Q48 5.5 55 3 Q62 1.5 69 3.5 Q76 5.5 83 3 Q90 1 97 3.5 L100 3 L100 6 Z"
        fill="#a0714f"
      />
    </svg>
  )
}

export function SoilLine() {
  return (
    <div className={styles.soilLine} aria-hidden>
      <SoilCrest />
      {SOIL_DETAIL.map(({ x, tuft }) =>
        tuft ? (
          <svg key={x} className={styles.tuft} style={{ left: `${x}%` }} viewBox="0 0 12 9">
            <path d="M6 9 C5.4 6 4.6 4 3 2.2" className={styles.blade} />
            <path d="M6 9 C6 6.2 6 4.2 6.2 1.6" className={styles.blade} />
            <path d="M6 9 C6.7 6.3 7.6 4.4 9.2 2.8" className={styles.blade} />
          </svg>
        ) : (
          <span key={x} className={styles.pebble} style={{ left: `${x}%` }} />
        ),
      )}
    </div>
  )
}

// prettier-ignore
export const WAIT_SPROUTS: Array<[number, number, number]> = [
  [16, 0.78, 0], [31, 1, 0.55], [50, 0.88, 1.1], [68, 1.05, 0.3], [84, 0.74, 0.85],
]

// prettier-ignore
export const MOTES: Array<[number, number, number]> = [
  [14, 22, 0], [31, 46, 2.7], [48, 16, 5.1], [63, 38, 1.4],
  [77, 27, 3.9], [88, 52, 6.3], [22, 63, 4.6],
]

export function SeedBed({ placements }: { placements: Placement[] }) {
  return (
    <div className={styles.seedBed} aria-hidden>
      {placements.map((p, i) => (
        <span
          key={i}
          className={styles.seed}
          style={{
            left: `${p.left}%`,
            ['--depth' as string]: String(p.depth),
            animationDelay: `${i * 620}ms`,
          }}
        >
          <svg viewBox="0 0 16 22" className={styles.seedSvg}>
            <path
              d="M8 8.4 C 4.8 7.2 3.5 4.2 5.4 2.6 C 7.3 3.7 8 6.1 8 8.4 Z"
              fill={p.spec.stemColor}
              opacity="0.9"
            />
            <ellipse cx="8" cy="14.6" rx="5" ry="6.4" fill={p.spec.petalColors[0]} />
            <ellipse cx="6.3" cy="11.8" rx="1.5" ry="2.2" fill="#fff" opacity="0.38" />
          </svg>
        </span>
      ))}
    </div>
  )
}

export function GhostSprout({ growth }: { growth: 0 | 1 | 2 | 3 }) {
  return (
    <div className={`${styles.ghostSprout} ${styles[`ghostSproutGrowing${growth}`] ?? ''}`} aria-hidden>
      <svg viewBox="0 0 20 60" className={styles.ghostSproutSvg}>
        <line
          x1="10"
          y1="60"
          x2="10"
          y2="20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={styles.ghostStem}
        />
        <path d="M 10 28 Q 18 22, 15 30 Q 12 29, 10 28" fill="currentColor" className={styles.ghostLeaf} />
        <path d="M 10 38 Q 2 31, 5 40 Q 8 40, 10 38" fill="currentColor" className={styles.ghostLeafSecond} />
        <path d="M 10 20 Q 3 14, 6 23 Q 9 23, 10 20" fill="currentColor" className={styles.ghostLeafThird} />
        <circle cx="10" cy="17" r="2.2" className={styles.ghostBud} />
      </svg>
    </div>
  )
}
