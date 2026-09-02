import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadWithReload } from './lazyWithReload'

/** A tab with its own sessionStorage and a reload we can watch. */
function stubWindow(seed?: Record<string, string>) {
  const values = new Map<string, string>(Object.entries(seed ?? {}))
  const reload = vi.fn()
  vi.stubGlobal('window', {
    location: { reload },
    sessionStorage: {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
    },
  })
  return { reload, values }
}

afterEach(() => vi.unstubAllGlobals())

describe('loadWithReload', () => {
  it('passes a successful import straight through', async () => {
    stubWindow()
    const mod = { default: () => null }
    await expect(loadWithReload(() => Promise.resolve(mod))).resolves.toBe(mod)
  })

  it('reloads once when the chunk is gone', async () => {
    const { reload } = stubWindow()
    // The promise never settles on purpose: the reload is what happens next, not a render.
    const pending = loadWithReload(() =>
      Promise.reject(new Error('Failed to fetch dynamically imported module')),
    )
    await Promise.resolve()
    expect(reload).toHaveBeenCalledTimes(1)
    void pending
  })

  /*
   * The failure mode worth guarding. If the reload does not fix it, reloading again on the fresh
   * page is an infinite loop that never shows the person anything.
   */
  it('rethrows instead of reloading again inside the cooldown', async () => {
    const { reload } = stubWindow({ 'bloomnote:chunk-reload': String(Date.now()) })
    await expect(loadWithReload(() => Promise.reject(new Error('still gone')))).rejects.toThrow('still gone')
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads again once the cooldown has passed', async () => {
    const { reload } = stubWindow({ 'bloomnote:chunk-reload': String(Date.now() - 60_000) })
    void loadWithReload(() => Promise.reject(new Error('gone again')))
    await Promise.resolve()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload when sessionStorage is unavailable', async () => {
    const reload = vi.fn()
    vi.stubGlobal('window', {
      location: { reload },
      sessionStorage: {
        getItem: () => {
          throw new Error('private mode')
        },
        setItem: () => {},
      },
    })
    // Fails closed: with no way to record the attempt, a reload could loop forever.
    await expect(loadWithReload(() => Promise.reject(new Error('gone')))).rejects.toThrow('gone')
    expect(reload).not.toHaveBeenCalled()
  })
})
