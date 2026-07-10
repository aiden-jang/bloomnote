// Frontend client for the /api/design-garden SSE endpoint.
//
// The streaming protocol mainly buys us HTTP-timeout safety while the
// model thinks — the SSE events `start` / `thinking` / `complete` let
// us surface "something is happening" without pretending to track
// real per-token progress.
//
// All thrown errors are translated through `friendlyError()` before
// leaving this module so the Composer never has to show "[Google-
// GenerativeAI Error]: ..." or a 200-character stack trace to the
// user. The original message is logged to console for debugging.

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
  /** One of the keys from src/lib/occasions.ts → OCCASIONS. */
  occasion?: string | undefined
  /**
   * One of the keys from src/lib/moods.ts → MOODS. 'none' / undefined
   * = no mood guidance to the model. Mood is orthogonal to occasion:
   * a birthday garden can be tender OR playful and will render
   * differently for each.
   */
  mood?: string
}

/**
 * POST the request to /api/design-garden and parse the SSE stream.
 * Returns the final result; the callbacks fire as events arrive.
 * Thrown errors carry user-friendly messages (see friendlyError) —
 * the original failure is still console.error'd for debugging.
 */
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
    // User cancellations propagate as-is — Composer's catch checks
    // signal.aborted and handles them silently.
    if (err instanceof Error && err.name === 'AbortError') throw err

    // Everything else gets translated. Keep the original on the
    // console so a curious developer can dig in via DevTools.
    const raw = err instanceof Error ? err.message : String(err)
    console.error('[designGarden] underlying error:', err)
    throw new Error(friendlyError(raw))
  }
}

/**
 * Map a raw error message (from our backend, from Gemini, or from the
 * platform like "Failed to fetch") to a short conversational line in
 * the same nonchalant lowercase voice as the rest of the UI.
 *
 * Messages that already came from our backend's own validation
 * (e.g. "write something first.", "who is this for?") pass through
 * unchanged — they're already in the right register.
 *
 * Order matters: more-specific patterns first. The default case at
 * the bottom is the conservative fallback for short messages we
 * couldn't classify.
 */
export function friendlyError(raw: string): string {
  // Gemini-specific overload / high-demand 503s. Distinct from a
  // generic 5xx because the cause is clearly upstream — Google's
  // model is busy, not our backend. Naming Gemini explicitly so the
  // user understands the issue isn't with our app. Matched BEFORE
  // the generic 5xx pattern (which also catches \b503\b) so this
  // more-specific copy wins.
  if (
    /high.?demand|model.+is.+currently|model.+overloaded|spikes.+in.+demand|googlegenerativeai.+error|generativelanguage\.googleapis/i.test(
      raw,
    )
  ) {
    return "gemini's a little overwhelmed right now. give it a sec and try again."
  }

  // Rate limiting — our IP cap and Gemini's quota both surface as
  // some flavor of "rate limit" / 429.
  if (/rate.?limit|\b429\b|too.?many.?requests/i.test(raw)) {
    return "the demo's rate limit kicked in. give it about a minute and try again."
  }

  // Gemini quota exhausted (free tier, daily cap, etc.)
  if (/quota.?exceeded|generate.?content.?free.?tier|resource.?exhausted/i.test(raw)) {
    return 'the demo has used up its daily gemini quota. try again tomorrow, or clone the repo and run it locally with your own free key.'
  }

  // Model not found (e.g. a deprecated model id) / API endpoint issues
  if (/\b404\b|not.?found.?for.?api.?version|model.+not.+found/i.test(raw)) {
    return "the AI model isn't responding right now. try again shortly."
  }

  // Network drop / offline / DNS / CORS
  if (/failed.?to.?fetch|networkerror|network.?request.?failed|err_network/i.test(raw)) {
    return "couldn't reach the server. check your connection and try again."
  }

  // Server config missing — we shipped without an API key set
  if (/gemini_api_key|missing.+api.?key/i.test(raw)) {
    return "the demo isn't configured with an api key right now. (try cloning the repo + adding your own to run locally.)"
  }

  // Post-AI validation failed — the model returned a garden that
  // didn't pass validateGarden() (out-of-range petal count, bad hex,
  // wrong array length, etc.)
  if (/invalid garden|invalid.+payload|content_sha256/i.test(raw)) {
    return 'the AI got confused on that one. mind trying again, maybe with a slightly different note?'
  }

  // Stream ended without a complete event, or the model didn't call
  // the design_garden function as required
  if (/did.?not.?return.?a.?garden|stream.?ended.?without.?a.?garden/i.test(raw)) {
    return "the AI didn't return a garden. try again, ideally with a slightly longer or more specific note."
  }

  // Generic 5xx from our own backend or Gemini's
  if (/^request failed \(5\d{2}\)|\b5\d{2}\b|internal.?server.?error|bad.?gateway/i.test(raw)) {
    return 'something broke on our end. try again in a moment.'
  }

  // Long or stack-trace-shaped — definitely not user-readable, fall
  // back to a generic message rather than dumping it on screen
  if (raw.length > 160 || /\bstack:\s|exception|\bat\s+\w+\s*\(/i.test(raw)) {
    return 'something went wrong. try again, and if it keeps happening let me know.'
  }

  // Default: short, looks human-readable already (e.g. our backend's
  // own validation messages). Pass through.
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
