/*
 * The service worker, exercised as the file that actually ships.
 *
 * public/sw.js is not a module and cannot import anything, so there is nothing to unit test in the
 * usual sense. Instead this builds the global a worker gets, runs the file inside it, and dispatches
 * the events the browser would. That keeps the test on the real caching rules rather than on a copy
 * of them, which matters because those rules decide whether a deploy strands somebody mid-session.
 */
import { describe, expect, it } from 'vitest'
// `?raw` rather than node:fs, because this is a browser project and its tsconfig carries no Node
// types. Vite hands the file over as a string either way.
import SW_SOURCE from '../../public/sw.js?raw'

type Handler = (event: Record<string, unknown>) => void

/** A fake worker scope, with the caches it opened and the handlers the file registered. */
function runWorker() {
  const handlers = new Map<string, Handler>()
  const stores = new Map<string, Map<string, unknown>>()
  const deleted: string[] = []

  const cacheApi = {
    open: (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)!
      return Promise.resolve({
        add: (url: string) => {
          store.set(url, { added: true })
          return Promise.resolve()
        },
        put: (key: unknown, value: unknown) => {
          store.set(typeof key === 'string' ? key : String((key as { url: string }).url), value)
          return Promise.resolve()
        },
      })
    },
    keys: () => Promise.resolve([...stores.keys()]),
    delete: (name: string) => {
      deleted.push(name)
      stores.delete(name)
      return Promise.resolve(true)
    },
    match: (key: unknown) => {
      const url = typeof key === 'string' ? key : String((key as { url: string }).url)
      for (const store of stores.values()) if (store.has(url)) return Promise.resolve(store.get(url))
      return Promise.resolve(undefined)
    },
  }

  const self = {
    addEventListener: (type: string, fn: Handler) => handlers.set(type, fn),
    skipWaiting: () => {},
    clients: { claim: () => {} },
  }

  /*
   * A network that answers. Without a `fetch` here the worker's navigation branch takes its
   * `.catch` path every time, and the test that checks it refreshes the shell passes without ever
   * running the code it names.
   */
  const fetched: string[] = []
  const fetchImpl = (req: { url: string }) => {
    fetched.push(req.url)
    const response = { url: req.url, fromNetwork: true, clone: () => ({ ...response }) }
    return Promise.resolve(response)
  }

  // The worker reads these off its global scope, so hand it exactly those.
  new Function('self', 'caches', 'URL', 'fetch', SW_SOURCE)(self, cacheApi, URL, fetchImpl)
  return { handlers, stores, deleted, fetched }
}

/** A request the way the worker inspects it: a url, a method and a mode. */
function request(url: string, init: { method?: string; mode?: string } = {}) {
  return { url, method: init.method ?? 'GET', mode: init.mode ?? 'cors' }
}

/** Whatever the fetch handler chose to respond with, or undefined when it passed. */
async function respondTo(handlers: Map<string, Handler>, req: object): Promise<unknown> {
  let responded: unknown
  handlers.get('fetch')!({ request: req, respondWith: (r: unknown) => (responded = r) })
  return responded === undefined ? undefined : await responded
}

describe('service worker', () => {
  it('registers the three lifecycle handlers', () => {
    const { handlers } = runWorker()
    expect([...handlers.keys()].sort()).toEqual(['activate', 'fetch', 'install'])
  })

  /*
   * The rule the whole app depends on. A cached garden read would show a recipient a stale water
   * count, or worse, hand one person's garden to the next visitor on the same browser.
   */
  it('never handles API traffic', async () => {
    const { handlers } = runWorker()
    expect(await respondTo(handlers, request('https://bloomnote.test/api/garden?id=kWzDsL'))).toBeUndefined()
    expect(await respondTo(handlers, request('https://bloomnote.test/api/me'))).toBeUndefined()
  })

  it('leaves anything that is not a GET alone', async () => {
    const { handlers } = runWorker()
    const post = request('https://bloomnote.test/icon-192.png', { method: 'POST' })
    expect(await respondTo(handlers, post)).toBeUndefined()
  })

  /*
   * Navigations go to the network first and refresh the stored shell.
   *
   * Cache-first here is the bug that strands people: the shell references hashed chunk names, so a
   * shell frozen at first install keeps asking for chunks that a later deploy has already replaced.
   */
  it('refreshes the cached shell on every navigation', async () => {
    const { handlers, stores, fetched } = runWorker()
    await handlers.get('install')!({ waitUntil: (p: Promise<unknown>) => p })

    // Install stores the shell with `add`, so this is what a frozen, never-refreshed shell looks like.
    const store = [...stores.values()].find((s) => s.has('/'))!
    expect(store.get('/')).toEqual({ added: true })

    const navigate = request('https://bloomnote.test/g/kWzDsL', { mode: 'navigate' })
    handlers.get('fetch')!({ request: navigate, respondWith: () => {} })
    await new Promise((resolve) => setTimeout(resolve, 0))

    // It went to the network, and what came back replaced the stored shell.
    expect(fetched).toContain('https://bloomnote.test/g/kWzDsL')
    expect(store.get('/')).toMatchObject({ fromNetwork: true })
  })

  /* A version bump has to purge the old cache, or a stale asset outlives the deploy that replaced it. */
  it('deletes every cache but the current one on activate', async () => {
    const { handlers, stores, deleted } = runWorker()
    await handlers.get('install')!({ waitUntil: (p: Promise<unknown>) => p })
    stores.set('bloomnote-v1', new Map([['/old', {}]]))

    await handlers.get('activate')!({ waitUntil: (p: Promise<unknown>) => p })
    expect(deleted).toContain('bloomnote-v1')
    expect([...stores.keys()]).not.toContain('bloomnote-v1')
  })
})
