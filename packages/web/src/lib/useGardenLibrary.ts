/* A thin hook over gardenList.ts, so both archives share one copy of the behaviour rather than two
   that have to be kept in step by hand. */
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  filterGardens,
  orderGardens,
  readPinnedGardens,
  writePinnedGardens,
  type CardData,
  type GardenSort,
} from './gardenList'

export interface GardenLibrary<T> {
  query: string
  setQuery: Dispatch<SetStateAction<string>>
  sort: GardenSort
  setSort: Dispatch<SetStateAction<GardenSort>>
  pinnedOnly: boolean
  setPinnedOnly: Dispatch<SetStateAction<boolean>>
  pinned: string[]
  togglePinned: (id: string) => void
  /** How many of the items in front of the reader are pinned, for the filter's own label. */
  visiblePinned: number
  filtered: T[]
}

export function useGardenLibrary<T extends CardData>(
  items: T[],
  waters: Record<string, number>,
): GardenLibrary<T> {
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') ?? '')
  const [sort, setSort] = useState<GardenSort>(() => {
    const saved = new URLSearchParams(location.search).get('sort')
    return saved === 'oldest' || saved === 'watered' ? saved : 'newest'
  })
  const [pinnedOnly, setPinnedOnly] = useState(
    () => new URLSearchParams(location.search).get('pinned') === '1',
  )
  const [pinned, setPinned] = useState<string[]>(readPinnedGardens)
  useEffect(() => {
    const url = new URL(location.href)
    for (const [key, value] of [
      ['q', query],
      ['sort', sort === 'newest' ? '' : sort],
      ['pinned', pinnedOnly ? '1' : ''],
    ]) {
      if (value) url.searchParams.set(key!, value)
      else url.searchParams.delete(key!)
    }
    history.replaceState(history.state, '', url)
  }, [query, sort, pinnedOnly])

  const togglePinned = (id: string): void => {
    setPinned((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [id, ...current]
      writePinnedGardens(next)
      return next
    })
  }

  const visiblePinned = items.filter((item) => pinned.includes(item.id)).length
  const filtered = useMemo(() => {
    const scoped = pinnedOnly ? items.filter((item) => pinned.includes(item.id)) : items
    return orderGardens(filterGardens(scoped, query), pinned, sort, waters) as T[]
  }, [items, query, pinned, pinnedOnly, sort, waters])

  return {
    query,
    setQuery,
    sort,
    setSort,
    pinnedOnly,
    setPinnedOnly,
    pinned,
    togglePinned,
    visiblePinned,
    filtered,
  }
}
