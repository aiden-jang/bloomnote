import { afterEach, describe, expect, it, vi } from 'vitest'
import { withViewTransition } from './viewTransition'

/** A document with whatever startViewTransition this test needs, or none at all. */
function stubDocument(startViewTransition?: unknown) {
  vi.stubGlobal('document', startViewTransition ? { startViewTransition } : {})
}

afterEach(() => vi.unstubAllGlobals())

describe('withViewTransition', () => {
  it('applies the update directly where the API is missing', () => {
    stubDocument()
    const updater = vi.fn()
    withViewTransition(updater)
    expect(updater).toHaveBeenCalledTimes(1)
  })

  it('applies the update inside the transition callback', () => {
    let callback: (() => void) | null = null
    stubDocument((cb: () => void) => {
      callback = cb
      return {}
    })
    const updater = vi.fn()
    withViewTransition(updater)

    // Not applied until the browser runs the callback, which is the whole point of the API.
    expect(updater).not.toHaveBeenCalled()
    callback!()
    expect(updater).toHaveBeenCalledTimes(1)
  })

  /*
   * The reason this module has a test at all.
   *
   * A rejected `ready` or `finished` with nothing attached is an unhandled rejection, and vitest
   * exits non-zero on one. So there is no assertion here: the run surviving IS the assertion, and
   * deleting either `.catch` in the source breaks it.
   *
   * Read the exit code, not the summary. Vitest still prints "131 passed" for this failure, so a
   * glance at the output looks fine while `pnpm verify` is red.
   */
  it('swallows an aborted transition instead of leaving an unhandled rejection', async () => {
    stubDocument((cb: () => void) => {
      cb()
      return {
        ready: Promise.reject(new Error('Transition was aborted because of invalid state')),
        finished: Promise.reject(new Error('Transition was aborted because of invalid state')),
      }
    })
    const updater = vi.fn()
    withViewTransition(updater)
    expect(updater).toHaveBeenCalledTimes(1)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  it('still applies the update when starting a transition throws outright', () => {
    stubDocument(() => {
      throw new Error('no transitions here')
    })
    const updater = vi.fn()
    withViewTransition(updater)
    expect(updater).toHaveBeenCalledTimes(1)
  })

  it('does not apply the update twice when the throw comes after the callback', () => {
    stubDocument((cb: () => void) => {
      cb()
      throw new Error('threw after updating')
    })
    const updater = vi.fn()
    withViewTransition(updater)
    expect(updater).toHaveBeenCalledTimes(1)
  })
})
