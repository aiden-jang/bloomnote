import LetterHeader from './LetterHeader'
import styles from './MyGardens.module.css'

export default function GardenLibraryShell({
  subtitle,
  children,
  hideWriteLink = false,
}: {
  subtitle: string
  children: React.ReactNode
  hideWriteLink?: boolean
}) {
  return (
    <div className={styles.wrap} data-letter-page="library">
      <LetterHeader />
      <div className={styles.body}>
        <header className={styles.header}>
          <h1 className={styles.title}>Your gardens.</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {!hideWriteLink && (
            <a href="/" className={styles.writeLink}>
              write a note
            </a>
          )}
        </header>
        {children}
      </div>
    </div>
  )
}
