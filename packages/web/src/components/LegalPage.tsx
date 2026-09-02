import notice from './Notice.module.css'
import styles from './LegalPage.module.css'

interface Section {
  heading: string
  body: string
}

const UPDATED = 'July 13, 2026'

const PRIVACY: Section[] = [
  {
    heading: 'what you give us',
    body: 'When you make a garden you type a short note (who it is for, the occasion, a mood, and your message). That text is sent to Google (Gemini) to design the garden, and the finished garden is saved so it can be opened from its link. No account is required to do any of this.',
  },
  {
    heading: 'where it goes',
    body: 'Your note is processed by Google (Gemini) to generate the flowers; send only what you are comfortable sharing with that service. The garden is stored by Cloudflare (KV) under an unguessable short id, so anyone with the link can open it. We do not sell your data, and there are no advertising trackers. Analytics, if any, are aggregate and cookieless.',
  },
  {
    heading: 'accounts are optional',
    body: 'bloomnote works fully signed out. Signing in (through the shared aidenjang sign-in) only adds a synced archive of the gardens you have sent and received, tied to your account so you can find them again across devices.',
  },
  {
    heading: 'keeping and deleting',
    body: 'A garden stays until it is removed. To delete a garden, or your account and everything attached to it, email privacy@aidenjang.com and it is done. You can also ask for a copy of what we hold.',
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
    body: 'A garden is viewable by anyone who has its link. Share the link only with the people you mean to.',
  },
  {
    heading: 'contact',
    body: 'Questions or takedown requests: privacy@aidenjang.com.',
  },
]

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const title = kind === 'privacy' ? 'privacy' : 'terms'
  const sections = kind === 'privacy' ? PRIVACY : TERMS

  return (
    <div className={notice.page}>
      {/* Colour rather than opacity throughout this page. Dimming a full-strength colour drops legal
          copy under the contrast threshold. */}
      <a href="/" className={styles.back}>
        &larr; bloomnote
      </a>
      <div className={notice.card}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.updated}>Last updated: {UPDATED}</p>
        {sections.map((s) => (
          <section key={s.heading} className={styles.section}>
            <h2 className={styles.heading}>{s.heading}</h2>
            <p className={styles.body}>{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
