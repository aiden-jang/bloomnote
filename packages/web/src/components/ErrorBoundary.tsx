import { Component, type ErrorInfo, type ReactNode } from 'react'
import notice from './Notice.module.css'

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
      /* The crash screen, on the same card as the other notices. This is what somebody sees
         when everything else has failed, so it should not be built from inline styles. */
      <div className={notice.page}>
        <div className={notice.card}>
          <h1 className={notice.title}>something wilted.</h1>
          <p className={notice.body}>a hiccup on our end. refresh, or start a fresh one.</p>
          <a className={notice.action} href="/">
            grow a new one
          </a>
        </div>
      </div>
    )
  }
}
