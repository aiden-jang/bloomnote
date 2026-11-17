import type { CSSProperties, RefObject } from 'react'
import GiftPacketArt from './GiftPacketArt'
import { FlowerHead } from './FlowerSVG'
import type { FlowerSpec } from '../garden'
import styles from './GiftPacket.module.css'

export const GIFT_OPEN_MS = 440

export default function GiftPacket({
  from,
  to,
  count,
  opening,
  onOpen,
  actionLabel = 'open the garden',
  buttonRef,
  flowers,
}: {
  from: string
  to?: string | undefined
  count: number
  opening: boolean
  onOpen: () => void
  actionLabel?: string
  buttonRef?: RefObject<HTMLButtonElement>
  flowers?: FlowerSpec[] | undefined
}) {
  return (
    <button
      type="button"
      ref={buttonRef}
      className={styles.packet}
      style={{ '--gift-open-ms': `${GIFT_OPEN_MS}ms` } as CSSProperties}
      data-opening={opening}
      onClick={onOpen}
      disabled={opening}
      aria-label={actionLabel}
    >
      <GiftPacketArt />
      <span className={styles.address}>for {to || 'you'}</span>
      {from && <span className={styles.sender}>a little something from {from}</span>}
      <span className={styles.action}>
        {opening ? 'opening…' : actionLabel} <span aria-hidden>↗</span>
      </span>
      {flowers && (
        <span className={styles.contents} aria-hidden="true">
          {flowers.slice(0, 5).map((flower, index) => (
            <FlowerHead key={index} flower={flower} size={26} />
          ))}
        </span>
      )}
      <span className={styles.count}>
        {count} {count === 1 ? 'flower' : 'flowers'}, chosen for you.
      </span>
    </button>
  )
}
