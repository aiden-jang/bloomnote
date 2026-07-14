import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

/** Catches render-time crashes so a thrown component doesn't leave a blank page. */
export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          gap: '0.75rem',
          textAlign: 'center',
          padding: '1.5rem',
        }}
      >
        <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem' }}>something wilted.</p>
        <p style={{ color: 'var(--color-ink-muted, #6b6963)', fontSize: '0.95rem' }}>
          a hiccup on our end. refresh, or start a fresh one.
        </p>
        <a
          href="/"
          style={{ marginTop: '1rem', color: 'var(--color-accent, #c2549c)', textDecoration: 'underline' }}
        >
          grow a new one
        </a>
      </div>
    )
  }
}
