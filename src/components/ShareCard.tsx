// The share card shown after a garden is designed. Lives at the
// bottom of the composer's designed phase: URL pill + share/copy/
// re-roll/save/reset action grid + the inline error + schedule
// confirmation rows.
//
// Pulled out of Composer so the orchestration logic over there
// (state machine, handlers) reads independently of the share UI.
// Composer still owns the state; this component is presentational.

import { trackCardDownloaded } from '../lib/analytics'
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
          <span className={styles.urlStatus}>{statusText || 'regenerating…'}</span>
        ) : (
          <span className={styles.urlText}>{shareUrl}</span>
        )}
      </div>
      <div className={styles.shareActions}>
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
        <button
          type="button"
          className={styles.rerollBtn}
          onClick={onReroll}
          disabled={isRerolling}
          aria-busy={isRerolling}
        >
          different flowers
        </button>
        {/* Anchor (not onClick) so right-click "save link as" works and
            so screenreaders announce these as the file-producing links
            they are. */}
        {gardenId && !isRerolling && (
          <>
            <a
              href={`/api/card?id=${encodeURIComponent(gardenId)}&download=1`}
              download
              className={styles.downloadBtn}
              onClick={() => trackCardDownloaded('composer', 'square')}
            >
              save as image
            </a>
            <a
              href={`/api/story?id=${encodeURIComponent(gardenId)}&download=1`}
              download
              className={styles.downloadBtn}
              onClick={() => trackCardDownloaded('composer', 'story')}
            >
              save as story
            </a>
          </>
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
