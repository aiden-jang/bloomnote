import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <a href="https://www.aidenjang.com" target="_blank" rel="noreferrer">
        made by aiden jang
      </a>
      <nav aria-label="Bloomnote policies">
        <a href="/privacy">privacy</a>
        <a href="/terms">terms</a>
      </nav>
    </footer>
  )
}
