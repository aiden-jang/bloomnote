// Model failures are mapped to readable recovery messages before reaching the composer.

import type { FlowerSpec } from '../garden'

export interface DesignResult {
  bouquetNote: string
  flowers: FlowerSpec[]
}

interface ServerFlower {
  name: string
  meaning: string
  petalColors: [string, string, string]
  centerColor: string
  stemColor: string
  petalShape: FlowerSpec['petalShape']
  petalCount: number
  stemHeight: number
}

interface ServerPayload {
  bouquet_note: string
  flowers: ServerFlower[]
}

export interface DesignCallbacks {
  onStart?: () => void
  onThinking?: () => void
  onComplete?: (result: DesignResult) => void
  onError?: (message: string) => void
  signal?: AbortSignal
}

interface DesignRequest {
  message: string
  recipient: string
  from?: string | undefined
  occasion?: string | undefined
  mood?: string
}

// Three bounded provider attempts can take about a minute; the client also needs an outer deadline.
const DESIGN_TIMEOUT_MS = 75_000
// CRLF is one line ending, not two; the negative lookahead prevents backtracking into a false blank line.
const FRAME_BOUNDARY = /(?:\r\n|\n|\r(?!\n)){2}/

export async function designGarden(
  req: DesignRequest,
  callbacks: DesignCallbacks = {},
): Promise<DesignResult> {
  // Use a concrete controller: WebKit can leave fetch pending when a composite signal aborts.
  const transport = new AbortController()
  const cancel = () => transport.abort(callbacks.signal?.reason)
  callbacks.signal?.addEventListener('abort', cancel, { once: true })
  if (callbacks.signal?.aborted) cancel()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    transport.abort()
  }, DESIGN_TIMEOUT_MS)
  try {
    const res = await fetch('/api/design-garden', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: transport.signal,
    })

    if (!res.ok) {
      let message = `Request failed (${res.status})`
      try {
        const body = await res.json()
        if (body && typeof body.error === 'string') message = body.error
      } catch {
        // A non-JSON failure still has a usable status.
      }
      throw new Error(message)
    }
    if (!res.body) throw new Error('No response body.')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let boundary = FRAME_BOUNDARY.exec(buffer)
        while (boundary) {
          const frame = buffer.slice(0, boundary.index)
          buffer = buffer.slice(boundary.index + boundary[0].length)
          boundary = FRAME_BOUNDARY.exec(buffer)
          const event = parseFrame(frame)
          if (!event) continue
          switch (event.event) {
            case 'start':
              callbacks.onStart?.()
              break
            case 'thinking':
              callbacks.onThinking?.()
              break
            case 'complete':
              if (event.data?.garden) {
                const result = normalize(event.data.garden as ServerPayload)
                callbacks.onComplete?.(result)
                return result
              }
              break
            case 'error': {
              const message = typeof event.data?.error === 'string' ? event.data.error : 'Unknown error.'
              callbacks.onError?.(message)
              throw new Error(message)
            }
          }
        }
      }
      throw new Error('Stream ended without a garden.')
    } finally {
      // Terminal events finish the operation. Closing their transport must not delay the saved gift.
      void reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  } catch (err) {
    if (callbacks.signal?.aborted) throw err
    const raw = timedOut ? 'request timed out' : err instanceof Error ? err.message : String(err)
    throw new Error(friendlyError(raw), { cause: err })
  } finally {
    clearTimeout(timer)
    callbacks.signal?.removeEventListener('abort', cancel)
  }
}

export function friendlyError(raw: string): string {
  if (/quota.?exceeded|generate.?content.?free.?tier|resource.?exhausted|at capacity for today/i.test(raw))
    return 'Garden growing has reached its daily limit. Your note is still here. Try again later.'
  if (/rate.?limit|\b429\b|too.?many.?requests/i.test(raw))
    return 'Too many requests just now. Wait a little and try again.'
  if (
    /high.?demand|model.+is.+currently|model.+overloaded|spikes.+in.+demand|too many people planting at once|(?:googlegenerativeai|generativelanguage\.googleapis).+503/i.test(
      raw,
    )
  )
    return 'Garden growing is busy right now. Try again in a moment.'
  if (/failed.?to.?fetch|networkerror|network.?request.?failed|err_network/i.test(raw))
    return 'Couldn’t reach Bloomnote. Check your connection and try again.'
  if (/timeout|timed.?out|took.?too.?long|took.?longer/i.test(raw))
    return 'That took too long. Your note is still here. Try again.'
  if (/gemini_api_key|missing.+api.?key/i.test(raw))
    return 'Garden growing is temporarily unavailable. Your note is still here. Try again later.'
  if (
    /invalid garden|invalid.+payload|content_sha256|did.?not.?return.?a.?garden|stream.?ended.?without.?a.?garden|came back empty-handed|no response body/i.test(
      raw,
    )
  )
    return 'Couldn’t finish this garden. Your note is still here. Try again.'
  // Only known validation messages are safe to pass through; model failures can quote the note.
  if (['write something first.', 'keep it under 400 chars.', 'who is this for?'].includes(raw)) return raw
  return 'Couldn’t grow the garden right now. Your note is still here. Try again.'
}

interface ParsedEvent {
  event: string
  data: Record<string, unknown> | null
}

function parseFrame(frame: string): ParsedEvent | null {
  let eventName = 'message'
  const dataLines: string[] = []
  for (const line of frame.split(/\r\n|\r|\n/)) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (dataLines.length === 0) return { event: eventName, data: null }
  try {
    return { event: eventName, data: JSON.parse(dataLines.join('\n')) }
  } catch {
    return null
  }
}

function normalize(server: ServerPayload): DesignResult {
  return {
    bouquetNote: server.bouquet_note,
    flowers: server.flowers.map((f) => ({
      artVersion: 3,
      name: f.name,
      meaning: f.meaning,
      petalColors: f.petalColors,
      centerColor: f.centerColor,
      stemColor: f.stemColor,
      petalShape: f.petalShape,
      petalCount: f.petalCount,
      stemHeight: f.stemHeight,
    })),
  }
}
