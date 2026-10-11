import styles from './BloomBrand.module.css'

export default function BloomBrand() {
  return (
    <a className={styles.brand} href="/" aria-label="bloomnote home">
      bloomnote<span aria-hidden>✳</span>
    </a>
  )
}
