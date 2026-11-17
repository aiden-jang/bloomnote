import type { GardenData } from '../garden'
import { useResultHeading } from '../lib/useResultHeading'
import { supportsViewTransition } from '../lib/viewTransition'
import ComposerPreview from './ComposerPreview'
import styles from './GardenResult.module.css'

interface Props {
  garden: GardenData
  gardenId: string
  shareUrl: string
  copied: boolean
  shareStatus: 'sharing' | 'shared' | null
  imageStatus: 'saving' | 'shared' | 'downloaded' | null
  canShare: boolean
  shareError: string | null
  isRerolling: boolean
  errorText: string | null
  statusText: string
  onShare: () => void
  onCopy: () => void
  onSaveImage: () => void
  onReroll: () => void
  onStartOver: () => void
}

export default function ShareCard({
  garden,
  gardenId,
  shareUrl,
  copied,
  shareStatus,
  imageStatus,
  canShare,
  shareError,
  isRerolling,
  errorText,
  statusText,
  onShare,
  onCopy,
  onSaveImage,
  onReroll,
  onStartOver,
}: Props) {
  const recipient = garden.to?.trim() || ''
  const unlockAt = garden.unlockAt
  const headingRef = useResultHeading(gardenId)
  return (
    <div className={styles.shareCard} data-result-entrance={!supportsViewTransition()}>
      <h2 className={styles.shareTitle} ref={headingRef} tabIndex={-1}>
        {recipient ? `${recipient}’s garden` : 'Your garden'}
        <em> {unlockAt ? 'opens later' : 'is ready'}</em>
      </h2>
      <p className={styles.scheduleConfirm}>
        Share the link with {recipient.trim() || 'your person'} when you’re ready.
      </p>
      {unlockAt && (
        <p className={styles.scheduleConfirm}>
          Their link opens{' '}
          {new Date(unlockAt).toLocaleString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            year: 'numeric',
            timeZoneName: 'short',
          })}
          . You can preview the opening now.
        </p>
      )}
      {!isRerolling && <ComposerPreview key={gardenId} garden={garden} gardenId={gardenId} />}
      <div className={styles.paper}>
        {/* Re-roll failures land here; idle-phase errors render in a different slot during composition. */}
        {(errorText || shareError) && (
          <p className={styles.shareError} role="alert">
            {errorText || shareError}
          </p>
        )}
        <div className={styles.shareActionsPrimary}>
          {canShare && (
            <button
              className={styles.shareBtn}
              onClick={onShare}
              disabled={isRerolling || shareStatus !== null}
            >
              {shareStatus === 'sharing'
                ? 'opening sharing…'
                : shareStatus === 'shared'
                  ? 'share sheet closed'
                  : 'share garden'}
            </button>
          )}
          <button
            className={canShare ? styles.copyBtnSecondary : styles.copyBtn}
            onClick={onCopy}
            disabled={isRerolling}
          >
            {copied ? 'link copied' : 'copy link'}
          </button>
        </div>
        {isRerolling ? (
          <div className={styles.urlBox}>
            <span className={styles.urlStatus} role="status">
              {statusText || 'choosing different flowers…'}
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
          <button
            type="button"
            className={styles.copyBtnSecondary}
            onClick={onSaveImage}
            disabled={isRerolling || imageStatus === 'saving'}
          >
            {imageStatus === 'saving'
              ? 'making image…'
              : imageStatus === 'shared'
                ? 'share sheet closed'
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
              different flowers
            </button>

            <button className={styles.resetBtn} onClick={onStartOver} disabled={isRerolling}>
              make another
            </button>
          </div>
        </div>
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-describedby="external-link-hint"
          className={styles.fullRevealPreview}
        >
          open recipient link <span aria-hidden>↗</span>
        </a>
      </div>
    </div>
  )
}
