import { afterEach, describe, expect, it, vi } from 'vitest'
import { claimGardens, removeFromAccount } from './account'

/*
 * The caller deletes its on-device copy of every id it hands over, so "claimed nothing" and
 * "could not ask" have to be different answers. Collapsing them into 0 meant a failed request
 * deleted the only record that those gardens were ever this person's.
 */
afterEach(() => vi.unstubAllGlobals())

const respond = (init: ResponseInit, body: unknown = {}) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), init)),
  )

describe('claimGardens', () => {
  it('reports how many were adopted', async () => {
    respond({ status: 200 }, { claimed: 3 })
    expect(await claimGardens(['a', 'b', 'c'])).toBe(3)
  })

  it('reports null when the server refuses, rather than zero', async () => {
    respond({ status: 401 })
    expect(await claimGardens(['a'])).toBeNull()
  })

  it('reports null when the request never lands', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline')
      }),
    )
    expect(await claimGardens(['a'])).toBeNull()
  })

  it('asks nothing when there is nothing to claim', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await claimGardens([])).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('removing an account garden', () => {
  it('confirms a successful removal', async () => {
    respond({ status: 200 }, { ok: true })
    await expect(removeFromAccount('AbCdEf')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith(
      '/api/garden/AbCdEf',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    )
  })

  it.each([401, 429, 503])('reports a refused removal (%i)', async (status) => {
    respond({ status })
    await expect(removeFromAccount('AbCdEf')).rejects.toThrow('Could not remove the garden.')
  })

  it('reports a request that never reached the account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')))
    await expect(removeFromAccount('AbCdEf')).rejects.toThrow()
  })
})
