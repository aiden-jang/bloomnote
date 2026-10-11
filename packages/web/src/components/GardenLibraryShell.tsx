import BloomBrand from './BloomBrand'
import styles from './MyGardens.module.css'

export default function GardenLibraryShell({
  subtitle,
  children,
  hideBackLink = false,
}: {
  subtitle: string
  children: React.ReactNode
  hideBackLink?: boolean
}) {
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <BloomBrand />
        <h1 className={styles.title}>your gardens</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </header>
      {children}
      {!hideBackLink && (
        <footer className={styles.footer}>
          <a href="/" className={styles.backLink}>
            ← grow another
          </a>
        </footer>
      )}
    </div>
  )
}
