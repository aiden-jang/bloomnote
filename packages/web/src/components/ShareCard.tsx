import styles from './Composer.module.css'

interface Props {
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
      <p className={styles.readyEyebrow}>ready for their inbox</p>
      <p className={styles.shareTitle}>
        {scheduleOpen
          ? recipient
            ? `${recipient}'s garden is sealed`
            : 'your garden is sealed'
          : recipient
            ? `${recipient}'s garden is ready`
            : 'ready to send'}
      </p>
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
          })}
        </p>
      )}
      <div className={styles.urlBox}>
        {isRerolling ? (
          <span className={styles.urlStatus}>{statusText || 'regrowing…'}</span>
        ) : (
          <span className={styles.urlText}>{shareUrl}</span>
        )}
      </div>
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
                ? 'image downloaded'
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
  )
}
