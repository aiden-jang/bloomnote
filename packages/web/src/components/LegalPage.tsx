import BloomBrand from './BloomBrand'
import { AUTH_ORIGIN } from '../auth/AuthContext'
import styles from './LegalPage.module.css'

interface Section {
  heading: string
  body: string
}

const UPDATED = 'November 10, 2026'

const PRIVACY: Section[] = [
  {
    heading: 'what you give us',
    body: 'When you make a garden you type a short note (who it is for, the occasion, a mood, and your message). That text is sent to Google (Gemini) to design the garden, and the finished garden is saved so it can be opened from its link. No account is required to do any of this.',
  },
  {
    heading: 'where it goes',
    body: 'Your note is processed by Google (Gemini) to generate the flowers; send only what you are comfortable sharing with that service. The garden is stored by Cloudflare (KV) under a random short id, so anyone with the link can open it. Messaging apps that preview the link can show the sender’s and recipient’s names and a picture of the garden before anyone opens it. We do not sell your data, and there are no advertising trackers. Aggregate traffic and feature events use fixed labels such as the page type, occasion, mood and number of flowers. Notes, names, garden links and garden IDs are excluded from these analytics.',
  },
  {
    heading: 'accounts are optional',
    body: 'bloomnote works fully signed out. Optional sign-in through Accounts uses a session cookie and adds a synced archive of sent and received gardens. Anonymous library entries, pinned gardens and flower memories stay on this device; working drafts use tab storage. Optional voice memories require microphone permission and stay in this browser’s local database, separate from the shared garden.',
  },
  {
    heading: 'keeping and deleting',
    body: 'Garden links do not expire. Removing an entry from your library removes that listing, while its shared garden link keeps working. Deleting an Accounts identity does not automatically delete Bloomnote’s stored gardens or data on this device. You can clear this browser’s local data, or contact privacy@aidenjang.com to request a copy or removal of stored garden data.',
  },
  {
    heading: 'your backup file',
    body: 'Your gardens has a JSON backup and restore tool for the gardens currently in your library. A backup can include replies, secret notes, response counts and device preferences. If you choose to include voice memories, recordings from this device are copied into the downloaded file. Keep that file private. Restoring while signed in saves labelled garden copies to that account with new shareable links; it does not overwrite original gifts. Voice recordings restore only into this browser, without being uploaded.',
  },
  {
    heading: 'the usual',
    body: 'bloomnote is not meant for anyone under 13. If this policy changes in a way that matters, the date above changes with it. Questions go to privacy@aidenjang.com.',
  },
]

const TERMS: Section[] = [
  {
    heading: 'what this is',
    body: 'bloomnote is a small, free thing for sending someone a note as a garden. It is provided as-is, with no warranty, and it may change or go away.',
  },
  {
    heading: 'your words are yours',
    body: 'You are responsible for what you write. Do not use bloomnote for anything illegal, abusive, or harassing, and do not put someone else’s private information in a note. Content that crosses that line may be removed.',
  },
  {
    heading: 'links are public',
    body: 'Anyone with a garden link can open it. A preview in a messaging app can show the names and the garden picture before someone opens the link. Share the link only with the people you mean to.',
  },
  {
    heading: 'contact',
    body: 'Questions or takedown requests: privacy@aidenjang.com.',
  },
]

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const title = kind === 'privacy' ? 'privacy' : 'terms'
  const sections = (kind === 'privacy' ? PRIVACY : TERMS).map((section) => ({
    ...section,
    id: section.heading.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  }))

  return (
    <div className={styles.document}>
      <header className={styles.brandRow}>
        <BloomBrand />
      </header>
      <article>
        <header>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.updated}>Last updated: {UPDATED}</p>
        </header>
        <details className={styles.contents}>
          <summary>On this page</summary>
          <nav aria-label={`${title} sections`}>
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.heading}
              </a>
            ))}
          </nav>
        </details>
        {sections.map((section) => (
          <section key={section.id} id={section.id} className={styles.section}>
            <h2 className={styles.heading}>{section.heading}</h2>
            <p className={styles.body}>{section.body}</p>
          </section>
        ))}
        <a className={styles.accountPolicy} href={new URL(`/${kind}`, AUTH_ORIGIN).href}>
          Accounts {title}
        </a>
      </article>
    </div>
  )
}
