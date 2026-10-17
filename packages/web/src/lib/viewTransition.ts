//
// flushSync is the load-bearing piece. React 18 batches state updates, but the View Transitions
// API needs the new DOM in place when it takes its snapshot.

import { flushSync } from 'react-dom'

// The TS DOM lib didn't ship startViewTransition typings until 5.4, so feature-detect on a
// widened type rather than forcing a TS version bump on consumers.
type ViewTransitionLike = {
  ready?: Promise<unknown>
  finished?: Promise<unknown>
}
type DocumentWithViewTransitions = Document & {
  startViewTransition?: (cb: () => void) => ViewTransitionLike | undefined
}

export function withViewTransition(updater: () => void): void {
  const doc = document as DocumentWithViewTransitions
  if (typeof doc.startViewTransition !== 'function') {
    updater()
    return
  }

  let applied = false
  try {
    const transition = doc.startViewTransition(() => {
      applied = true
      flushSync(updater)
    })
    // Superseded/hidden transitions can reject after updating the DOM; consume those presentation errors.
    transition?.ready?.catch(() => {})
    transition?.finished?.catch(() => {})
  } catch {
    // Thrown before the callback ran, so the update is still owed. After it ran, it is already done
    // and calling again would apply it twice.
    if (!applied) updater()
  }
}
