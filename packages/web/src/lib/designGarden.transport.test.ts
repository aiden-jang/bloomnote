import { afterEach, expect, it, vi } from 'vitest'
import { designGarden } from './designGarden'

const flower = {
  name: 'Cosmos',
  meaning: '수프와 🌿',
  petalColors: ['#b8a0cf', '#cebddf', '#e2d5ec'],
  centerColor: '#d9ac50',
  stemColor: '#78905b',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 95,
}
const frame = `event: complete\ndata: ${JSON.stringify({ garden: { flowers: [flower], bouquet_note: 'For the company.' } })}\n\n`
const request = { message: 'Thanks for the soup.', recipient: 'Sam' }
const encoder = new TextEncoder()

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function openResponse(text: string, signal?: AbortSignal | null, cancel = vi.fn()) {
  return new Response(
    new ReadableStream({
      start(controller) {
        if (text) controller.enqueue(encoder.encode(text))
        signal?.addEventListener('abort', () => controller.error(signal.reason), { once: true })
      },
      cancel,
    }),
  )
}

it('returns a completed design without waiting for the connection to close', async () => {
  const cancel = vi.fn()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openResponse(frame, null, cancel)))
  let settled = false
  const result = designGarden(request).then((value) => {
    settled = true
    return value
  })
  await vi.waitFor(() => expect(settled).toBe(true), { timeout: 200, interval: 5 })
  expect((await result).flowers[0]).toMatchObject(flower)
  expect(cancel).toHaveBeenCalledTimes(1)
})

it('reports a terminal error without waiting for the connection to close', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(openResponse('event: error\ndata: {"error":"model is currently overloaded"}\n\n')),
  )
  let error: Error | undefined
  const result = designGarden(request).catch((value) => {
    error = value as Error
  })
  await vi.waitFor(
    () => expect(error?.message).toBe('Garden growing is busy right now. Try again in a moment.'),
    { timeout: 200, interval: 5 },
  )
  await result
})

it.each(['\n', '\r\n', '\r'])(
  'parses legal line endings %j with UTF-8 characters split across byte chunks',
  async (ending) => {
    const bytes = encoder.encode(frame.replaceAll('\n', ending))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
              controller.close()
            },
          }),
        ),
      ),
    )
    expect((await designGarden(request)).flowers[0]?.meaning).toBe(flower.meaning)
  },
)

function virtualTimeouts() {
  vi.useFakeTimers()
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new DOMException('request timed out', 'TimeoutError')), ms)
    return controller.signal
  })
}

it.each(['headers', 'body'])('recovers when the response stalls before %s finish', async (phase) => {
  virtualTimeouts()
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, options: RequestInit) => {
      if (phase === 'body')
        return Promise.resolve(openResponse('event: thinking\ndata: {}\n\n', options.signal))
      return new Promise((_resolve, reject) =>
        options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true }),
      )
    }),
  )
  let settled = false
  const result = designGarden(request)
    .then(
      () => null,
      (error) => error as Error,
    )
    .then((value) => {
      settled = true
      return value
    })
  await vi.advanceTimersByTimeAsync(90_000)
  expect(settled).toBe(true)
  expect((await result)?.message).toBe('That took too long. Your note is still here. Try again.')
})

it('preserves user cancellation while a response is streaming', async () => {
  const controller = new AbortController()
  const complete = vi.fn()
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, options: RequestInit) => Promise.resolve(openResponse('', options.signal))),
  )
  const result = designGarden(request, { signal: controller.signal, onComplete: complete })
  await Promise.resolve()
  controller.abort()
  await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  expect(complete).not.toHaveBeenCalled()
})
