import { useEffect, useRef, useState } from 'react'
import { flowerHeadOffset } from './FlowerSVG'
import { Bee } from './GardenScenery'
import ClayBee from './ClayBee'
import { occasionTone } from '../lib/occasions'
import { prefersReducedMotion } from '../lib/motion'
import type { Placement } from '../lib/scene'
import styles from './GardenBee.module.css'

export const PETAL_HAT_MS = 4000

export default function GardenBee({
  placements,
  active,
  clay,
  occasion,
}: {
  placements: Placement[]
  active: boolean
  clay: boolean
  occasion?: string | undefined
}) {
  const [at, setAt] = useState(0)
  const [hat, setHat] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [reduced, setReduced] = useState(prefersReducedMotion)
  const [frozen, setFrozen] = useState<{ left: number; bottom: number; edge: string } | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tone = occasionTone(occasion)
  const interactive = clay && tone === 'ordinary'
  const visible = active && placements.length > 0 && tone !== 'sensitive'
  const resting = hat || focused || hovered || reduced

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(preference.matches)
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!visible || resting) return
    const interval = setInterval(() => setAt((index) => (index + 1) % placements.length), 3700)
    return () => clearInterval(interval)
  }, [visible, resting, placements.length])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const toggleHat = () => {
    freeze()
    if (timer.current) clearTimeout(timer.current)
    setHat(!hat)
    if (!hat) timer.current = setTimeout(() => setHat(false), PETAL_HAT_MS)
  }

  // Freeze the displayed position, including an in-flight transition, rather than jumping to its end.
  const freeze = () => {
    const element = host.current
    const parent = element?.parentElement
    if (!element || !parent) return
    const box = element.getBoundingClientRect()
    const bounds = parent.getBoundingClientRect()
    const scale = bounds.width / Math.max(1, parent.clientWidth) || 1
    const left = (box.left + box.width / 2 - bounds.left) / scale
    const percent = (left / Math.max(1, parent.clientWidth)) * 100
    setFrozen({
      left,
      bottom: (bounds.bottom - box.bottom) / scale,
      edge: percent < 25 ? 'start' : percent > 75 ? 'end' : 'center',
    })
  }

  if (!visible || (!interactive && reduced)) return null
  const target = placements[at % placements.length]!
  return (
    <div
      ref={host}
      className={styles.host}
      data-resting={resting}
      data-edge={
        resting && frozen ? frozen.edge : target.left < 25 ? 'start' : target.left > 75 ? 'end' : 'center'
      }
      style={
        resting && frozen
          ? { left: `${frozen.left}px`, bottom: `${frozen.bottom}px` }
          : {
              left: `clamp(22px, calc(${target.left}% + 18px), calc(100% - 22px))`,
              bottom: `${flowerHeadOffset(target.spec) + 8}px`,
            }
      }
    >
      {interactive ? (
        <>
          <button
            type="button"
            className={styles.button}
            aria-label="give the bee a petal hat"
            aria-pressed={hat}
            title="a tiny bee"
            onClick={toggleHat}
            onFocus={() => {
              freeze()
              setFocused(true)
            }}
            onBlur={() => setFocused(false)}
            onMouseEnter={() => {
              freeze()
              setHovered(true)
            }}
            onMouseLeave={() => setHovered(false)}
          >
            <span className={styles.picture}>
              <ClayBee hat={hat} petalColor={target.spec.petalColors[0]} />
            </span>
          </button>
          <span className={styles.caption} role="status">
            {hat ? 'management.' : ''}
          </span>
        </>
      ) : (
        <span className={styles.picture} aria-hidden="true">
          {clay ? <ClayBee /> : <Bee />}
        </span>
      )}
    </div>
  )
}
