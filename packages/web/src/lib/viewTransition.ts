// Wraps a batch of state updates in a View Transition. Browsers that
// implement the API (Chrome 111+, Firefox 145+, Safari 18+) cross-fade
// the old and new DOM automatically; older browsers get plain updates
// and still work — the feature degrades silently.
//
// flushSync is the load-bearing piece: React 18 batches state updates,
// but the View Transitions API needs the new DOM to be in place when
// the snapshot is taken. flushSync forces the update synchronously
// inside the transition callback.

import { flushSync } from 'react-dom'

// TS DOM lib didn't ship startViewTransition typings until 5.4. We
// feature-detect on a widened type instead of relying on the lib so we
// don't force a TS version bump on consumers.
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
