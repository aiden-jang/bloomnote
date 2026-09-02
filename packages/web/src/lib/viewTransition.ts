//
// flushSync is the load-bearing piece. React 18 batches state updates, but the View Transitions
// API needs the new DOM in place when it takes its snapshot.

import { flushSync } from 'react-dom'

// The TS DOM lib didn't ship startViewTransition typings until 5.4, so feature-detect on a
// widened type rather than forcing a TS version bump on consumers.
type DocumentWithViewTransitions = Document & {
  startViewTransition?: (cb: () => void) => unknown
}

export function withViewTransition(updater: () => void): void {
  const doc = document as DocumentWithViewTransitions
  if (typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(() => {
      flushSync(updater)
    })
  } else {
    updater()
  }
}
