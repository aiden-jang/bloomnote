import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from './motion'

/** Keep the result in the reader's viewport without re-aligning an already visible heading. */
export function useResultHeading(identity?: string) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const heading = ref.current
      if (!heading) return
      heading.focus({ preventScroll: true })
      const bounds = heading.getBoundingClientRect()
      if (bounds.top < 16 || bounds.bottom > window.innerHeight - 16) {
        heading.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'instant' : 'smooth' })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [identity])
  return ref
}
