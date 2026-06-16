// The share card shown after a garden is designed. Lives at the
// bottom of the composer's designed phase: URL pill + share/copy/
// re-roll/save/reset action grid + the inline error + schedule
// confirmation rows.
//
// Pulled out of Composer so the orchestration logic over there
// (state machine, handlers) reads independently of the share UI.
// Composer still owns the state; this component is presentational.

import { useEffect } from 'react'
import { prefetchSharedImage, saveSharedImage } from '../lib/saveImage'
import styles from './Composer.module.css'

interface Props {
  shareUrl: string
  gardenId: string | null
  recipient: string
  copied: boolean
  canShare: boolean
  isRerolling: boolean
  errorText: string | null
  statusText: string
  /** True when the sender opted into time-capsule mode. */
  scheduleOpen: boolean
  /** The datetime-local value the sender picked (when scheduled). */
  unlockLocal: string
  onShare: () => void
  onCopy: () => void
  onReroll: () => void
  onStartOver: () => void
}

export default function ShareCard({
  shareUrl,
  gardenId,
  recipient,
  copied,
  canShare,
  isRerolling,
  errorText,
  statusText,
  scheduleOpen,
  unlockLocal,
  onShare,
  onCopy,
  onReroll,
  onStartOver,
}: Props) {
  // Built once so the prefetch effect and the anchors share one source.
  const cardUrl = gardenId ? `/api/card?id=${encodeURIComponent(gardenId)}&download=1` : undefined
  const storyUrl = gardenId ? `/api/story?id=${encodeURIComponent(gardenId)}&download=1` : undefined

  // On iOS the save handler fetches the PNG itself; warm both now so the
  // share sheet opens inside the post-gesture window rather than waiting on
  // a cold render. No-op on desktop/Android (see prefetchSharedImage).
  useEffect(() => {
    if (cardUrl) prefetchSharedImage(cardUrl)
    if (storyUrl) prefetchSharedImage(storyUrl)
  }, [cardUrl, storyUrl])

  return (
    <div className={styles.shareCard}>
      <p className={styles.shareTitle}>
        {recipient ? `${recipient}'s garden is ready` : 'ready to send'}
      </p>
      {/* Re-roll failures land here; idle-phase errors render in a
          different slot during composition. */}
      {errorText && <p className={styles.shareError}>{errorText}</p>}
      {scheduleOpen && unlockLocal && (
        <p className={styles.scheduleConfirm}>
          will open on{' '}
          {new Date(unlockLocal).toLocaleString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      )}
      <div className={styles.urlBox}>
        {/* During reroll, swap the URL with a quiet status pill so the
            card doesn't reflow. */}
        {isRerolling ? (
          <span className={styles.urlStatus}>{statusText || 'replanting…'}</span>
        ) : (
          <span className={styles.urlText}>{shareUrl}</span>
        )}
      </div>
      {/* Three rows of progressively quieter actions:
            primary   — share / copy (the thing the user came here to do)
            secondary — different flowers (iterate before committing)
            tertiary  — save as image / save as story (text links)
            quiet     — make another (destructive; bottom, alone) */}
      <div className={styles.shareActions}>
        <div className={styles.shareActionsPrimary}>
          {canShare && (
            <button className={styles.shareBtn} onClick={onShare} disabled={isRerolling}>
              share
            </button>
          )}
          <button
            className={canShare ? styles.copyBtnSecondary : styles.copyBtn}
            onClick={onCopy}
            disabled={isRerolling}
          >
            {copied ? 'copied' : 'copy link'}
          </button>
        </div>

        <button
          type="button"
          className={styles.rerollBtn}
          onClick={onReroll}
          disabled={isRerolling}
          aria-busy={isRerolling}
        >
          ⟳ different flowers
        </button>

        {/* Save-as links — text-link weight, not button weight. Save
            options are tertiary; making them look like primary actions
            would compete with share. Still real anchors so right-click
            "save link as" works on desktop; on phones the onClick routes
            through the share sheet so the image lands in Photos rather
            than Files (see saveSharedImage). */}
        {gardenId && !isRerolling && (
          <p className={styles.shareDownloads}>
            <a
              href={cardUrl}
              download
              className={styles.shareDownloadLink}
              onClick={e => saveSharedImage(e, 'composer', 'square')}
            >
              save as image
            </a>
            <span className={styles.shareDownloadSep} aria-hidden>·</span>
            <a
              href={storyUrl}
              download
              className={styles.shareDownloadLink}
              onClick={e => saveSharedImage(e, 'composer', 'story')}
            >
              save as story
            </a>
          </p>
        )}

        <button
          className={styles.resetBtn}
          onClick={onStartOver}
          disabled={isRerolling}
        >
          make another
        </button>
      </div>
    </div>
  )
}
