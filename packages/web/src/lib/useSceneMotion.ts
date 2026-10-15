import { useEffect, type RefObject } from 'react'
import { prefersReducedMotion } from './motion'

export function useSceneMotion(sceneRef: RefObject<HTMLDivElement>) {
  // Skipped entirely under reduced motion. The CSS variable stays at its 0 fallback, so the
  // petals hold still rather than snapping.
  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let raf = 0
    const onMove = (e: PointerEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const el = sceneRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const inside =
          e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
        const x = inside ? ((e.clientX - r.left) / r.width) * 2 - 1 : 0
        const y = inside ? ((e.clientY - r.top) / r.height) * 2 - 1 : 0
        el.style.setProperty('--px', x.toFixed(3))
        el.style.setProperty('--py', y.toFixed(3))
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [sceneRef])
  useEffect(() => {
    if (prefersReducedMotion()) return

    let raf = 0
    const apply = () => {
      raf = 0
      sceneRef.current?.style.setProperty('--scroll-y', `${window.scrollY}px`)
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(apply)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    // Sync the initial position, so a refresh partway down the page does not start the layer at 0.
    apply()

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [sceneRef])
}
