import { FlowerHead } from './FlowerSVG'

// A quiet paper mark, separate from the flowers chosen for someone's note.
export default function PaperFlower() {
  return (
    <FlowerHead
      size={30}
      flower={{
        artVersion: 3,
        name: 'Cosmos',
        meaning: '',
        petalColors: ['#efe4c6', '#f7efd9', '#fff9e9'],
        centerColor: '#dfb95c',
        stemColor: '#799269',
        petalShape: 'round',
        petalCount: 8,
        stemHeight: 80,
      }}
    />
  )
}
