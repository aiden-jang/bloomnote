import { useEffect, useRef, useState } from 'react'
import {
  deleteVoiceMemory,
  loadVoiceMemory,
  MAX_SECONDS,
  saveVoiceMemory,
  startRecording,
  voiceMemoryIds,
  type Recording,
  type VoiceMemory,
} from './voiceMemory'

export function useJournalVoice(entryIds: string[]) {
  const root = useRef<HTMLElement>(null)
  const recording = useRef<Recording | null>(null)
  const revision = useRef(0)
  const activeEntry = useRef<string | null>(null)
  const hasEntries = entryIds.length > 0
  const cap = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [recordingFor, setRecordingFor] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [withVoice, setWithVoice] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState<Record<string, VoiceMemory>>({})
  const [error, setError] = useState<{ id: string; text: string } | null>(null)

  function cancel(): void {
    revision.current++
    activeEntry.current = null
    if (cap.current !== null) clearTimeout(cap.current)
    recording.current?.cancel()
    recording.current = null
    setRecordingFor(null)
    setPending(false)
  }

  useEffect(() => {
    let alive = true
    void voiceMemoryIds().then((ids) => {
      if (alive) setWithVoice(ids)
    })
    const details = root.current?.closest('details')
    const onToggle = (): void => {
      if (details?.open) return
      cancel()
      root.current?.querySelectorAll('audio').forEach((audio) => audio.pause())
    }
    details?.addEventListener('toggle', onToggle)
    return () => {
      alive = false
      cancel()
      details?.removeEventListener('toggle', onToggle)
    }
  }, [hasEntries])

  useEffect(() => {
    if (activeEntry.current && !entryIds.includes(activeEntry.current)) cancel()
  }, [entryIds, recordingFor])

  async function begin(entryId: string): Promise<void> {
    cancel()
    const request = revision.current
    activeEntry.current = entryId
    setPending(true)
    setError(null)
    try {
      const active = await startRecording()
      if (
        request !== revision.current ||
        !root.current?.isConnected ||
        root.current.closest('details')?.open === false
      ) {
        active.cancel()
        return
      }
      recording.current = active
      setRecordingFor(entryId)
      cap.current = setTimeout(() => void finish(entryId), MAX_SECONDS * 1000)
    } catch {
      if (request === revision.current)
        setError({ id: entryId, text: 'no microphone, or permission was declined.' })
    } finally {
      if (request === revision.current) setPending(false)
    }
  }

  async function finish(entryId: string): Promise<void> {
    const active = recording.current
    recording.current = null
    if (cap.current !== null) clearTimeout(cap.current)
    setRecordingFor(null)
    if (!active) return
    const result = await active.stop()
    if (!result) return
    const memory: VoiceMemory = { entryId, ...result, savedAt: new Date().toISOString() }
    if (await saveVoiceMemory(memory)) {
      setLoaded((current) => ({ ...current, [entryId]: memory }))
      setWithVoice((current) => new Set(current).add(entryId))
    } else setError({ id: entryId, text: 'could not keep that recording on this device.' })
  }

  async function play(entryId: string): Promise<void> {
    if (loaded[entryId]) return
    const memory = await loadVoiceMemory(entryId)
    if (memory) setLoaded((current) => ({ ...current, [entryId]: memory }))
    else setError({ id: entryId, text: 'could not open this voice memory. Try again.' })
  }

  async function remove(entryId: string): Promise<void> {
    if (!(await deleteVoiceMemory(entryId))) {
      setError({ id: entryId, text: 'could not remove this voice memory. Try again.' })
      return
    }
    setError(null)
    setLoaded((current) => {
      const next = { ...current }
      delete next[entryId]
      return next
    })
    setWithVoice((current) => {
      const next = new Set(current)
      next.delete(entryId)
      return next
    })
  }

  return { root, recording, recordingFor, pending, withVoice, loaded, error, begin, finish, play, remove }
}
