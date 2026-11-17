import StationeryArt from './StationeryArt'
import FlowerJournalShelf from './FlowerJournalShelf'
import { buildRemixUrl, type GardenData } from '../garden'
import { trackReplyStarted } from '../lib/analytics'
import { useRecipientKeepsakes } from '../lib/useRecipientKeepsakes'
import styles from './RecipientView.module.css'

export default function RecipientActions({
  gardenData,
  gardenId,
  msgVisible,
  onReplay,
}: {
  gardenData: GardenData
  gardenId: string
  msgVisible: boolean
  onReplay: () => void
}) {
  const { from, message, previous } = gardenData
  const {
    shareStatus,
    imageStatus,
    duetStatus,
    noteCopied,
    shareError,
    handleSaveImage,
    handleSaveDuet,
    handleShareGarden,
    handleCopyNote,
  } = useRecipientKeepsakes(gardenData)
  const remixHref = buildRemixUrl(gardenId)
  const handleReplyClick = () => trackReplyStarted()
  return (
    <div
      className={`${styles.cta} ${msgVisible ? styles.visible : ''}`}
      aria-hidden={!msgVisible}
      style={{ visibility: msgVisible ? 'visible' : 'hidden' }}
    >
      {shareError && (
        <div className={styles.shareFallback}>
          <p role="alert">{shareError}</p>
          <label>
            Garden link
            <input readOnly value={window.location.href} onFocus={(event) => event.currentTarget.select()} />
          </label>
        </div>
      )}
      <a href={remixHref} className={styles.ctaBtn} onClick={handleReplyClick}>
        {from ? `grow ${from} a garden` : 'grow one back'}
      </a>
      <button
        type="button"
        className={styles.ctaShareBtn}
        onClick={(event) => void handleShareGarden(event.currentTarget)}
        disabled={shareStatus !== null}
      >
        {shareStatus === 'sharing'
          ? 'opening sharing…'
          : shareStatus === 'shared'
            ? 'share sheet closed'
            : shareStatus === 'copied'
              ? 'link copied'
              : 'share this garden'}
      </button>
      <details className={styles.keepsake}>
        <summary>
          <StationeryArt kind="bookmark" />
          <span>keep this garden</span>
        </summary>
        <div className={styles.keepsakeActions}>
          {previous && (
            <button
              type="button"
              className={styles.keepsakeAction}
              onClick={() => void handleSaveDuet()}
              disabled={duetStatus !== null}
            >
              {duetStatus === 'saving'
                ? 'making image…'
                : duetStatus === 'shared'
                  ? 'share sheet closed'
                  : duetStatus === 'downloaded'
                    ? 'download started'
                    : 'save both gardens as an image'}
            </button>
          )}
          <button
            type="button"
            className={styles.keepsakeAction}
            onClick={() => void handleSaveImage()}
            disabled={imageStatus !== null}
          >
            {imageStatus === 'saving'
              ? 'making image…'
              : imageStatus === 'shared'
                ? 'share sheet closed'
                : imageStatus === 'downloaded'
                  ? 'download started'
                  : 'save it as an image'}
          </button>
          {message && (
            <button
              type="button"
              className={styles.keepsakeAction}
              onClick={() => void handleCopyNote()}
              disabled={noteCopied}
            >
              {noteCopied ? 'note copied' : 'copy the note'}
            </button>
          )}
          <button type="button" className={styles.keepsakeAction} onClick={() => window.print()}>
            print the garden
          </button>
          <button type="button" className={styles.keepsakeAction} onClick={onReplay}>
            watch it bloom again
          </button>
        </div>
        <FlowerJournalShelf currentGardenId={gardenId} />
      </details>
      <p className={styles.ctaSub}>
        <a href="/" className={styles.ctaSubLink}>
          write one for someone else
        </a>
      </p>
    </div>
  )
}
