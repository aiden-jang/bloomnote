import { useEffect, useRef, useState } from 'react'
import styles from './BouquetNote.module.css'

interface Props {
  /** The AI-written, one-or-two-sentence rationale for the whole
   *  bouquet. */
  note: string
  /**
   * Hold the typing until this flips true. The recipient view passes
   * the post-bloom `msgVisible` flag so the rationale doesn't type
   * itself out before the garden has even opened; the composer preview
   * leaves it at the default (start immediately).
   */
  start?: boolean
}

// Per-character cadence. ~22ms reads as a brisk LLM stream — fast
// enough not to test patience on a two-sentence note, slow enough to
// register as "being written" rather than pasted.
const TYPE_MS = 22

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * The AI's bouquet rationale, presented as part of the note and
 * revealed with a typewriter effect under a "✦ why this garden"
 * label — so the reasoning reads as something the AI is writing for
 * the recipient, not a static caption.
 *
 * Accessibility: the visible text is clipped per-character and hidden
 * from assistive tech (`aria-hidden`); the full note is mirrored in a
 * visually-hidden span so screen readers get the whole sentence at
 * once instead of a stuttering character stream. Reduced-motion users
 * skip the animation and see the full text immediately.
 */
export default function BouquetNote({ note, start = true }: Props) {
  const text = note.trim()
  const reduced = prefersReducedMotion()
  const [count, setCount] = useState(reduced ? text.length : 0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!text) return
    if (reduced) {
      setCount(text.length)
      return
    }
    if (!start) {
      setCount(0)
      return
    }
    setCount(0)
    timerRef.current = setInterval(() => {
      setCount(c => {
        if (c >= text.length) {
          if (timerRef.current) clearInterval(timerRef.current)
          return c
        }
        return c + 1
      })
    }, TYPE_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [text, start, reduced])

  if (!text) return null

  const typing = count < text.length

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>
        <span className={styles.sparkle} aria-hidden>
          ✦
        </span>
        why this garden
      </p>
      <p className={styles.text}>
        <span aria-hidden>{text.slice(0, count)}</span>
        {typing && <span className={styles.cursor} aria-hidden />}
        {/* Full text for screen readers — the visible stream above is
            hidden from them so they hear the sentence, not a stutter. */}
        <span className={styles.srOnly}>{text}</span>
      </p>
    </div>
  )
}
