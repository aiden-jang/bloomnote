/* On a fresh visit the plot cycles real example gardens, because an empty one was 320px of nothing.
   Once somebody starts writing it becomes their own, growing with the note. */
import { useCallback, useEffect, useState } from 'react'
import { EXAMPLE_GARDENS } from '../data/exampleGardens'
import type { FlowerSpec } from '../garden'
import { prefersReducedMotion } from './motion'

/** Long enough to be looked at rather than watched. */
const CYCLE_MS = 7000

export interface HeroDemo {
  flowers: FlowerSpec[]
  occasion: string
  mood: string
  /** How much of a note exists, so the empty plot can grow with it. */
  draftGrowth: 0 | 1 | 2 | 3
  /** The example on screen, or undefined once it is the person's own garden. */
  activeId: string | undefined
  /** Point at a card to hold the cycle on it; null lets it resume. */
  preview: (id: string | null) => void
  sceneKey: string
}

export function useHeroDemo(input: {
  showDemo: boolean
  flowers: FlowerSpec[]
  occasion: string
  mood: string
  message: string
  gardenSignature: string | null
}): HeroDemo {
  const { showDemo, flowers, occasion, mood, message, gardenSignature } = input
  const [index, setIndex] = useState(0)
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    // Pausing on a pointed-at card matters: without it the plot swaps out from under somebody who
    // deliberately asked to look at one.
    if (!showDemo || previewId || prefersReducedMotion()) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % EXAMPLE_GARDENS.length), CYCLE_MS)
    return () => clearInterval(timer)
  }, [showDemo, previewId])

  const preview = useCallback((id: string | null) => {
    setPreviewId(id)
    if (id === null) return
    const i = EXAMPLE_GARDENS.findIndex((g) => g.id === id)
    if (i >= 0) setIndex(i)
  }, [])

  const demo = EXAMPLE_GARDENS[index % EXAMPLE_GARDENS.length]!
  const written = message.trim().length

  return {
    flowers: showDemo ? demo.flowers : flowers,
    occasion: showDemo ? demo.occasion : occasion,
    mood: showDemo ? demo.mood : mood,
    draftGrowth: written === 0 ? 0 : written < 40 ? 1 : written < 130 ? 2 : 3,
    activeId: showDemo ? demo.id : undefined,
    preview,
    // The demo id has to be in the key: two examples can share a flower-name signature, and the
    // second would appear fully grown instead of growing in.
    sceneKey: showDemo ? `demo-${demo.id}` : (gardenSignature ?? 'empty'),
  }
}
