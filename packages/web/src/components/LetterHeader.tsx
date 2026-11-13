import BloomBrand from './BloomBrand'
import { AuthNav } from './AuthNav'
import SoundToggle from './SoundToggle'
import styles from './LetterHeader.module.css'

export default function LetterHeader({ brandHeading = false }: { brandHeading?: boolean }) {
  return (
    <header className={styles.header}>
      {brandHeading ? (
        <h1 className={styles.brand}>
          <BloomBrand />
        </h1>
      ) : (
        <BloomBrand />
      )}
      <div className={styles.controls}>
        <AuthNav inline />
        <SoundToggle inline />
      </div>
    </header>
  )
}
