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

export async function designGarden(
  req: DesignRequest,
  callbacks: DesignCallbacks = {},
): Promise<DesignResult> {
  try {
    const res = await fetch('/api/design-garden', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: callbacks.signal ?? null,
    })

    if (!res.ok) {
      // Non-200s come back as JSON error envelopes. Surface the server's message, not the status.
      let message = `Request failed (${res.status})`
      try {
        const body = await res.json()
        if (body && typeof body.error === 'string') message = body.error
      } catch {
        // Body wasn't JSON. Keep the default.
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
  } catch (err) {
    // User cancellations propagate as-is; the Composer checks signal.aborted and stays quiet.
    if (err instanceof Error && err.name === 'AbortError') throw err

    const raw = err instanceof Error ? err.message : String(err)
    console.error('[designGarden] underlying error:', err)
    throw new Error(friendlyError(raw))
  }
}

export function friendlyError(raw: string): string {
  if (
    /high.?demand|model.+is.+currently|model.+overloaded|spikes.+in.+demand|googlegenerativeai.+error|generativelanguage\.googleapis/i.test(
      raw,
    )
  ) {
    return "gemini's a little overwhelmed right now. give it a sec and try again."
  }

  if (/rate.?limit|\b429\b|too.?many.?requests/i.test(raw)) {
    return "bloomnote's rate limit kicked in. give it about a minute and try again."
  }

  if (/quota.?exceeded|generate.?content.?free.?tier|resource.?exhausted/i.test(raw)) {
    return 'bloomnote has reached its daily garden limit. Your note is still here; try again tomorrow.'
  }

  if (/\b404\b|not.?found.?for.?api.?version|model.+not.+found/i.test(raw)) {
    return "the AI model isn't responding right now. try again shortly."
  }

  if (/failed.?to.?fetch|networkerror|network.?request.?failed|err_network/i.test(raw)) {
    return "couldn't reach the server. check your connection and try again."
  }

  if (/timeout|timed.?out|took.?too.?long|took.?longer/i.test(raw)) {
    return 'that took longer than expected. give it another try.'
  }

  if (/gemini_api_key|missing.+api.?key/i.test(raw)) {
    return 'garden growing is temporarily unavailable. Your note is still here; try again later.'
  }

  if (/invalid garden|invalid.+payload|content_sha256/i.test(raw)) {
    return 'the AI got confused on that one. mind trying again, maybe with a slightly different note?'
  }

  if (/did.?not.?return.?a.?garden|stream.?ended.?without.?a.?garden/i.test(raw)) {
    return "the AI didn't return a garden. try again, ideally with a slightly longer or more specific note."
  }

  if (/^request failed \(5\d{2}\)|\b5\d{2}\b|internal.?server.?error|bad.?gateway/i.test(raw)) {
    return 'something broke on our end. try again in a moment.'
  }

  // Long or stack-trace-shaped, so definitely not user-readable.
  if (raw.length > 160 || /\bstack:\s|exception|\bat\s+\w+\s*\(/i.test(raw)) {
    return 'something went wrong. give it another try in a moment.'
  }

  return raw
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
    flowers: server.flowers.map((f) => ({
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
