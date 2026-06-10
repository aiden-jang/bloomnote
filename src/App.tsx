import { useMemo } from 'react'
import Composer from './components/Composer'
import RecipientView from './components/RecipientView'
import { decodeGarden, type GardenData } from './garden'

/**
 * Two routes:
 *   /g/<encoded>  → recipient view (someone opening a garden you sent)
 *   anything else → composer (idle or remix mode; remix detection lives
 *                   inside Composer because it owns that state)
 *
 * Backwards compatibility: a `?garden=<encoded>` query param is still
 * honored so any pre-existing TinyURLs that point at the old URL shape
 * keep working. Remove this fallback once all in-circulation share
 * URLs have aged out.
 */
function readSharedGarden(): GardenData | null {
  // Path-based route: /g/<encoded>
  const pathMatch = window.location.pathname.match(/^\/g\/(.+)$/)
  if (pathMatch) {
    return decodeGarden(pathMatch[1])
  }
  // Legacy query-string route: ?garden=<encoded>
  const encoded = new URLSearchParams(window.location.search).get('garden')
  if (encoded) {
    return decodeGarden(encoded)
  }
  return null
}

export default function App() {
  const gardenData: GardenData | null = useMemo(readSharedGarden, [])

  if (gardenData) {
    return <RecipientView gardenData={gardenData} />
  }
  return <Composer />
}
