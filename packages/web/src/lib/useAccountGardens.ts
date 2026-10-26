import { useCallback, useEffect, useRef, useState } from 'react'
import { claimGardens, fetchMine, removeFromAccount, type GardenSummary } from './account'
import { loadSentGardens, removeSentGarden } from './mine'

type Entry = { item: GardenSummary; index: number }
type Removal = { id: string; sent?: Entry; received?: Entry }

function restoreEntry(items: GardenSummary[], entry: Entry): GardenSummary[] {
  if (items.some((item) => item.id === entry.item.id)) return items
  const next = [...items]
  next.splice(Math.min(entry.index, next.length), 0, entry.item)
  return next
}

/** Account loading and undoable removals retain server confirmation and recovery together. */
export function useAccountGardens() {
  const [sent, setSent] = useState<GardenSummary[]>([])
  const [received, setReceived] = useState<GardenSummary[]>([])
  const [busy, setBusy] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [pending, setPending] = useState<Removal | null>(null)
  const [removalError, setRemovalError] = useState(false)
  const active = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRemoval = useRef<Removal | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setBusy(true)
      setLoadError(false)
      const localIds = loadSentGardens().map((record) => record.id)
      if (localIds.length > 0) {
        const claimed = await claimGardens(localIds)
        if (claimed !== null) localIds.forEach(removeSentGarden)
      }
      try {
        const mine = await fetchMine()
        if (cancelled) return
        setSent(mine.sent)
        setReceived(mine.received)
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [retry])

  const restore = useCallback((removal: Removal) => {
    if (removal.sent) setSent((items) => restoreEntry(items, removal.sent!))
    if (removal.received) setReceived((items) => restoreEntry(items, removal.received!))
  }, [])

  const flushPending = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const removal = pendingRemoval.current
    pendingRemoval.current = null
    if (!removal) return
    if (active.current) setPending(null)
    void removeFromAccount(removal.id).catch(() => {
      if (!active.current) return
      restore(removal)
      setRemovalError(true)
    })
  }, [restore])

  useEffect(() => {
    active.current = true
    window.addEventListener('pagehide', flushPending)
    return () => {
      window.removeEventListener('pagehide', flushPending)
      active.current = false
      flushPending()
    }
  }, [flushPending])

  const remove = (id: string) => {
    flushPending()
    setRemovalError(false)
    const sentIndex = sent.findIndex((item) => item.id === id)
    const receivedIndex = received.findIndex((item) => item.id === id)
    if (sentIndex < 0 && receivedIndex < 0) return
    // The server removes both index entries when the same garden is in both collections.
    const removal: Removal = {
      id,
      ...(sentIndex >= 0 ? { sent: { item: sent[sentIndex]!, index: sentIndex } } : {}),
      ...(receivedIndex >= 0 ? { received: { item: received[receivedIndex]!, index: receivedIndex } } : {}),
    }
    setSent((items) => items.filter((item) => item.id !== id))
    setReceived((items) => items.filter((item) => item.id !== id))
    pendingRemoval.current = removal
    setPending(removal)
    timer.current = setTimeout(flushPending, 6000)
  }

  const undo = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (pendingRemoval.current) restore(pendingRemoval.current)
    pendingRemoval.current = null
    setPending(null)
  }

  return {
    sent,
    received,
    busy,
    loadError,
    pending,
    removalError,
    remove,
    undo,
    retryLoad: () => setRetry((value) => value + 1),
    dismissRemovalError: () => setRemovalError(false),
  }
}
