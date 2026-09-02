/*
 * Waters and feelings for a list of gardens, in one request. Shared by both archives: without it a
 * sender with no account only learns a garden was watered by reopening that exact link.
 */
import { useEffect, useState } from 'react'
import { fetchResponsesBatch, type Feeling } from './water'

export interface GardenResponses {
  waters: Record<string, number>
  feelings: Record<string, Partial<Record<Feeling, number>>>
}

export function useGardenResponses(ids: string[]): GardenResponses {
  const [waters, setWaters] = useState<Record<string, number>>({})
  const [feelings, setFeelings] = useState<Record<string, Partial<Record<Feeling, number>>>>({})

  // Keyed on the joined ids, not the array, which is rebuilt every render. Merged rather than
  // replaced, so switching tabs and back does not refetch what is already known.
  const idKey = ids.join(',')
  useEffect(() => {
    if (!idKey) return
    let cancelled = false
    void fetchResponsesBatch(idKey.split(',')).then((responses) => {
      if (cancelled) return
      setWaters((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.entries(responses).map(([id, r]) => [id, r.waters])),
      }))
      setFeelings((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.entries(responses).map(([id, r]) => [id, r.feelings])),
      }))
    })
    return () => {
      cancelled = true
    }
  }, [idKey])

  return { waters, feelings }
}
