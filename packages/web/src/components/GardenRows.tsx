import { useLayoutEffect, useRef, useState } from 'react'
import GardenRow from './GardenRow'
import type { CardData, Tab } from '../lib/gardenList'
import type { GardenResponses } from '../lib/useGardenResponses'
import styles from './MyGardens.module.css'

const PAGE_SIZE = 24

export default function GardenRows({
  records,
  kind,
  waters,
  feelings,
  pinned,
  onPin,
  onRemove,
}: GardenResponses & {
  records: CardData[]
  kind: Tab
  pinned: string[]
  onPin: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [count, setCount] = useState(PAGE_SIZE)
  const listRef = useRef<HTMLUListElement>(null)
  const nextFocus = useRef<number | null>(null)
  const pinnedIds = new Set(pinned)
  useLayoutEffect(() => {
    if (nextFocus.current === null) return
    listRef.current?.children[nextFocus.current]?.querySelector('a')?.focus()
    nextFocus.current = null
  }, [count])

  return (
    <>
      <ul className={styles.list} ref={listRef}>
        {records.slice(0, count).map((record) => (
          <GardenRow
            key={record.id}
            record={record}
            kind={kind}
            waters={waters[record.id] ?? 0}
            feelings={feelings[record.id] ?? {}}
            pinned={pinnedIds.has(record.id)}
            onPin={() => onPin(record.id)}
            onRemove={() => onRemove(record.id)}
          />
        ))}
      </ul>
      {records.length > count && (
        <button
          type="button"
          className={styles.moreGardens}
          onClick={() => {
            nextFocus.current = count
            setCount((value) => value + PAGE_SIZE)
          }}
        >
          show more gardens ({Math.min(PAGE_SIZE, records.length - count)})
        </button>
      )}
    </>
  )
}
