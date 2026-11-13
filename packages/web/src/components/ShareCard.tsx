import type { ReactNode } from 'react'
import styles from './GardenResult.module.css'

interface Props {
  scene: ReactNode
  shareUrl: string
  recipient: string
  copied: boolean
  shareStatus: 'sharing' | 'shared' | null
  imageStatus: 'saving' | 'shared' | 'downloaded' | null
  canShare: boolean
  shareError: string | null
  isRerolling: boolean
  errorText: string | null
  statusText: string
  scheduleOpen: boolean
  unlockLocal: string
  onShare: () => void
  onCopy: () => void
  onSaveImage: () => void
  onReroll: () => void
  onStartOver: () => void
}

export default function ShareCard({
  scene,
  shareUrl,
  recipient,
  copied,
  shareStatus,
  imageStatus,
  canShare,
  shareError,
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
      <h2 className={styles.shareTitle}>
        {recipient ? `${recipient}'s garden` : 'Your garden'}
        <em> {scheduleOpen ? 'is sealed' : 'is ready'}</em>
      </h2>
      <p className={styles.scheduleConfirm}>
        Nothing has been sent. Share the link with {recipient.trim() || 'your person'} when you’re ready.
      </p>
      <div className={styles.garden}>{scene}</div>
      <div className={styles.paper}>
        {/* Re-roll failures land here; idle-phase errors render in a different slot during composition. */}
        {(errorText || shareError) && (
          <p className={styles.shareError} role="alert">
            {errorText || shareError}
          </p>
        )}
        {scheduleOpen && unlockLocal && (
          <p className={styles.scheduleConfirm}>
            it opens on{' '}
            {new Date(unlockLocal).toLocaleString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              year: 'numeric',
              timeZoneName: 'short',
            })}
          </p>
        )}
        {isRerolling ? (
          <div className={styles.urlBox}>
            <span className={styles.urlStatus} role="status">
              {statusText || 'regrowing…'}
            </span>
          </div>
        ) : (
          <label className={styles.urlBox}>
            <span className={styles.urlLabel}>Garden link</span>
            <input
              className={styles.urlText}
              value={shareUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        )}
        <div className={styles.shareActions}>
          <div className={styles.shareActionsPrimary}>
            {canShare && (
              <button
                className={styles.shareBtn}
                onClick={onShare}
                disabled={isRerolling || shareStatus !== null}
              >
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
                  ? 'download started'
                  : 'save as image'}
          </button>

          <div className={styles.shareMore}>
            <button
              type="button"
              className={styles.rerollBtn}
              onClick={onReroll}
              disabled={isRerolling}
              aria-busy={isRerolling}
            >
              ⟳ different flowers
            </button>

            <button className={styles.resetBtn} onClick={onStartOver} disabled={isRerolling}>
              make another
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
