const STORAGE_KEY = 'bloomnote.quiet.v1'
export const QUIET_MODE_EVENT = 'bloomnote:quiet-mode'

/** Quiet by default, which is the opposite of the usual default and deliberate: the person who
    most needs a journal is the one a tally would turn into a chore. */
export function isQuiet(): boolean {
  try {
    // Only an explicit opt-out turns the numbers on, so a cleared or unavailable store stays quiet.
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setQuiet(quiet: boolean): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, quiet ? 'on' : 'off')
  } catch {
    // Private mode: the preference won't survive a reload, and the fallback is quiet anyway.
  }
  try {
    dispatchEvent(new Event(QUIET_MODE_EVENT))
  } catch {
    // No event target to tell. The caller already has the return value it needs.
  }
  return quiet
}

export function toggleQuiet(): boolean {
  return setQuiet(!isQuiet())
}
