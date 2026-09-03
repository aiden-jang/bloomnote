import { useCallback, useEffect, useRef, useState } from 'react'
import { buildShareUrl, createShortGarden, type FlowerSpec, type GardenData } from '../garden'
import { buildMineRecord, classifyError } from './composerHelpers'
import {
  trackGardenCanceled,
  trackGardenError,
  trackGardenGenerated,
  trackGardenRerolled,
  trackMakeAnother,
} from './analytics'
import { designGarden, type DesignResult } from './designGarden'
import { uploadOgImage } from './gardenImage'
import { recordSentGarden, updateSentGardenId } from './mine'
import { withViewTransition } from './viewTransition'
import { playSuccess, playWhoosh } from '../sound'
import type { Draft } from './draft'

export type Phase = 'idle' | 'designing' | 'designed'

const THINKING_MESSAGES = [
  'reading between the lines…',
  'choosing flowers…',
  'mixing the palette…',
  'arranging the bouquet…',
  'writing the note…',
]

const SHORTEN_TIMEOUT_MS = 3000

const request = (fields: Draft): Parameters<typeof designGarden>[0] => ({
  message: fields.message.trim(),
  recipient: fields.recipient.trim(),
  from: fields.from.trim() || undefined,
  occasion: fields.occasion,
  mood: fields.mood,
})

export interface GardenDesign {
  phase: Phase
  statusText: string
  errorText: string | null
  garden: DesignResult | null
  flowers: FlowerSpec[]
  shareUrl: string | null
  gardenId: string | null
  isRerolling: boolean
  start: (fields: Draft, onSaved: () => void) => Promise<void>
  cancel: () => void
  reroll: (fields: Draft) => Promise<void>
  startOver: (resetTheForm: () => void) => void
}

/*
 * The design lifecycle: write a note, wait, get a garden and a link, or reroll it.
 *
 * The note arrives as an argument rather than being closed over, because the draft hook needs
 * `phase` to know when to stop restoring, so it has to be built after this one.
 */
