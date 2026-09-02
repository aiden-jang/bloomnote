import { useCallback, useEffect, useRef, useState } from 'react'
import type { FlowerSpec } from '../garden'
import { saveGardenImage } from './gardenImage'
import { trackCardDownloaded, trackShareLinkCopied, trackShareLinkShared } from './analytics'

export interface ShareActions {
  copied: boolean
  shareStatus: 'sharing' | 'shared' | null
  imageStatus: 'saving' | 'shared' | 'downloaded' | null
  canShare: boolean
  handleCopy: () => void
  handleShare: () => Promise<void>
  handleSaveImage: () => Promise<void>
}

const FLASH_MS = 2500

export function useShareActions(
  shareUrl: string | null,
  recipient: string,
  from: string,
  flowers: FlowerSpec[],
): ShareActions {
  const [copied, setCopied] = useState(false)
  const [shareStatus, setShareStatus] = useState<'sharing' | 'shared' | null>(null)
  const [imageStatus, setImageStatus] = useState<'saving' | 'shared' | 'downloaded' | null>(null)

  // Detected in an effect, not at render: `typeof navigator` can throw under some SSR pre-renders,
  // and a share button that does nothing is worse than no button.
  const [canShare, setCanShare] = useState(false)
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  const savingImageRef = useRef(false)

  const handleCopy = useCallback(() => {
    if (!shareUrl) return
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), FLASH_MS)
    })
    trackShareLinkCopied()
  }, [shareUrl])

  const handleShare = useCallback(async () => {
    if (!shareUrl) return
    setShareStatus('sharing')
    const data: ShareData = {
      title: 'bloomnote',
      text: recipient.trim() ? `A garden for ${recipient.trim()}` : 'A garden for you',
      url: shareUrl,
    }
    try {
      await navigator.share(data)
      setShareStatus('shared')
      window.setTimeout(() => setShareStatus(null), FLASH_MS)
      trackShareLinkShared()
    } catch (err) {
      setShareStatus(null)
      // Closing the sheet is a decision, not a failure. Anything else still leaves Copy.
      if (err instanceof Error && err.name === 'AbortError') return
    }
  }, [shareUrl, recipient])

  const handleSaveImage = useCallback(async () => {
    if (!flowers.length || savingImageRef.current) return
    savingImageRef.current = true
    setImageStatus('saving')
    try {
      const result = await saveGardenImage({ flowers, from: from.trim(), to: recipient.trim() })
      if (result === 'dismissed') {
        setImageStatus(null)
        return
      }
      setImageStatus(result)
      if (result === 'downloaded') trackCardDownloaded('composer', 'square')
      window.setTimeout(() => setImageStatus(null), FLASH_MS)
    } catch {
      setImageStatus(null)
    } finally {
      savingImageRef.current = false
    }
  }, [flowers, from, recipient])

  return { copied, shareStatus, imageStatus, canShare, handleCopy, handleShare, handleSaveImage }
}
