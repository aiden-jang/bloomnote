import { useMemo } from 'react'
import Composer from './components/Composer'
import RecipientView from './components/RecipientView'
import { decodeGarden, type GardenData } from './garden'

/**
 * Two routes:
 *   /g/<encoded>  → recipient view (someone opening a garden you sent)
 *   anything else → composer (idle or remix mode; remix detection lives
 *                   inside Composer because it owns that state)
 */
function readSharedGarden(): GardenData | null {
  const pathMatch = window.location.pathname.match(/^\/g\/(.+)$/)
  if (pathMatch) {
    return decodeGarden(pathMatch[1])
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
