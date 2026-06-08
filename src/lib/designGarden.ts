// Frontend client for the /api/design-garden SSE endpoint.
//
// We use the streaming protocol mainly so the model's adaptive thinking
// + tool generation don't show up as one long pause to the user. As
// chunks arrive we surface a coarse progress count (how many flowers
// we've seen names for so far), which is enough to make the wait feel
// alive without exposing raw deltas.

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
  onProgress?: (designedCount: number) => void
  onComplete?: (result: DesignResult) => void
  onError?: (message: string) => void
  signal?: AbortSignal
}

interface DesignRequest {
  message: string
  recipient: string
  from?: string
  /** One of the keys from src/lib/occasions.ts → OCCASIONS. */
  occasion?: string
}

/**
 * POST the request to /api/design-garden and parse the SSE stream.
 * Returns the final result; the callbacks fire as events arrive. If the
 * stream errors, we throw a useful message rather than leaking SSE
 * mechanics into UI code.
 */
export async function designGarden(
  req: DesignRequest,
  callbacks: DesignCallbacks = {},
): Promise<DesignResult> {
  const res = await fetch('/api/design-garden', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal: callbacks.signal,
  })

  if (!res.ok) {
    // Non-200s come back as JSON error envelopes — try to surface the
    // server's message rather than just the status code.
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body && typeof body.error === 'string') message = body.error
    } catch {
      // Body wasn't JSON — keep the default.
    }
    throw new Error(message)
  }

  if (!res.body) throw new Error('No response body.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: DesignResult | null = null
  let errorMessage: string | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line.
    let frameBoundary = buffer.indexOf('\n\n')
    while (frameBoundary !== -1) {
      const frame = buffer.slice(0, frameBoundary)
      buffer = buffer.slice(frameBoundary + 2)
      frameBoundary = buffer.indexOf('\n\n')

      const event = parseFrame(frame)
      if (!event) continue

      switch (event.event) {
        case 'start':
          callbacks.onStart?.()
          break
        case 'thinking':
          callbacks.onThinking?.()
          break
        case 'progress':
          if (typeof event.data?.designed === 'number') {
            callbacks.onProgress?.(event.data.designed)
          }
          break
        case 'complete':
          if (event.data?.garden) {
            result = normalize(event.data.garden as ServerPayload)
            callbacks.onComplete?.(result)
          }
          break
        case 'error':
          errorMessage = typeof event.data?.error === 'string' ? event.data.error : 'Unknown error.'
          callbacks.onError?.(errorMessage)
          break
      }
    }
  }

  if (errorMessage) throw new Error(errorMessage)
  if (!result) throw new Error('Stream ended without a garden.')
  return result
}

interface ParsedEvent {
  event: string
  data: Record<string, unknown> | null
}

function parseFrame(frame: string): ParsedEvent | null {
  let eventName = 'message'
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
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
    flowers: server.flowers.map(f => ({
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
