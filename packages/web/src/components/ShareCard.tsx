// The share card shown after a garden is designed. Lives at the
// bottom of the composer's designed phase: URL pill + share/copy/
// re-roll/save/reset action grid + the inline error + schedule
// confirmation rows.
//
// Pulled out of Composer so the orchestration logic over there
// (state machine, handlers) reads independently of the share UI.
// Composer still owns the state; this component is presentational.

import styles from './Composer.module.css'

interface Props {
  shareUrl: string
  gardenId: string | null
  recipient: string
  copied: boolean
  shareStatus: 'sharing' | 'shared' | null
  imageStatus: 'saving' | 'shared' | 'downloaded' | null
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
  onSaveImage: () => void
  onReroll: () => void
  onStartOver: () => void
}

export default function ShareCard({
  shareUrl,
  recipient,
  copied,
  shareStatus,
  imageStatus,
  canShare,
  isRerolling,
  errorText,
  statusText,
  scheduleOpen,
  unlockLocal,
  onShare,
  onCopy,
  onSaveImage,
  onReroll,
  onStartOver,
}: Props) {
  return (
    <div className={styles.shareCard}>
      <p className={styles.shareTitle}>
        {scheduleOpen ? (recipient ? `${recipient}'s garden is sealed` : 'your garden is sealed') : recipient ? `${recipient}'s garden is ready` : 'ready to send'}
      </p>
      {/* Re-roll failures land here; idle-phase errors render in a
          different slot during composition. */}
      {errorText && <p className={styles.shareError}>{errorText}</p>}
      {scheduleOpen && unlockLocal && (
        <p className={styles.scheduleConfirm}>
          it opens on{' '}
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
          <span className={styles.urlStatus}>{statusText || 'regrowing…'}</span>
        ) : (
          <span className={styles.urlText}>{shareUrl}</span>
        )}
      </div>
      {/* Progressively quieter actions:
            primary   — share / copy (the thing the user came here to do)
            secondary — different flowers (iterate before committing)
            quiet     — make another (destructive; bottom, alone) */}
      <div className={styles.shareActions}>
        <div className={styles.shareActionsPrimary}>
          {canShare && (
            <button className={styles.shareBtn} onClick={onShare} disabled={isRerolling || shareStatus !== null}>
              {shareStatus === 'sharing' ? 'opening…' : shareStatus === 'shared' ? 'shared' : 'share'}
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
          className={styles.copyBtnSecondary}
          onClick={onSaveImage}
          disabled={isRerolling || imageStatus === 'saving'}
        >
          {imageStatus === 'saving'
            ? 'making image…'
            : imageStatus === 'shared'
              ? 'image shared'
              : imageStatus === 'downloaded'
                ? 'image downloaded'
                : 'save as image'}
        </button>

        <button
          type="button"
          className={styles.rerollBtn}
          onClick={onReroll}
          disabled={isRerolling}
          aria-busy={isRerolling}
        >
          ⟳ different flowers
        </button>

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