export function useGardenDesign(remixSeed: GardenData | undefined): GardenDesign {
  const [phase, setPhase] = useState<Phase>('idle')
  const [statusText, setStatusText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [rerollAttempt, setRerollAttempt] = useState(0)
  const [isRerolling, setIsRerolling] = useState(false)
  const [garden, setGarden] = useState<DesignResult | null>(null)
  const [flowers, setFlowers] = useState<FlowerSpec[]>([])
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [gardenId, setGardenId] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  // The button doesn't unmount until the view transition swaps the DOM, so without this a
  // fast second tap runs designGarden twice.
  const designingRef = useRef(false)

  useEffect(() => {
    if (!thinking) return
    let i = 0
    setStatusText(THINKING_MESSAGES[0]!)
    const id = setInterval(() => {
      i = (i + 1) % THINKING_MESSAGES.length
      setStatusText(THINKING_MESSAGES[i]!)
    }, 2500)
    return () => clearInterval(id)
  }, [thinking])

  useEffect(() => {
    if (phase !== 'designing') setThinking(false)
  }, [phase])

  const buildGardenData = useCallback(
    (fields: Draft, result: DesignResult): GardenData => {
      // Clamp a time that has already passed, or the capsule ships already unlocked. The
      // 30-second grace matches the server.
      let unlockAt: string | undefined
      if (fields.scheduleOpen && fields.unlockLocal) {
        const t = new Date(fields.unlockLocal).getTime()
        if (Number.isFinite(t) && t > Date.now() + 30_000) {
          unlockAt = new Date(t).toISOString()
        }
      }
      // Cap reply depth at 1. The recipient view only renders one level back, and without the
      // strip a long thread nests a garden per reply.
      const seedForPrevious = remixSeed ? { ...remixSeed, previous: undefined } : undefined
      return {
        flowers: result.flowers,
        bouquetNote: result.bouquetNote,
        message: fields.message.trim(),
        ...(fields.secret.trim() ? { secret: fields.secret.trim() } : {}),
        from: fields.from.trim(),
        to: fields.recipient.trim(),
        createdAt: new Date().toISOString(),
        unlockAt,
        occasion: fields.occasion,
        mood: fields.mood,
        previous: seedForPrevious,
      }
    },
    [remixSeed],
  )

  const start = useCallback(
    async (fields: Draft, onSaved: () => void) => {
      if (designingRef.current) return
      designingRef.current = true
      setRerollAttempt(0)
      withViewTransition(() => {
        setPhase('designing')
        setErrorText(null)
        setStatusText('reading the room…')
      })

      const ctrl = new AbortController()
      abortRef.current = ctrl
      const startedAt = performance.now()

      try {
        playWhoosh()
        const result = await designGarden(request(fields), {
          signal: ctrl.signal,
          onThinking: () => setThinking(true),
        })
        setGarden(result)
        setFlowers(result.flowers)

        const data = buildGardenData(fields, result)

        // Don't fall back to a self-contained URL here. It costs the user the garden they waited
        // five seconds for, but a share link that silently half-works is worse.
        setThinking(false)
        setStatusText('wrapping it up…')

        const shortId = await Promise.race([
          createShortGarden(data, ctrl.signal),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), SHORTEN_TIMEOUT_MS)),
        ])
        if (!shortId) throw new Error("couldn't save your garden. try again?")

        // Only once it is saved. Clearing on the way out would take the note with it when
        // generation fails, which is the one thing this screen must not do.
        onSaved()

        /* Not awaited. It costs a canvas rasterize and a round trip, and nobody should wait on
           the link preview to get their link. */
        void uploadOgImage(shortId, {
          flowers: result.flowers,
          from: fields.from.trim(),
          to: fields.recipient.trim(),
        })

        recordSentGarden(buildMineRecord(shortId, data))

        playSuccess()
        withViewTransition(() => {
          setShareUrl(buildShareUrl(shortId))
          setGardenId(shortId)
          setStatusText('')
          setPhase('designed')
        })

        // Structural metadata only. Never the note text or the names.
        trackGardenGenerated({
          occasion: fields.occasion,
          mood: fields.mood,
          flowerCount: result.flowers.length,
          hasFromName: fields.from.trim().length > 0,
          isRemix: !!remixSeed,
          durationMs: Math.round(performance.now() - startedAt),
        })
      } catch (err) {
        if (ctrl.signal.aborted) {
          withViewTransition(() => setPhase('idle'))
          trackGardenCanceled()
          return
        }
        withViewTransition(() => {
          setErrorText(err instanceof Error ? err.message : 'something went wrong.')
          setPhase('idle')
        })
        // Bucket by error shape. Raw model error text can carry pieces of the user's note.
        trackGardenError(classifyError(err))
      } finally {
        abortRef.current = null
        designingRef.current = false
      }
    },
    [buildGardenData, remixSeed],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reroll = useCallback(
    async (fields: Draft) => {
      if (isRerolling) return
      const previous = { garden, flowers, shareUrl, gardenId }
      const restore = (): void => {
        setGarden(previous.garden)
        setFlowers(previous.flowers)
        setShareUrl(previous.shareUrl)
        setGardenId(previous.gardenId)
        setStatusText('')
      }

      setIsRerolling(true)
      setStatusText('regrowing…')
      setErrorText(null)

      const ctrl = new AbortController()
      abortRef.current = ctrl
      const startedAt = performance.now()
      const attempt = rerollAttempt + 1

      try {
        const result = await designGarden(request(fields), { signal: ctrl.signal })
        const data = buildGardenData(fields, result)

        const shortId = await createShortGarden(data, ctrl.signal)
        if (!shortId) throw new Error("couldn't save the new garden. try again?")

        void uploadOgImage(shortId, {
          flowers: result.flowers,
          from: fields.from.trim(),
          to: fields.recipient.trim(),
        })
        updateSentGardenId(previous.gardenId, buildMineRecord(shortId, data))

        // No extra orchestration: GardenScene re-keys on the flower signature, so the new flowers
        // re-bloom from sprout on their own.
        setGarden(result)
        setFlowers(result.flowers)
        setShareUrl(buildShareUrl(shortId))
        setGardenId(shortId)
        setStatusText('')
        setRerollAttempt(attempt)

        trackGardenRerolled({ attempt, durationMs: Math.round(performance.now() - startedAt) })
      } catch (err) {
        restore()
        if (ctrl.signal.aborted) return
        setErrorText(err instanceof Error ? err.message : 'something went wrong.')
        trackGardenError(classifyError(err))
      } finally {
        abortRef.current = null
        setIsRerolling(false)
      }
    },
    [buildGardenData, isRerolling, garden, flowers, shareUrl, gardenId, rerollAttempt],
  )

  const startOver = useCallback((resetTheForm: () => void) => {
    withViewTransition(() => {
      setPhase('idle')
      setGarden(null)
      setFlowers([])
      setShareUrl(null)
      setGardenId(null)
      setErrorText(null)
      setRerollAttempt(0)
      resetTheForm()
    })
    trackMakeAnother()
  }, [])

  return {
    phase,
    statusText,
    errorText,
    garden,
    flowers,
    shareUrl,
    gardenId,
    isRerolling,
    start,
    cancel,
    reroll,
    startOver,
  }
}
