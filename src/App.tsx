import { useMemo } from 'react'
import Composer from './components/Composer'
import RecipientView from './components/RecipientView'
import { decodeGarden, type GardenData } from './garden'

export default function App() {
  const gardenData: GardenData | null = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('garden')
    if (!encoded) return null
    return decodeGarden(encoded)
  }, [])

  if (gardenData) {
    return <RecipientView gardenData={gardenData} />
  }

  return <Composer />
}
