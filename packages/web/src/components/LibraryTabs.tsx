import type { Tab } from '../lib/gardenList'
import styles from './MyGardens.module.css'

export default function LibraryTabs({
  tab,
  sent,
  received,
  onChange,
}: {
  tab: Tab
  sent: number
  received: number
  onChange: (tab: Tab) => void
}) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Garden collection">
      {(['sent', 'received'] as const).map((kind) => (
        <button
          key={kind}
          id={`garden-tab-${kind}`}
          type="button"
          role="tab"
          aria-selected={tab === kind}
          aria-controls="garden-collection"
          tabIndex={tab === kind ? 0 : -1}
          className={tab === kind ? styles.tabActive : styles.tab}
          onClick={() => onChange(kind)}
          onKeyDown={(event) => {
            const next =
              event.key === 'Home'
                ? 'sent'
                : event.key === 'End'
                  ? 'received'
                  : ['ArrowLeft', 'ArrowRight'].includes(event.key)
                    ? tab === 'sent'
                      ? 'received'
                      : 'sent'
                    : null
            if (!next) return
            event.preventDefault()
            onChange(next)
            document.getElementById(`garden-tab-${next}`)?.focus()
          }}
        >
          {kind}
          {(kind === 'sent' ? sent : received) ? ` (${kind === 'sent' ? sent : received})` : ''}
        </button>
      ))}
    </div>
  )
}
