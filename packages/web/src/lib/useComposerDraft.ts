/* The fields and their persistence are one responsibility: every field feeds the autosave, and
   clear and undo have to move all of them together or the form ends up half reset. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GardenData } from '../garden'
import { DEFAULT_MOOD } from './moods'
import { DEFAULT_OCCASION } from './occasions'
import { draftStorageKey, readStoredDraft, removeStoredDraft, writeStoredDraft, type Draft } from './draft'

/** How long the undo offer stands after a clear. */
const UNDO_MS = 8000
/** How long the "your draft is still here" line stays before it stops being useful. */
const RECOVERED_NOTICE_MS = 5000

export interface ComposerDraft {
  fields: Draft
  set: {
    from: (v: string) => void
    recipient: (v: string) => void
    message: (v: string) => void
    secret: (v: string) => void
    occasion: (v: string) => void
    mood: (v: string) => void
    scheduleOpen: (v: boolean) => void
    unlockLocal: (v: string) => void
  }
  /** True once any field carries something, trimmed so a space does not count. */
  hasDraft: boolean
  showRecovered: boolean
  undoDraft: Draft | null
  clear: () => void
  undoClear: () => void
  dismissUndo: () => void
  /** Drop the stored copy without touching the fields, once a garden is safely shared. */
  forget: () => void
  reset: () => void
  applyExample: (example: Omit<Draft, 'secret' | 'scheduleOpen' | 'unlockLocal'>) => void
}

const EMPTY: Draft = {
  from: '',
  recipient: '',
  message: '',
  secret: '',
  occasion: DEFAULT_OCCASION,
  mood: DEFAULT_MOOD,
  scheduleOpen: false,
  unlockLocal: '',
}

export function useComposerDraft(input: {
  remixSeed?: GardenData | undefined
  idle: boolean
}): ComposerDraft {
  const { remixSeed, idle } = input
  const [recovered] = useState<Draft | null>(() => readStoredDraft())
  const [showRecovered, setShowRecovered] = useState(() => recovered !== null)
  const storageKey = useRef(draftStorageKey())

  // A recovered draft beats a remix seed: it is what this person typed. Read once at mount, or it
  // fights whatever they have since edited.
  const [fields, setFields] = useState<Draft>(() => {
    if (recovered) return { ...EMPTY, ...recovered, occasion: recovered.occasion || EMPTY.occasion }
    if (remixSeed) return { ...EMPTY, from: remixSeed.to ?? '', recipient: remixSeed.from ?? '' }
    return EMPTY
  })

  useEffect(() => {
    if (!showRecovered) return
    const timer = window.setTimeout(() => setShowRecovered(false), RECOVERED_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [showRecovered])

  const forget = useCallback(() => {
    try {
      removeStoredDraft(storageKey.current)
    } catch {
      // Best-effort. A storage failure must never block the flow.
    }
  }, [])

  const hasDraft =
    fields.from.trim().length > 0 ||
    fields.recipient.trim().length > 0 ||
    fields.message.trim().length > 0 ||
    fields.secret.trim().length > 0

  // Saved while they type rather than on a debounce, which can miss the last keystroke before a
  // refresh. Only while idle: once a garden exists the draft is no longer what is on screen.
  useEffect(() => {
    if (!idle) return
    if (!hasDraft) {
      removeStoredDraft(storageKey.current)
      return
    }
    writeStoredDraft(storageKey.current, fields)
  }, [idle, hasDraft, fields])

  const [undoDraft, setUndoDraft] = useState<Draft | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setFields((current) => {
      setUndoDraft(current)
      return EMPTY
    })
    forget()
    undoTimer.current = setTimeout(() => {
      setUndoDraft(null)
      undoTimer.current = null
    }, UNDO_MS)
  }, [forget])

  const undoClear = useCallback(() => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current)
      undoTimer.current = null
    }
    setUndoDraft((snapshot) => {
      if (snapshot) setFields(snapshot)
      return null
    })
  }, [])

  const dismissUndo = useCallback(() => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current)
      undoTimer.current = null
    }
    setUndoDraft(null)
  }, [])

  const applyExample = useCallback((example: Omit<Draft, 'secret' | 'scheduleOpen' | 'unlockLocal'>) => {
    setFields({ ...EMPTY, ...example })
  }, [])

  // Built once. A fresh setter each render defeats every useCallback depending on one, and makes
  // any effect listing them run every render.
  const set = useMemo(() => {
    const field =
      <K extends keyof Draft>(key: K) =>
      (value: Draft[K]): void =>
        setFields((current) => ({ ...current, [key]: value }))
    return {
      from: field('from'),
      recipient: field('recipient'),
      message: field('message'),
      secret: field('secret'),
      occasion: field('occasion'),
      mood: field('mood'),
      scheduleOpen: field('scheduleOpen'),
      unlockLocal: field('unlockLocal'),
    }
  }, [])

  const reset = useCallback(() => setFields(EMPTY), [])

  return {
    fields,
    set,
    reset,
    hasDraft,
    showRecovered,
    undoDraft,
    clear,
    undoClear,
    dismissUndo,
    forget,
    applyExample,
  }
}
